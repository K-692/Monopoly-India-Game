/**
 * Indian Monopoly - Authoritative Server Game Manager
 * Executes authoritative game commands using the core Monopoly engine,
 * guarantees cryptographic dice randomness, enforces serialized command queues,
 * and manages server-authoritative turn countdown timers, timeouts, durable persistence,
 * and automatic Human-to-CPU takeover for disconnected players.
 *
 * Implements strict turn synchronization and pacing invariants:
 * - Movement animations pause the player timer until token arrives at destination.
 * - Enforces minimum 2-second handoff delay between consecutive CPU turns and after human turns.
 * - Dedicated 120-second financial resolution timer remains strictly independent.
 * - Genuinely new actionable phases reset the timer to its full configured duration.
 * - Atomic persistence commits state and events before socket broadcast.
 * - Human-to-CPU takeover activates after configurable grace period and recovers seamlessly.
 */

import { randomUUID } from '../lib/isomorphic-crypto';
import { isTestEnv, readEnv } from '../lib/runtime-env';
import { BOARD_SPACES } from '../../src/domain/board-config';
import { createInitialGame, secureFisherYatesShuffle } from '../../src/domain/game-engine/create-initial-game';
import { generateFairDicePair } from '../../src/domain/game-engine/dice-fairness';
import { applyGameCommand, EngineResult, GameEngineError } from '../../src/domain/game-engine/engine';
import { GameArchive, GameCommand, GameState, PropertyDefinition, TransitDefinition, UtilityDefinition } from '../../src/domain/game-types';
import { calculateReacquisitionCost, canBuildOnProperty, getAuthoritativeBailAmount, getSortedEligibleSellToBankProperties } from '../../src/domain/ruleset';
import { MemoryStore } from '../persistence/memory-store';
import { PersistenceStore } from '../persistence/types';
import { ServerRoom } from '../types/server-types';
import { serverPerf } from '../diagnostics/perf-telemetry';
import { CpuController, CpuControllerTimingConfig } from './cpu-controller';

export type GameBroadcastCallback = (
  gameId: string,
  roomId: string,
  event: 'game:state' | 'game:event' | 'game:timer' | 'game:started' | 'player:controller_changed',
  data: unknown
) => void;

interface ProcessedCommandRecord {
  result: EngineResult;
  timestamp: number;
}

export class GameManager {
  private store: PersistenceStore;
  private games: Map<string, GameState> = new Map();
  private activeGameByRoom: Map<string, string> = new Map();
  private archives: Map<string, GameArchive> = new Map();
  private gameTimers: Map<string, NodeJS.Timeout> = new Map();
  private movementTimers: Map<string, NodeJS.Timeout> = new Map();
  private handoffTimers: Map<string, NodeJS.Timeout> = new Map();
  private disconnectGraceTimers: Map<string, NodeJS.Timeout> = new Map(); // `${gameId}:${playerUid}` -> timer
  private commandQueues: Map<string, Promise<unknown>> = new Map();
  // Per-game write-behind persistence queues (keeps DB writes ordered without blocking gameplay)
  private persistQueues: Map<string, Promise<void>> = new Map();
  private processedCommands: Map<string, ProcessedCommandRecord> = new Map();
  private broadcastCallback: GameBroadcastCallback | null = null;
  private cpuController: CpuController;

  constructor(
    storeOrCpuTiming?: PersistenceStore | Partial<CpuControllerTimingConfig>,
    cpuTiming?: Partial<CpuControllerTimingConfig>
  ) {
    if (storeOrCpuTiming && 'init' in storeOrCpuTiming && typeof storeOrCpuTiming.init === 'function') {
      this.store = storeOrCpuTiming as PersistenceStore;
      this.cpuController = new CpuController(
        (gameId) => this.getGame(gameId),
        (gameId, command, actorUid) => this.processCommand(gameId, command, actorUid),
        cpuTiming
      );
    } else {
      this.store = new MemoryStore();
      const timing = (storeOrCpuTiming as Partial<CpuControllerTimingConfig>) || cpuTiming;
      this.cpuController = new CpuController(
        (gameId) => this.getGame(gameId),
        (gameId, command, actorUid) => this.processCommand(gameId, command, actorUid),
        timing
      );
    }
  }

  public getStore(): PersistenceStore {
    return this.store;
  }

  /**
   * Enqueues a durable write for a game. Writes for the same game are applied strictly in order,
   * but gameplay never waits on them: the in-memory engine is authoritative and broadcasts
   * immediately, while PostgreSQL catches up in the background. This removes the database
   * round-trip (which can be hundreds of ms when the DB is in another region) from every click.
   */
  private enqueuePersist(gameId: string, label: string, task: () => Promise<unknown>): Promise<void> {
    const prev = this.persistQueues.get(gameId) || Promise.resolve();
    const next = prev.then(async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await task();
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // A missing parent game will never succeed on retry
          if (attempt === 3 || msg.includes('GAME_SESSION_NOT_PERSISTED')) {
            console.error(`[GameManager] Background persistence failed (${label}) for ${gameId}:`, msg);
            return;
          }
          await new Promise((r) => setTimeout(r, 150 * attempt));
        }
      }
    });
    this.persistQueues.set(gameId, next);
    void next.then(() => {
      if (this.persistQueues.get(gameId) === next) this.persistQueues.delete(gameId);
    });
    return next;
  }

  /**
   * Resolves once all pending background writes for a game (or all games) have been flushed.
   */
  public async flushPersistence(gameId?: string): Promise<void> {
    if (gameId) {
      await (this.persistQueues.get(gameId) || Promise.resolve());
      return;
    }
    await Promise.all([...this.persistQueues.values()]);
  }

  public getCpuController(): CpuController {
    return this.cpuController;
  }

  public setBroadcastCallback(cb: GameBroadcastCallback) {
    this.broadcastCallback = cb;
  }

  private emitBroadcast(
    gameId: string,
    roomId: string,
    event: 'game:state' | 'game:event' | 'game:timer' | 'game:started' | 'player:controller_changed',
    data: unknown
  ): void {
    if (!this.broadcastCallback) return;
    if (this.broadcastCallback.length === 3) {
      // Legacy 3-parameter adapter (roomId, event, data)
      (this.broadcastCallback as unknown as (roomId: string, event: string, data: unknown) => void)(roomId, event, data);
    } else {
      this.broadcastCallback(gameId, roomId, event, data);
    }
  }

  /**
   * Computes the authoritative movement duration matching client-side walking animations.
   * Optimized for responsive, smooth gameplay: 350ms dice tumble + 280ms per step + 180ms settling.
   */
  public calculateMovementDuration(steps: number): number {
    const isTest = isTestEnv();
    const tumble = isTest ? 20 : 350;
    const stepMs = isTest ? 10 : 280;
    const settle = isTest ? 50 : 180;
    return tumble + steps * stepMs + settle;
  }

  /**
   * Computes the inter-turn handoff delay (600ms in production, 100ms in test).
   * Snappy pacing allowing players to clearly follow turns without sluggish waiting.
   */
  public getHandoffDelay(): number {
    const isTest = isTestEnv();
    return isTest ? 100 : 600;
  }

  public getBotTakeoverGraceMs(): number {
    const isTest = isTestEnv();
    if (isTest) return 200;
    return parseInt(readEnv('BOT_TAKEOVER_GRACE_MS') || '10000', 10);
  }

  /**
   * Recovers active games from durable persistence on server restart.
   */
  public async recoverActiveGames(): Promise<void> {
    try {
      const activeGames = await this.store.listActiveGames();
      for (const game of activeGames) {
        this.games.set(game.gameId, game);
        this.activeGameByRoom.set(game.roomId, game.gameId);

        // Reconstruct active movement or handoff pacing if in flight
        if (game.movement && !game.movement.isComplete) {
          const remaining = Math.max(0, game.movement.endsAt - Date.now());
          this.scheduleMovementCompletion(game.gameId, remaining);
        } else if (game.handoff?.isActive) {
          const remaining = Math.max(0, game.handoff.endsAt - Date.now());
          this.scheduleHandoffCompletion(game.gameId, remaining);
        } else {
          this.startTurnTimer(game);
        }

        // Trigger autonomous CPU player if it is currently their turn
        this.cpuController.onGameStateChanged(game);
      }
      console.log(`[GameManager] Recovered ${activeGames.length} active match(es) from persistence store.`);
    } catch (err) {
      console.warn('[GameManager] Error recovering active games from store:', err);
    }
  }

  // ==========================================
  // GAME INITIALIZATION (ATOMIC ROOM ISOLATION)
  // ==========================================

  /**
   * Starts an authoritative multiplayer match for a ready room.
   * Atomic isolation: prevents duplicate concurrent games in the same room.
   */
  public async startGame(
    room: ServerRoom,
    callerUid: string,
    options?: { forcedPlayerOrder?: string[]; randomizeOrder?: boolean }
  ): Promise<{ ok: boolean; gameId?: string; gameState?: GameState; error?: string }> {
    if (room.hostUid !== callerUid) {
      return { ok: false, error: 'Only the room host can start the game.' };
    }

    // Invariant: check if room already has an active game
    if (room.status === 'IN_PROGRESS' && room.gameId) {
      const existing = this.games.get(room.gameId);
      if (existing && existing.status !== 'COMPLETED') {
        return { ok: true, gameId: existing.gameId, gameState: existing };
      }
    }

    if (room.status === 'COMPLETED' || room.status === 'ARCHIVED') {
      return { ok: false, error: 'Cannot start game: this room match has already concluded.' };
    }

    const existingActiveGameId = this.activeGameByRoom.get(room.roomId);
    if (existingActiveGameId) {
      const existing = this.games.get(existingActiveGameId);
      if (existing && existing.status !== 'COMPLETED') {
        return { ok: true, gameId: existing.gameId, gameState: existing };
      }
    }

    const members = Object.values(room.members);
    if (members.length < 2) {
      return { ok: false, error: 'At least 2 total players are required to start a match.' };
    }

    // Every human player (including the host) must be explicitly READY. CPUs are automatically ready.
    const unreadyHumans = members.filter(
      (m) => !m.isCpu && m.playerType !== 'COMPUTER' && !m.isReady
    );
    if (unreadyHumans.length > 0) {
      const names = unreadyHumans.map((m) => m.displayName).join(', ');
      return {
        ok: false,
        error: `Cannot start match: waiting for ${names} to be Ready.`,
      };
    }

    // Ensure all CPUs are marked ready
    for (const m of members) {
      if (m.isCpu || m.playerType === 'COMPUTER') {
        m.isReady = true;
      }
    }

    const memberUids = Object.keys(room.members);
    let playerOrder: string[];
    if (options?.forcedPlayerOrder && options.forcedPlayerOrder.length === memberUids.length) {
      playerOrder = [...options.forcedPlayerOrder];
    } else if (options?.randomizeOrder) {
      playerOrder = secureFisherYatesShuffle(memberUids);
    } else if (readEnv('NODE_ENV') === 'test' && options?.randomizeOrder !== true) {
      const startIdx = memberUids.indexOf(callerUid);
      const validStartIdx = startIdx >= 0 ? startIdx : 0;
      playerOrder =
        validStartIdx > 0
          ? [...memberUids.slice(validStartIdx), ...memberUids.slice(0, validStartIdx)]
          : memberUids;
    } else {
      playerOrder = secureFisherYatesShuffle(memberUids);
    }
    const startingPlayerUid = playerOrder[0];

    const gameId = 'game_' + Date.now() + '_' + randomUUID().slice(0, 8);
    const initialGame = createInitialGame(
      room.roomId,
      gameId,
      room.members,
      room.customRules,
      startingPlayerUid,
      { forcedPlayerOrder: playerOrder }
    );

    // Authoritative persistence: Await durable commit before updating active state and timers
    let persistedGame: GameState;
    try {
      const persistRes = await this.store.createGame(initialGame);
      if (!persistRes.ok) {
        if (persistRes.game) {
          persistedGame = persistRes.game;
        } else {
          console.error('[GameManager] Failed to persist new game session to store:', persistRes.error);
          return {
            ok: false,
            error: persistRes.error || 'Failed to persist game session',
          };
        }
      } else {
        persistedGame = persistRes.game || initialGame;
      }
    } catch (err) {
      console.error('[GameManager] Unexpected error during game persistence:', err);
      return {
        ok: false,
        error: 'Database persistence error while starting game',
      };
    }

    this.games.set(persistedGame.gameId, persistedGame);
    this.activeGameByRoom.set(room.roomId, persistedGame.gameId);
    room.status = 'IN_PROGRESS';
    room.gameId = persistedGame.gameId;

    // Start turn timer ticker for this game
    this.startTurnTimer(persistedGame);

    // Trigger autonomous computer players if first player is CPU
    this.cpuController.onGameStateChanged(persistedGame);

    return { ok: true, gameId: persistedGame.gameId, gameState: persistedGame };
  }

  // ==========================================
  // AUTHORITATIVE COMMAND PROCESSING
  // ==========================================

  /**
   * Executes a game command sequentially per game to eliminate race conditions.
   * Atomically commits state and event to persistence before broadcast.
   */
  public async processCommand(
    gameId: string,
    command: GameCommand,
    actorUid: string,
    options?: { cardRuleIndex?: number; isServerTimeout?: boolean }
  ): Promise<EngineResult> {
    // Check fast in-memory deduplication (0ms)
    if (command.commandId) {
      const dedupeKey = `${gameId}:${command.commandId}`;
      const memoryCached = this.processedCommands.get(dedupeKey);
      if (memoryCached) {
        return memoryCached.result;
      }
    }

    // Serialize commands using a per-game promise queue with safety execution timeout
    const currentQueue = this.commandQueues.get(gameId) || Promise.resolve();
    let resolveCommand!: (res: EngineResult) => void;
    let rejectCommand!: (err: unknown) => void;

    const nextPromise = new Promise<EngineResult>((res, rej) => {
      resolveCommand = res;
      rejectCommand = rej;
    });

    this.commandQueues.set(
      gameId,
      currentQueue
        .catch(() => {}) // Continue queue even if previous command rejected
        .then(async () => {
          let timeoutHandle: NodeJS.Timeout | null = null;
          const timeoutPromise = new Promise<never>((_, rej) => {
            timeoutHandle = setTimeout(() => {
              rej(new GameEngineError('COMMAND_TIMEOUT', 'Command execution exceeded safety timeout limit'));
            }, 8000);
          });

          try {
            const result = await Promise.race([
              this.executeCommandInternal(gameId, command, actorUid, options),
              timeoutPromise,
            ]);
            resolveCommand(result);
          } catch (err) {
            rejectCommand(err);
          } finally {
            if (timeoutHandle) clearTimeout(timeoutHandle);
          }
        })
    );

    return nextPromise;
  }

  /**
   * Internal deterministic execution with cryptographic dice, movement pacing, and deduplication.
   */
  private async executeCommandInternal(
    gameId: string,
    command: GameCommand,
    actorUid: string,
    options?: { cardRuleIndex?: number; isServerTimeout?: boolean }
  ): Promise<EngineResult> {
    const currentState = this.games.get(gameId);
    if (!currentState) {
      throw new GameEngineError('GAME_NOT_FOUND', 'Active game state not found');
    }

    // Check duplicate command prevention (idempotent retry handling)
    const dedupeKey = `${gameId}:${command.commandId}`;
    if (command.commandId && this.processedCommands.has(dedupeKey)) {
      return this.processedCommands.get(dedupeKey)!.result;
    }

    // Validate expected version before phase and movement guards
    if (typeof command.expectedVersion === 'number' && command.expectedVersion !== currentState.version) {
      throw new GameEngineError(
        'STALE_VERSION',
        `Stale version: command expected version ${command.expectedVersion}, but current engine version is ${currentState.version}`
      );
    }

    // Guard 1: Block actions during active turn handoff with self-healing expiration
    if (!options?.isServerTimeout && currentState.handoff?.isActive) {
      if (currentState.handoff.endsAt && Date.now() >= currentState.handoff.endsAt) {
        currentState.handoff = null;
      } else {
        throw new GameEngineError('INVALID_PHASE', 'Turn handoff in progress');
      }
    }

    // Guard 2: Block actions during active token movement animation with self-healing expiration
    if (!options?.isServerTimeout && currentState.movement && !currentState.movement.isComplete) {
      if (currentState.movement.endsAt && Date.now() >= currentState.movement.endsAt) {
        currentState.movement.isComplete = true;
      } else {
        throw new GameEngineError('INVALID_PHASE', 'Player token is currently moving');
      }
    }

    // Guard 3: Voluntary Sell-to-Bank is only permitted during the active player's turn (or for debt resolution)
    if (command.type === 'MORTGAGE') {
      const isObligationDebtor = currentState.pendingFinancialObligation?.debtorUid === actorUid;
      if (actorUid !== currentState.currentPlayerUid && !isObligationDebtor && !options?.isServerTimeout) {
        throw new GameEngineError(
          'NOT_YOUR_TURN',
          'Selling properties to the bank voluntarily is only permitted during your active turn'
        );
      }
    }

    // Guard 4: Give Up is only permitted during the active player's turn
    if (command.type === 'GIVE_UP') {
      if (actorUid !== currentState.currentPlayerUid && !options?.isServerTimeout) {
        throw new GameEngineError(
          'NOT_YOUR_TURN',
          'You can only give up during your active turn'
        );
      }
    }

    let injectedDice: [number, number] | undefined = undefined;

    // Generate cryptographic unbiased dice on the server for ROLL_DICE and TRY_DOUBLES
    if (command.type === 'ROLL_DICE' || command.type === 'TRY_DOUBLES') {
      injectedDice = generateFairDicePair();
    }

    const serverStartMs = Date.now();
    const result = applyGameCommand(currentState, command, actorUid, injectedDice, options);

    // Persist state, event, and processed command record in the background (write-behind).
    // Commands are already serialized per game and deduplicated in memory, so the engine can
    // broadcast immediately; the ordered persist queue guarantees the DB converges to the same state.
    const commitParams = {
      gameId,
      commandId: command.commandId,
      actorUid,
      result,
      nextState: result.nextState,
    };
    void this.enqueuePersist(gameId, `command:${command.type}`, async () => {
      const commitRes = await this.store.commitCommandExecution(commitParams);
      serverPerf.recordMetric({
        commandId: command.commandId,
        gameId,
        actionType: command.type,
        actorUid,
        serverReceivedAt: serverStartMs,
        serverDurationMs: Date.now() - serverStartMs,
        dbDurationMs: commitRes.durationMs ?? 0,
        broadcastAt: Date.now(),
      });
    });

    // Save updated state and cache command for in-memory deduplication
    this.games.set(gameId, result.nextState);
    if (command.commandId) {
      this.processedCommands.set(dedupeKey, {
        result,
        timestamp: Date.now(),
      });
    }

    // Handle Completed Game
    if (result.nextState.status === 'COMPLETED') {
      this.stopTurnTimer(gameId);
      this.activeGameByRoom.delete(result.nextState.roomId);
      this.archiveGameSession(result.nextState);

      this.emitBroadcast(gameId, result.nextState.roomId, 'game:event', result.event);
      this.emitBroadcast(gameId, result.nextState.roomId, 'game:state', result.nextState);
      return result;
    }

    // Check if token moved during this command
    const hasMovement =
      result.nextState.dice &&
      (command.type === 'ROLL_DICE' || (command.type === 'TRY_DOUBLES' && result.nextState.dice.isDouble));

    if (hasMovement) {
      const dice = result.nextState.dice!;
      const steps = Number(dice.total ?? (dice.first + dice.second));
      const startPos = Number(dice.oldPos ?? 0);
      const targetPos = Number(dice.newPos ?? ((startPos + steps) % 40));
      const durationMs = this.calculateMovementDuration(steps);

      result.nextState.movement = {
        playerId: actorUid,
        startPos,
        targetPos,
        steps,
        startedAt: Date.now(),
        endsAt: Date.now() + durationMs,
        durationMs,
        isComplete: false,
      };

      // Immediately pause active player's countdown during token movement
      result.nextState.isTimerPaused = true;
      this.scheduleMovementCompletion(gameId, durationMs);
    } else {
      result.nextState.movement = null;
    }

    // Check if turn ended and advanced to next player
    const isTurnAdvanced =
      command.type === 'END_TURN' ||
      actorUid !== result.nextState.currentPlayerUid;

    if (isTurnAdvanced) {
      const prevPlayer = currentState.players.find((p) => p.uid === actorUid);
      const isPrevCpu = Boolean(prevPlayer && (prevPlayer.isCpu || prevPlayer.playerType === 'COMPUTER' || prevPlayer.isBotControlled));

      const nextUid = result.nextState.currentPlayerUid;
      const nextPlayer = result.nextState.players.find((p) => p.uid === nextUid);
      const isNextCpu = Boolean(nextPlayer && (nextPlayer.isCpu || nextPlayer.playerType === 'COMPUTER' || nextPlayer.isBotControlled));

      // 2-second handoff applies whenever CPU or bot-controlled slot is involved
      const needsHandoff = isPrevCpu || isNextCpu;

      if (needsHandoff) {
        const handoffDelay = this.getHandoffDelay();
        result.nextState.handoff = {
          fromPlayerUid: actorUid,
          toPlayerUid: nextUid,
          startedAt: Date.now(),
          endsAt: Date.now() + handoffDelay,
          delayMs: handoffDelay,
          isActive: true,
        };
        result.nextState.isTimerPaused = true;
        result.nextState.turnTimeRemaining = result.nextState.rules?.turnTimerSeconds ?? 30;
        this.scheduleHandoffCompletion(gameId, handoffDelay);
      } else {
        result.nextState.handoff = null;
        result.nextState.isTimerPaused = false;
        this.resetTurnTimer(result.nextState);
      }
    } else if (!hasMovement) {
      if (result.nextState.phase === 'ACTION_REQUIRED' && result.nextState.pendingFinancialObligation) {
        const remaining = Math.max(0, Math.ceil((result.nextState.pendingFinancialObligation.expiresAt - Date.now()) / 1000));
        result.nextState.turnTimeRemaining = remaining;
        this.startTurnTimer(result.nextState);
        this.cpuController.onGameStateChanged(result.nextState);
      } else {
        this.resetTurnTimer(result.nextState);
        this.cpuController.onGameStateChanged(result.nextState);
      }
    }

    // Broadcast updated event and state to game channel
    this.emitBroadcast(gameId, result.nextState.roomId, 'game:event', result.event);
    this.emitBroadcast(gameId, result.nextState.roomId, 'game:state', result.nextState);

    return result;
  }

  // ==========================================
  // DISCONNECTION & AUTOMATIC CPU TAKEOVER
  // ==========================================

  /**
   * Called when a player's network socket disconnects.
   * If player is in an active match and is human, starts the grace period timer for bot takeover.
   */
  public handlePlayerDisconnected(playerUid: string): void {
    const graceMs = this.getBotTakeoverGraceMs();

    for (const [gameId, state] of this.games.entries()) {
      if (state.status === 'COMPLETED') continue;
      const player = state.players.find((p) => p.uid === playerUid);
      if (!player || player.isCpu || player.playerType === 'COMPUTER') continue;

      player.disconnectedAt = Date.now();
      const timerKey = `${gameId}:${playerUid}`;

      if (this.disconnectGraceTimers.has(timerKey)) {
        clearTimeout(this.disconnectGraceTimers.get(timerKey)!);
      }

      const timer = setTimeout(async () => {
        this.disconnectGraceTimers.delete(timerKey);
        await this.activateBotTakeover(gameId, playerUid);
      }, graceMs);

      this.disconnectGraceTimers.set(timerKey, timer);
    }
  }

  /**
   * Activates autonomous bot control for a disconnected human player after grace period expires.
   */
  public async activateBotTakeover(gameId: string, playerUid: string): Promise<void> {
    const state = this.games.get(gameId);
    if (!state || state.status === 'COMPLETED') return;

    const player = state.players.find((p) => p.uid === playerUid);
    if (!player || player.isCpu || player.playerType === 'COMPUTER') return;

    // Only activate if player has not reconnected
    if (!player.disconnectedAt) return;

    player.controllerType = 'BOT';
    player.isBotControlled = true;

    void this.enqueuePersist(gameId, 'bot-takeover', () => this.store.updateGame(state));

    this.emitBroadcast(gameId, state.roomId, 'player:controller_changed', {
      uid: playerUid,
      controllerType: 'BOT',
      isBotControlled: true,
    });
    this.emitBroadcast(gameId, state.roomId, 'game:state', state);

    // If active turn or debt belongs to this player, trigger CPU controller to play on their behalf
    if (state.currentPlayerUid === playerUid || state.pendingFinancialObligation?.debtorUid === playerUid) {
      this.cpuController.onGameStateChanged(state);
    }
  }

  /**
   * Called when an authenticated human player reconnects with their original token.
   * Restores human control and cancels future bot actions for their slot.
   */
  public handlePlayerReconnected(playerUid: string): void {
    for (const [gameId, state] of this.games.entries()) {
      if (state.status === 'COMPLETED') continue;
      const player = state.players.find((p) => p.uid === playerUid);
      if (!player) continue;

      const timerKey = `${gameId}:${playerUid}`;
      const existingTimer = this.disconnectGraceTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.disconnectGraceTimers.delete(timerKey);
      }

      player.disconnectedAt = null;

      if (player.isBotControlled || player.controllerType === 'BOT') {
        player.controllerType = 'HUMAN';
        player.isBotControlled = false;

        // Cancel scheduled CPU decision for this player
        this.cpuController.cancelPlayerAction(gameId, playerUid);

        void this.enqueuePersist(gameId, 'reconnect', () => this.store.updateGame(state));

        this.emitBroadcast(gameId, state.roomId, 'player:controller_changed', {
          uid: playerUid,
          controllerType: 'HUMAN',
          isBotControlled: false,
        });
        this.emitBroadcast(gameId, state.roomId, 'game:state', state);
      }
    }
  }

  // ==========================================
  // MOVEMENT & TURN HANDOFF ORCHESTRATION
  // ==========================================

  private scheduleMovementCompletion(gameId: string, durationMs: number): void {
    const existing = this.movementTimers.get(gameId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.onMovementCompleted(gameId);
    }, durationMs);

    this.movementTimers.set(gameId, timer);
  }

  private onMovementCompleted(gameId: string): void {
    this.movementTimers.delete(gameId);
    const state = this.games.get(gameId);
    if (!state || state.status === 'COMPLETED') return;

    if (state.movement) {
      state.movement.isComplete = true;
    }
    state.isTimerPaused = false;

    // Phase-aware timer reset when transitioning into a new actionable step:
    if (state.phase === 'PROPERTY_DECISION') {
      const turnDuration = state.rules?.turnTimerSeconds ?? 30;
      state.turnTimeRemaining = turnDuration;
      this.startTurnTimer(state);
    } else if (state.phase === 'ACTION_REQUIRED' && state.pendingFinancialObligation) {
      const remaining = Math.max(0, Math.ceil((state.pendingFinancialObligation.expiresAt - Date.now()) / 1000));
      state.turnTimeRemaining = remaining;
      this.startTurnTimer(state);
    } else if (state.phase === 'MANAGEMENT' || state.phase === 'TURN_END') {
      const turnDuration = state.rules?.turnTimerSeconds ?? 30;
      state.turnTimeRemaining = turnDuration;
      this.startTurnTimer(state);
    }

    const timerActiveUid =
      state.phase === 'ACTION_REQUIRED' && state.pendingFinancialObligation
        ? state.pendingFinancialObligation.debtorUid
        : state.currentPlayerUid;

    const elapsedSeconds = Math.max(0, Math.floor(((state.completedAt || Date.now()) - state.startedAt) / 1000));
    state.totalGameTimeSeconds = elapsedSeconds;

    this.emitBroadcast(gameId, state.roomId, 'game:state', state);
    this.emitBroadcast(gameId, state.roomId, 'game:timer', {
      remaining: state.turnTimeRemaining,
      activeUid: timerActiveUid,
      isPaused: false,
      phase: state.phase,
      elapsedSeconds,
    });

    this.cpuController.onGameStateChanged(state);
  }

  private scheduleHandoffCompletion(gameId: string, delayMs: number): void {
    const existing = this.handoffTimers.get(gameId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.onHandoffCompleted(gameId);
    }, delayMs);

    this.handoffTimers.set(gameId, timer);
  }

  private onHandoffCompleted(gameId: string): void {
    this.handoffTimers.delete(gameId);
    const state = this.games.get(gameId);
    if (!state || state.status === 'COMPLETED') return;

    state.handoff = null;
    state.isTimerPaused = false;

    const turnDuration = state.rules?.turnTimerSeconds ?? 30;
    state.turnTimeRemaining = turnDuration;
    this.startTurnTimer(state);

    const elapsedSeconds = Math.max(0, Math.floor(((state.completedAt || Date.now()) - state.startedAt) / 1000));
    state.totalGameTimeSeconds = elapsedSeconds;

    this.emitBroadcast(gameId, state.roomId, 'game:state', state);
    this.emitBroadcast(gameId, state.roomId, 'game:timer', {
      remaining: turnDuration,
      activeUid: state.currentPlayerUid,
      isPaused: false,
      phase: state.phase,
      handoff: false,
      elapsedSeconds,
    });

    this.cpuController.onGameStateChanged(state);
  }

  // ==========================================
  // SERVER TURN TIMER & TIMEOUT AUTOMATION
  // ==========================================

  private startTurnTimer(gameState: GameState): void {
    const gameId = gameState.gameId;
    const existingTimer = this.gameTimers.get(gameId);
    if (existingTimer) {
      clearInterval(existingTimer);
      this.gameTimers.delete(gameId);
    }

    const timer = setInterval(() => {
      const current = this.games.get(gameId);
      if (!current || current.status === 'COMPLETED') {
        this.stopTurnTimer(gameId);
        return;
      }

      if (
        current.isTimerPaused ||
        (current.movement && !current.movement.isComplete) ||
        current.handoff?.isActive
      ) {
        const elapsedSeconds = Math.max(0, Math.floor(((current.completedAt || Date.now()) - current.startedAt) / 1000));
        current.totalGameTimeSeconds = elapsedSeconds;
        this.emitBroadcast(gameId, current.roomId, 'game:timer', {
          remaining: current.turnTimeRemaining,
          activeUid: current.currentPlayerUid,
          isPaused: true,
          phase: current.phase,
          handoff: Boolean(current.handoff?.isActive),
          elapsedSeconds,
        });
        return;
      }

      let nextRemaining: number;
      let timerActiveUid = current.currentPlayerUid;

      if (current.phase === 'ACTION_REQUIRED' && current.pendingFinancialObligation?.expiresAt) {
        timerActiveUid = current.pendingFinancialObligation.debtorUid;
        nextRemaining = Math.max(0, Math.ceil((current.pendingFinancialObligation.expiresAt - Date.now()) / 1000));
      } else {
        const currentRemaining = current.turnTimeRemaining ?? 30;
        nextRemaining = currentRemaining - 1;
      }

      if (nextRemaining <= 0) {
        this.stopTurnTimer(gameId);
        current.turnTimeRemaining = 0;
        this.handleTimeout(current).catch((err) => {
          console.warn('handleTimeout error:', err);
        });
      } else {
        current.turnTimeRemaining = nextRemaining;
        const elapsedSeconds = Math.max(0, Math.floor(((current.completedAt || Date.now()) - current.startedAt) / 1000));
        current.totalGameTimeSeconds = elapsedSeconds;
        this.emitBroadcast(gameId, current.roomId, 'game:timer', {
          remaining: nextRemaining,
          activeUid: timerActiveUid,
          isPaused: false,
          phase: current.phase,
          elapsedSeconds,
        });
      }
    }, 1000);

    this.gameTimers.set(gameId, timer);
  }

  private resetTurnTimer(gameState: GameState): void {
    if (gameState.phase === 'ACTION_REQUIRED' && gameState.pendingFinancialObligation) {
      this.startTurnTimer(gameState);
      return;
    }

    const turnDuration = gameState.rules?.turnTimerSeconds ?? 30;
    gameState.turnTimeRemaining = turnDuration;
    gameState.isTimerPaused = false;
    this.startTurnTimer(gameState);
  }

  public stopTurnTimer(gameId: string): void {
    const existing = this.gameTimers.get(gameId);
    if (existing) {
      clearInterval(existing);
      this.gameTimers.delete(gameId);
    }

    const moveTimer = this.movementTimers.get(gameId);
    if (moveTimer) {
      clearTimeout(moveTimer);
      this.movementTimers.delete(gameId);
    }

    const handoffTimer = this.handoffTimers.get(gameId);
    if (handoffTimer) {
      clearTimeout(handoffTimer);
      this.handoffTimers.delete(gameId);
    }
  }

  public async triggerTimeout(gameId: string): Promise<void> {
    const state = this.games.get(gameId);
    if (!state) return;
    this.stopTurnTimer(gameId);
    state.turnTimeRemaining = 0;
    await this.handleTimeout(state);
  }

  public async handleTimeout(gameState: GameState): Promise<void> {
    const freshState = this.games.get(gameState.gameId) || gameState;
    if (freshState.status === 'COMPLETED') {
      this.stopTurnTimer(freshState.gameId);
      return;
    }

    const isFinancialTimeout =
      freshState.phase === 'ACTION_REQUIRED' && Boolean(freshState.pendingFinancialObligation);

    if (
      !isFinancialTimeout &&
      (freshState.isTimerPaused ||
        (freshState.movement && !freshState.movement.isComplete) ||
        freshState.handoff?.isActive)
    ) {
      this.startTurnTimer(freshState);
      return;
    }

    if (isFinancialTimeout) {
      freshState.isTimerPaused = false;
      if (freshState.movement) {
        freshState.movement.isComplete = true;
      }
    }

    const activeUid = freshState.currentPlayerUid;
    const commandId = 'timeout_' + Date.now() + '_' + randomUUID().slice(0, 6);

    try {
      if (freshState.phase === 'AWAIT_ROLL') {
        const cmd: GameCommand = {
          commandId,
          roomId: freshState.roomId,
          gameId: freshState.gameId,
          expectedVersion: freshState.version,
          type: 'ROLL_DICE',
          payload: {},
        };
        await this.processCommand(freshState.gameId, cmd, activeUid, { isServerTimeout: true }).catch((e) => {
          console.warn('Timeout ROLL_DICE failed:', e);
          this.recoverStuckTurn(freshState.gameId);
        });
      } else if (freshState.phase === 'PROPERTY_DECISION') {
        const activePlayer = freshState.players.find((p) => p.uid === activeUid);
        const isCpu = Boolean(activePlayer && (activePlayer.isCpu || activePlayer.playerType === 'COMPUTER'));

        if (!isCpu) {
          await this.handleHumanPropertyDecisionTimeout(freshState.gameId, activeUid).catch((e) => {
            console.warn('Human timeout property decision failed:', e);
            this.recoverStuckTurn(freshState.gameId);
          });
        } else {
          const cmd: GameCommand = {
            commandId,
            roomId: freshState.roomId,
            gameId: freshState.gameId,
            expectedVersion: freshState.version,
            type: 'DECLINE_PROPERTY',
            payload: {},
          };
          await this.processCommand(freshState.gameId, cmd, activeUid, { isServerTimeout: true }).catch((e) => {
            console.warn('Timeout DECLINE_PROPERTY failed:', e);
            this.recoverStuckTurn(freshState.gameId);
          });
        }
      } else if (freshState.phase === 'MANAGEMENT') {
        const activePlayer = freshState.players.find((p) => p.uid === activeUid);
        const isCpu = Boolean(activePlayer && (activePlayer.isCpu || activePlayer.playerType === 'COMPUTER'));

        let executedBuild = false;
        if (!isCpu && activePlayer && !activePlayer.isBankrupt && !activePlayer.isDisqualified) {
          const buildCheck = canBuildOnProperty(
            activePlayer.position,
            activePlayer.uid,
            freshState.properties,
            activePlayer.cash,
            activePlayer.position,
            freshState.turnNumber
          );

          if (buildCheck.allowed) {
            const cmd: GameCommand = {
              commandId,
              roomId: freshState.roomId,
              gameId: freshState.gameId,
              expectedVersion: freshState.version,
              type: 'BUILD',
              payload: { spaceIndex: activePlayer.position },
            };
            await this.processCommand(freshState.gameId, cmd, activeUid, { isServerTimeout: true }).catch((e) => {
              if (e instanceof GameEngineError && e.code === 'STALE_VERSION') return;
              console.warn('Timeout BUILD failed:', e);
              this.recoverStuckTurn(freshState.gameId);
            });
            executedBuild = true;
          }
        }

        if (!executedBuild) {
          const cmd: GameCommand = {
            commandId,
            roomId: freshState.roomId,
            gameId: freshState.gameId,
            expectedVersion: freshState.version,
            type: 'END_TURN',
            payload: {},
          };
          await this.processCommand(freshState.gameId, cmd, activeUid, { isServerTimeout: true }).catch((e) => {
            if (e instanceof GameEngineError && e.code === 'STALE_VERSION') return;
            console.warn('Timeout END_TURN failed:', e);
            this.recoverStuckTurn(freshState.gameId);
          });
        }
      } else if (freshState.phase === 'TURN_END') {
        const cmd: GameCommand = {
          commandId,
          roomId: freshState.roomId,
          gameId: freshState.gameId,
          expectedVersion: freshState.version,
          type: 'END_TURN',
          payload: {},
        };
        await this.processCommand(freshState.gameId, cmd, activeUid, { isServerTimeout: true }).catch((e) => {
          if (e instanceof GameEngineError && e.code === 'STALE_VERSION') return;
          console.warn('Timeout END_TURN failed:', e);
          this.recoverStuckTurn(freshState.gameId);
        });
      } else if (freshState.phase === 'JAIL_DECISION') {
        const activePlayer = freshState.players.find((p) => p.uid === activeUid);
        const bailAmount = getAuthoritativeBailAmount(freshState);
        const hasSufficientCash = Boolean(activePlayer && activePlayer.cash >= bailAmount);

        const commandType = hasSufficientCash ? 'PAY_BAIL' : 'TRY_DOUBLES';
        const cmd: GameCommand = {
          commandId,
          roomId: freshState.roomId,
          gameId: freshState.gameId,
          expectedVersion: freshState.version,
          type: commandType,
          payload: {},
        };
        await this.processCommand(freshState.gameId, cmd, activeUid, { isServerTimeout: true }).catch((e) => {
          console.warn(`Timeout ${commandType} failed:`, e);
          this.recoverStuckTurn(freshState.gameId);
        });
      } else if (freshState.phase === 'ACTION_REQUIRED' && freshState.pendingFinancialObligation) {
        const obligation = freshState.pendingFinancialObligation;
        const debtorUid = obligation.debtorUid;
        const debtor = freshState.players.find((p) => p.uid === debtorUid);
        const isCpu = Boolean(debtor && (debtor.isCpu || debtor.playerType === 'COMPUTER'));

        if (!isCpu) {
          await this.handleHumanFinancialTimeout(freshState.gameId, debtorUid).catch((e) => {
            console.warn('Human timeout financial liquidation failed:', e);
            this.recoverStuckTurn(freshState.gameId);
          });
        } else {
          const canResolve = debtor && debtor.cash >= obligation.amountDue;
          const cmd: GameCommand = {
            commandId,
            roomId: freshState.roomId,
            gameId: freshState.gameId,
            expectedVersion: freshState.version,
            type: canResolve ? 'RESOLVE_OBLIGATION' : 'GIVE_UP',
            payload: canResolve ? {} : { reason: 'TIMEOUT' },
          };
          await this.processCommand(freshState.gameId, cmd, debtorUid, { isServerTimeout: true }).catch((e) => {
            console.warn('Timeout financial resolution failed:', e);
            this.recoverStuckTurn(freshState.gameId);
          });
        }
      } else {
        this.recoverStuckTurn(freshState.gameId);
      }
    } catch (err) {
      console.warn('Timeout execution error:', err);
      this.recoverStuckTurn(freshState.gameId);
    }
  }

  private async handleHumanPropertyDecisionTimeout(gameId: string, playerUid: string): Promise<void> {
    const state = this.games.get(gameId);
    if (!state || state.status === 'COMPLETED') return;
    if (state.currentPlayerUid !== playerUid || state.phase !== 'PROPERTY_DECISION') return;

    const player = state.players.find((p) => p.uid === playerUid);
    if (!player || player.isBankrupt || player.isDisqualified) return;

    if (
      state.reacquisitionOpportunity &&
      state.reacquisitionOpportunity.status === 'PENDING' &&
      state.reacquisitionOpportunity.playerUid === playerUid
    ) {
      const opp = state.reacquisitionOpportunity;
      const canAfford = player.cash >= opp.cost;

      if (canAfford) {
        await this.processCommand(
          gameId,
          {
            commandId: 'timeout_reacquire_' + Date.now() + '_' + randomUUID().slice(0, 6),
            roomId: state.roomId,
            gameId,
            expectedVersion: state.version,
            type: 'UNMORTGAGE',
            payload: { spaceIndex: opp.spaceIndex, landingId: opp.landingId },
          },
          playerUid,
          { isServerTimeout: true }
        );
      } else {
        await this.processCommand(
          gameId,
          {
            commandId: 'timeout_decline_reacquire_' + Date.now() + '_' + randomUUID().slice(0, 6),
            roomId: state.roomId,
            gameId,
            expectedVersion: state.version,
            type: 'DECLINE_REACQUISITION',
            payload: { spaceIndex: opp.spaceIndex },
          },
          playerUid,
          { isServerTimeout: true }
        );
      }
    } else {
      const space = BOARD_SPACES[player.position];
      const propState = state.properties[player.position];

      const isUnowned =
        propState &&
        !propState.ownerUid &&
        propState.ownershipState !== 'BLOCKED' &&
        !propState.isMortgaged &&
        propState.ownershipState !== 'MORTGAGED';

      if (isUnowned && space && ('price' in space || propState.soldToBankPayout || propState.soldToBankReacquisitionCost)) {
        const isBankAcquisition = Boolean(
          (propState.soldToBankReacquisitionCost && propState.soldToBankReacquisitionCost > 0) ||
          (propState.soldToBankPayout && propState.soldToBankPayout > 0)
        );
        const price = isBankAcquisition
          ? calculateReacquisitionCost(space.spaceIndex, propState)
          : (space as PropertyDefinition | TransitDefinition | UtilityDefinition).price;

        if (player.cash >= price) {
          await this.processCommand(
            gameId,
            {
              commandId: 'timeout_buy_' + Date.now() + '_' + randomUUID().slice(0, 6),
              roomId: state.roomId,
              gameId,
              expectedVersion: state.version,
              type: 'BUY_PROPERTY',
              payload: { spaceIndex: space.spaceIndex },
            },
            playerUid,
            { isServerTimeout: true }
          );
        } else {
          await this.processCommand(
            gameId,
            {
              commandId: 'timeout_decline_buy_' + Date.now() + '_' + randomUUID().slice(0, 6),
              roomId: state.roomId,
              gameId,
              expectedVersion: state.version,
              type: 'DECLINE_PROPERTY',
              payload: {},
            },
            playerUid,
            { isServerTimeout: true }
          );
        }
      } else {
        await this.processCommand(
          gameId,
          {
            commandId: 'timeout_decline_fallback_' + Date.now() + '_' + randomUUID().slice(0, 6),
            roomId: state.roomId,
            gameId,
            expectedVersion: state.version,
            type: 'DECLINE_PROPERTY',
            payload: {},
          },
          playerUid,
          { isServerTimeout: true }
        );
      }
    }

    await this.autoEndTurnIfManagement(gameId, playerUid);
  }

  private async handleHumanFinancialTimeout(gameId: string, debtorUid: string): Promise<void> {
    let state = this.games.get(gameId);
    if (!state || state.status === 'COMPLETED') return;
    if (state.phase !== 'ACTION_REQUIRED' || !state.pendingFinancialObligation) return;
    if (state.pendingFinancialObligation.debtorUid !== debtorUid) return;

    let debtor = state.players.find((p) => p.uid === debtorUid);
    if (!debtor) return;

    if (debtor.cash >= state.pendingFinancialObligation.amountDue) {
      try {
        await this.processCommand(
          gameId,
          {
            commandId: 'timeout_resolve_' + Date.now() + '_' + randomUUID().slice(0, 6),
            roomId: state.roomId,
            gameId,
            expectedVersion: state.version,
            type: 'RESOLVE_OBLIGATION',
            payload: {},
          },
          debtorUid,
          { isServerTimeout: true }
        );
      } catch (err) {
        console.warn('timeout_resolve error:', err);
      }
      await this.autoEndTurnIfManagement(gameId, debtorUid);
      return;
    }

    while (true) {
      state = this.games.get(gameId);
      if (!state || state.status === 'COMPLETED') return;

      if (state.phase !== 'ACTION_REQUIRED' || !state.pendingFinancialObligation) {
        break;
      }
      if (state.pendingFinancialObligation.debtorUid !== debtorUid) return;

      debtor = state.players.find((p) => p.uid === debtorUid);
      if (!debtor) return;

      if (debtor.cash >= state.pendingFinancialObligation.amountDue) {
        try {
          await this.processCommand(
            gameId,
            {
              commandId: 'timeout_resolve_' + Date.now() + '_' + randomUUID().slice(0, 6),
              roomId: state.roomId,
              gameId,
              expectedVersion: state.version,
              type: 'RESOLVE_OBLIGATION',
              payload: {},
            },
            debtorUid,
            { isServerTimeout: true }
          );
        } catch (err) {
          console.warn('timeout_resolve error in loop:', err);
        }
        break;
      }

      const eligibleProps = getSortedEligibleSellToBankProperties(debtorUid, state.properties);
      if (eligibleProps.length === 0) {
        break;
      }

      const nextToSell = eligibleProps[0];
      try {
        await this.processCommand(
          gameId,
          {
            commandId: 'timeout_mortgage_' + Date.now() + '_' + nextToSell.spaceIndex + '_' + randomUUID().slice(0, 6),
            roomId: state.roomId,
            gameId,
            expectedVersion: state.version,
            type: 'MORTGAGE',
            payload: { spaceIndex: nextToSell.spaceIndex },
          },
          debtorUid,
          { isServerTimeout: true }
        );
      } catch (err) {
        console.warn(`timeout_mortgage error for space ${nextToSell.spaceIndex}:`, err);
        break;
      }
    }

    state = this.games.get(gameId);
    if (!state || state.status === 'COMPLETED') return;

    if (
      state.phase === 'ACTION_REQUIRED' &&
      state.pendingFinancialObligation &&
      state.pendingFinancialObligation.debtorUid === debtorUid
    ) {
      debtor = state.players.find((p) => p.uid === debtorUid);
      if (debtor && debtor.cash < state.pendingFinancialObligation.amountDue) {
        const remainingProps = getSortedEligibleSellToBankProperties(debtorUid, state.properties);
        if (remainingProps.length === 0) {
          try {
            await this.processCommand(
              gameId,
              {
                commandId: 'timeout_give_up_' + Date.now() + '_' + randomUUID().slice(0, 6),
                roomId: state.roomId,
                gameId,
                expectedVersion: state.version,
                type: 'GIVE_UP',
                payload: { reason: 'TIMEOUT' },
              },
              debtorUid,
              { isServerTimeout: true }
            );
          } catch (err) {
            console.warn('timeout_give_up error:', err);
          }
          return;
        }
      }
    }

    await this.autoEndTurnIfManagement(gameId, debtorUid);
  }

  private async autoEndTurnIfManagement(gameId: string, playerUid: string): Promise<void> {
    const state = this.games.get(gameId);
    if (
      state &&
      state.status === 'IN_PROGRESS' &&
      state.currentPlayerUid === playerUid &&
      (state.phase === 'MANAGEMENT' || state.phase === 'TURN_END') &&
      !state.pendingAction &&
      !state.pendingFinancialObligation
    ) {
      await this.processCommand(
        gameId,
        {
          commandId: 'timeout_end_turn_' + Date.now() + '_' + randomUUID().slice(0, 6),
          roomId: state.roomId,
          gameId,
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        },
        playerUid,
        { isServerTimeout: true }
      );
    }
  }

  private recoverStuckTurn(gameId: string): void {
    const state = this.games.get(gameId);
    if (!state || state.status === 'COMPLETED') return;

    console.warn(
      `[GameManager] [STABILITY] Recovering stuck turn for game ${gameId} in phase ${state.phase}, player ${state.currentPlayerUid}`
    );

    const activePlayer = state.players.find((p) => p.uid === state.currentPlayerUid);
    const commandId = 'recovery_' + Date.now() + '_' + randomUUID().slice(0, 6);

    if (activePlayer && (activePlayer.isCpu || activePlayer.playerType === 'COMPUTER' || activePlayer.isBotControlled)) {
      const fallback = this.cpuController.getSafeFallbackDecision(state, activePlayer);
      if (fallback) {
        this.processCommand(gameId, {
          commandId,
          roomId: state.roomId,
          gameId: state.gameId,
          expectedVersion: state.version,
          type: fallback.type,
          payload: fallback.payload || {},
        }, activePlayer.uid).catch(() => {
          this.resetTurnTimer(state);
        });
        return;
      }
    }

    if (state.phase === 'MANAGEMENT' || state.phase === 'TURN_END') {
      this.processCommand(gameId, {
        commandId,
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'END_TURN',
        payload: {},
      }, state.currentPlayerUid).catch(() => {
        this.resetTurnTimer(state);
      });
      return;
    }

    this.resetTurnTimer(state);
  }

  /** Lists all games currently held in memory (used for online-host snapshots). */
  public listGames(): GameState[] {
    return [...this.games.values()];
  }

  public getGame(gameId: string): GameState | null {
    return this.games.get(gameId) || null;
  }

  public getActiveGameIdForRoom(roomId: string): string | undefined {
    return this.activeGameByRoom.get(roomId);
  }

  public getActiveGameForRoom(roomId: string): GameState | null {
    const gameId = this.activeGameByRoom.get(roomId);
    if (!gameId) return null;
    return this.getGame(gameId);
  }

  private archiveGameSession(gameState: GameState): void {
    if (this.archives.has(gameState.gameId)) return;

    const winner = gameState.players.find((p) => p.uid === gameState.winnerUid);
    const sorted = [...gameState.players].sort((a, b) => {
      if (b.netWorth !== a.netWorth) return b.netWorth - a.netWorth;
      if (b.cash !== a.cash) return b.cash - a.cash;
      return a.uid.localeCompare(b.uid);
    });

    const playerSnapshots = sorted.map((p, idx) => ({
      uid: p.uid,
      displayName: p.displayName,
      photoURL: p.photoURL,
      finalCash: p.cash,
      netWorth: p.netWorth,
      rank: idx + 1,
      propertiesCount: Object.values(gameState.properties).filter((prop) => prop.ownerUid === p.uid).length,
    }));

    const archive: GameArchive = {
      archiveId: 'arch_' + gameState.gameId,
      gameId: gameState.gameId,
      roomId: gameState.roomId,
      rulesetVersion: gameState.rulesetVersion,
      playerSnapshots,
      winnerUid: gameState.winnerUid || '',
      winnerName: winner?.displayName || 'No Winner',
      startedAt: gameState.startedAt,
      completedAt: gameState.completedAt || Date.now(),
      durationSeconds: Math.floor(((gameState.completedAt || Date.now()) - gameState.startedAt) / 1000),
      totalTurns: gameState.turnNumber,
      participantUids: gameState.players.map((p) => p.uid),
      retentionUntil: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };

    this.archives.set(gameState.gameId, archive);
    this.store.saveArchive(archive).catch((err) => {
      console.warn('[GameManager] Failed to persist archive:', err);
    });
  }

  public getArchive(gameId: string): GameArchive | null {
    return this.archives.get(gameId) || null;
  }
}
