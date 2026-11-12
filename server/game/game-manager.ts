/**
 * Indian Monopoly - Authoritative Server Game Manager
 * Executes authoritative game commands using the core Monopoly engine,
 * guarantees cryptographic dice randomness, enforces serialized command queues,
 * and manages server-authoritative turn countdown timers and timeouts.
 *
 * Implements strict turn synchronization and pacing invariants:
 * - Movement animations pause the player timer until token arrives at destination.
 * - Enforces minimum 2-second handoff delay between consecutive CPU turns and after human turns.
 * - Dedicated 120-second financial resolution timer remains strictly independent.
 * - Genuinely new actionable phases reset the timer to its full configured duration.
 */

import crypto from 'crypto';
import { GameArchive, GameCommand, GameState, PropertyDefinition, TransitDefinition, UtilityDefinition } from '../../src/domain/game-types';
import { createInitialGame, secureFisherYatesShuffle } from '../../src/domain/game-engine/create-initial-game';
import { applyGameCommand, EngineResult, GameEngineError } from '../../src/domain/game-engine/engine';
import { generateFairDicePair } from '../../src/domain/game-engine/dice-fairness';
import { BOARD_SPACES } from '../../src/domain/board-config';
import { canBuildOnProperty, getAuthoritativeBailAmount, getSortedEligibleSellToBankProperties, calculateReacquisitionCost } from '../../src/domain/ruleset';
import { ServerRoom } from '../types/server-types';
import { CpuController, CpuControllerTimingConfig } from './cpu-controller';

export type GameBroadcastCallback = (
  roomId: string,
  event: 'game:state' | 'game:event' | 'game:timer' | 'game:started',
  data: unknown
) => void;

interface ProcessedCommandRecord {
  result: EngineResult;
  timestamp: number;
}

export class GameManager {
  private games: Map<string, GameState> = new Map();
  private archives: Map<string, GameArchive> = new Map();
  private gameTimers: Map<string, NodeJS.Timeout> = new Map();
  private movementTimers: Map<string, NodeJS.Timeout> = new Map();
  private handoffTimers: Map<string, NodeJS.Timeout> = new Map();
  private commandQueues: Map<string, Promise<unknown>> = new Map();
  private processedCommands: Map<string, ProcessedCommandRecord> = new Map();
  private broadcastCallback: GameBroadcastCallback | null = null;
  private cpuController: CpuController;

  constructor(cpuTiming?: Partial<CpuControllerTimingConfig>) {
    this.cpuController = new CpuController(
      (gameId) => this.getGame(gameId),
      (gameId, command, actorUid) => this.processCommand(gameId, command, actorUid),
      cpuTiming
    );
  }

  public getCpuController(): CpuController {
    return this.cpuController;
  }

  public setBroadcastCallback(cb: GameBroadcastCallback) {
    this.broadcastCallback = cb;
  }

  /**
   * Computes the authoritative movement duration matching client-side walking animations.
   */
  public calculateMovementDuration(steps: number): number {
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    const tumble = isTest ? 20 : 600;
    const stepMs = isTest ? 10 : 380;
    const settle = isTest ? 50 : 300;
    return tumble + steps * stepMs + settle;
  }

  /**
   * Computes the inter-turn handoff delay (2 seconds in production, fast in test).
   */
  public getHandoffDelay(): number {
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    return isTest ? 100 : 2000;
  }

  // ==========================================
  // GAME INITIALIZATION
  // ==========================================

  /**
   * Starts an authoritative multiplayer match for a ready room.
   */
  public startGame(
    room: ServerRoom,
    callerUid: string,
    options?: { forcedPlayerOrder?: string[]; randomizeOrder?: boolean }
  ): { ok: boolean; gameId?: string; gameState?: GameState; error?: string } {
    if (room.hostUid !== callerUid) {
      return { ok: false, error: 'Only the room host can start the game.' };
    }

    const members = Object.values(room.members);
    if (members.length < 2) {
      return { ok: false, error: 'At least 2 total players are required to start a match.' };
    }

    // Requirement 5: Every human player (including the host) must be explicitly READY. CPUs are automatically ready.
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
    } else if (process.env.NODE_ENV === 'test' && options?.randomizeOrder !== true) {
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

    const gameId = 'game_' + Date.now() + '_' + crypto.randomUUID().slice(0, 8);
    const initialGame = createInitialGame(
      room.roomId,
      gameId,
      room.members,
      room.customRules,
      startingPlayerUid,
      { forcedPlayerOrder: playerOrder }
    );

    this.games.set(gameId, initialGame);
    room.status = 'IN_PROGRESS';
    room.gameId = gameId;

    // Start turn timer ticker for this game
    this.startTurnTimer(initialGame);

    // Trigger autonomous computer players if first player is CPU
    this.cpuController.onGameStateChanged(initialGame);

    return { ok: true, gameId, gameState: initialGame };
  }

  // ==========================================
  // AUTHORITATIVE COMMAND PROCESSING
  // ==========================================

  /**
   * Executes a game command sequentially per game to eliminate race conditions.
   */
  public async processCommand(
    gameId: string,
    command: GameCommand,
    actorUid: string,
    options?: { cardRuleIndex?: number; isServerTimeout?: boolean }
  ): Promise<EngineResult> {
    // Serialize commands using a per-game promise queue
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
        .then(() => {
          try {
            const result = this.executeCommandInternal(gameId, command, actorUid, options);
            resolveCommand(result);
          } catch (err) {
            rejectCommand(err);
          }
        })
    );

    return nextPromise;
  }

  /**
   * Internal deterministic execution with cryptographic dice, movement pacing, and deduplication.
   */
  private executeCommandInternal(
    gameId: string,
    command: GameCommand,
    actorUid: string,
    options?: { cardRuleIndex?: number; isServerTimeout?: boolean }
  ): EngineResult {
    const currentState = this.games.get(gameId);
    if (!currentState) {
      throw new GameEngineError('GAME_NOT_FOUND', 'Active game state not found');
    }

    // Check duplicate command prevention (idempotent retry handling)
    if (command.commandId && this.processedCommands.has(command.commandId)) {
      return this.processedCommands.get(command.commandId)!.result;
    }

    // Validate expected version before phase and movement guards
    if (typeof command.expectedVersion === 'number' && command.expectedVersion !== currentState.version) {
      throw new GameEngineError(
        'STALE_VERSION',
        `Stale version: command expected version ${command.expectedVersion}, but current engine version is ${currentState.version}`
      );
    }

    // Guard 1: Block actions during active turn handoff
    if (currentState.handoff?.isActive) {
      throw new GameEngineError('INVALID_PHASE', 'Turn handoff in progress');
    }

    // Guard 2: Block actions during active token movement animation
    if (currentState.movement && !currentState.movement.isComplete) {
      throw new GameEngineError('INVALID_PHASE', 'Player token is currently moving');
    }

    let injectedDice: [number, number] | undefined = undefined;

    // Generate cryptographic unbiased dice on the server for ROLL_DICE and TRY_DOUBLES
    if (command.type === 'ROLL_DICE' || command.type === 'TRY_DOUBLES') {
      injectedDice = generateFairDicePair();
    }

    const result = applyGameCommand(currentState, command, actorUid, injectedDice, options);

    // Save updated state and cache command for deduplication
    this.games.set(gameId, result.nextState);
    if (command.commandId) {
      this.processedCommands.set(command.commandId, {
        result,
        timestamp: Date.now(),
      });
    }

    // Handle Completed Game
    if (result.nextState.status === 'COMPLETED') {
      this.stopTurnTimer(gameId);
      this.archiveGameSession(result.nextState);

      if (this.broadcastCallback) {
        this.broadcastCallback(result.nextState.roomId, 'game:event', result.event);
        this.broadcastCallback(result.nextState.roomId, 'game:state', result.nextState);
      }
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
      const isPrevCpu = Boolean(prevPlayer && (prevPlayer.isCpu || prevPlayer.playerType === 'COMPUTER'));

      const nextUid = result.nextState.currentPlayerUid;
      const nextPlayer = result.nextState.players.find((p) => p.uid === nextUid);
      const isNextCpu = Boolean(nextPlayer && (nextPlayer.isCpu || nextPlayer.playerType === 'COMPUTER'));

      // Section 5: 2-second handoff applies whenever CPU is involved (CPU->CPU, CPU->Human, Human->CPU)
      // Ordinary Human-to-Human turns start immediately without extra handoff delay.
      const needsHandoff = isPrevCpu || isNextCpu;

      if (needsHandoff) {
        // Enforce the 2-second minimum handoff delay before the next turn can begin
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
        // Human player is next: start immediately after previous turn is fully completed
        result.nextState.handoff = null;
        result.nextState.isTimerPaused = false;
        this.resetTurnTimer(result.nextState);
      }
    } else if (!hasMovement) {
      // Action occurred within current turn without movement (e.g. BUY_PROPERTY, BUILD, SELL_TO_BANK)
      if (result.nextState.phase === 'ACTION_REQUIRED' && result.nextState.pendingFinancialObligation) {
        // Dedicated 120-second financial resolution timer continues unaffected
        this.cpuController.onGameStateChanged(result.nextState);
      } else {
        this.resetTurnTimer(result.nextState);
        this.cpuController.onGameStateChanged(result.nextState);
      }
    }

    // Broadcast updated event and state to room members
    if (this.broadcastCallback) {
      this.broadcastCallback(result.nextState.roomId, 'game:event', result.event);
      this.broadcastCallback(result.nextState.roomId, 'game:state', result.nextState);
    }

    return result;
  }

  // ==========================================
  // MOVEMENT & TURN HANDOFF ORCHESTRATION
  // ==========================================

  /**
   * Schedules authoritative movement completion after animation duration.
   */
  private scheduleMovementCompletion(gameId: string, durationMs: number): void {
    const existing = this.movementTimers.get(gameId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.onMovementCompleted(gameId);
    }, durationMs);

    this.movementTimers.set(gameId, timer);
  }

  /**
   * Authoritatively concludes token movement, resolves landing phase, and resumes timer.
   */
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
      // Reset timer to full configured duration for the decision phase
      const turnDuration = state.rules?.turnTimerSeconds ?? 30;
      state.turnTimeRemaining = turnDuration;
      this.startTurnTimer(state);
    } else if (state.phase === 'ACTION_REQUIRED' && state.pendingFinancialObligation) {
      // Debt resolution retains dedicated 120-second countdown
    } else if (state.phase === 'MANAGEMENT' || state.phase === 'TURN_END') {
      const turnDuration = state.rules?.turnTimerSeconds ?? 30;
      state.turnTimeRemaining = turnDuration;
      this.startTurnTimer(state);
    }

    // Broadcast state and timer resumption to all clients
    if (this.broadcastCallback) {
      this.broadcastCallback(state.roomId, 'game:state', state);
      this.broadcastCallback(state.roomId, 'game:timer', {
        remaining: state.turnTimeRemaining,
        activeUid: state.currentPlayerUid,
        isPaused: false,
        phase: state.phase,
      });
    }

    // Trigger CPU controller to execute decision now that token has landed
    this.cpuController.onGameStateChanged(state);
  }

  /**
   * Schedules authoritative handoff completion after 2-second delay.
   */
  private scheduleHandoffCompletion(gameId: string, delayMs: number): void {
    const existing = this.handoffTimers.get(gameId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.onHandoffCompleted(gameId);
    }, delayMs);

    this.handoffTimers.set(gameId, timer);
  }

  /**
   * Authoritatively activates the next CPU player's turn after the 2-second handoff delay.
   */
  private onHandoffCompleted(gameId: string): void {
    this.handoffTimers.delete(gameId);
    const state = this.games.get(gameId);
    if (!state || state.status === 'COMPLETED') return;

    state.handoff = null;
    state.isTimerPaused = false;

    // Start next player's timer fresh with full configured duration
    const turnDuration = state.rules?.turnTimerSeconds ?? 30;
    state.turnTimeRemaining = turnDuration;
    this.startTurnTimer(state);

    if (this.broadcastCallback) {
      this.broadcastCallback(state.roomId, 'game:state', state);
      this.broadcastCallback(state.roomId, 'game:timer', {
        remaining: turnDuration,
        activeUid: state.currentPlayerUid,
        isPaused: false,
        phase: state.phase,
        handoff: false,
      });
    }

    // Officially trigger CPU action now that handoff delay has elapsed
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

      // If timer is paused (movement active or 2-second handoff in progress), do NOT decrement
      if (
        current.isTimerPaused ||
        (current.movement && !current.movement.isComplete) ||
        current.handoff?.isActive
      ) {
        if (this.broadcastCallback) {
          this.broadcastCallback(current.roomId, 'game:timer', {
            remaining: current.turnTimeRemaining,
            activeUid: current.currentPlayerUid,
            isPaused: true,
            phase: current.phase,
            handoff: Boolean(current.handoff?.isActive),
          });
        }
        return;
      }

      // Derive remaining time: if in ACTION_REQUIRED with pending obligation deadline, use authoritative expiresAt
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
        // Authoritative server timeout action: stop the ticking timer first to prevent duplicate firings
        this.stopTurnTimer(gameId);
        current.turnTimeRemaining = 0;
        this.handleTimeout(current).catch((err) => {
          console.warn('handleTimeout error:', err);
        });
      } else {
        current.turnTimeRemaining = nextRemaining;
        if (this.broadcastCallback) {
          this.broadcastCallback(current.roomId, 'game:timer', {
            remaining: nextRemaining,
            activeUid: timerActiveUid,
            isPaused: false,
            phase: current.phase,
          });
        }
      }
    }, 1000);

    this.gameTimers.set(gameId, timer);
  }

  private resetTurnTimer(gameState: GameState): void {
    // If in ACTION_REQUIRED with a financial obligation, preserve the 120-second deadline
    if (gameState.phase === 'ACTION_REQUIRED' && gameState.pendingFinancialObligation) {
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

  /**
   * Public test and runtime trigger to invoke authoritative server timeout action.
   */
  public async triggerTimeout(gameId: string): Promise<void> {
    const state = this.games.get(gameId);
    if (!state) return;
    this.stopTurnTimer(gameId);
    state.turnTimeRemaining = 0;
    await this.handleTimeout(state);
  }

  /**
   * Executes an authoritative server timeout action when turn countdown hits zero.
   */
  public async handleTimeout(gameState: GameState): Promise<void> {
    const freshState = this.games.get(gameState.gameId) || gameState;
    if (freshState.status === 'COMPLETED') {
      this.stopTurnTimer(freshState.gameId);
      return;
    }

    // Do not execute timeout while paused (during movement or handoff)
    if (
      freshState.isTimerPaused ||
      (freshState.movement && !freshState.movement.isComplete) ||
      freshState.handoff?.isActive
    ) {
      return;
    }

    const activeUid = freshState.currentPlayerUid;
    const commandId = 'timeout_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6);

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
        // Feature: Automatically build house/tower when a human player times out on an eligible city
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
              if (e instanceof GameEngineError && e.code === 'STALE_VERSION') {
                return;
              }
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
            if (e instanceof GameEngineError && e.code === 'STALE_VERSION') {
              return;
            }
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
          if (e instanceof GameEngineError && e.code === 'STALE_VERSION') {
            return;
          }
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

  /**
   * Intelligently auto-resolves property/city purchase and reacquisition decisions
   * when a human player times out during PROPERTY_DECISION phase.
   */
  private async handleHumanPropertyDecisionTimeout(gameId: string, playerUid: string): Promise<void> {
    const state = this.games.get(gameId);
    if (!state || state.status === 'COMPLETED') return;
    if (state.currentPlayerUid !== playerUid || state.phase !== 'PROPERTY_DECISION') return;

    const player = state.players.find((p) => p.uid === playerUid);
    if (!player || player.isBankrupt || player.isDisqualified) return;

    // Check Scenario B: Reacquisition of a mortgaged or bank-owned property
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
            commandId: 'timeout_reacquire_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6),
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
            commandId: 'timeout_decline_reacquire_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6),
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
      // Scenario A: Normal property / city purchase
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
              commandId: 'timeout_buy_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6),
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
              commandId: 'timeout_decline_buy_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6),
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
            commandId: 'timeout_decline_fallback_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6),
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

    // Turn progression: automatically complete turn if no further mandatory actions
    await this.autoEndTurnIfManagement(gameId, playerUid);
  }

  /**
   * Intelligently auto-liquidates eligible assets when a human debtor times out
   * on the 120-second financial resolution countdown.
   */
  private async handleHumanFinancialTimeout(gameId: string, debtorUid: string): Promise<void> {
    // Step 1: Check existing balance
    let state = this.games.get(gameId);
    if (!state || state.status === 'COMPLETED') return;
    if (state.phase !== 'ACTION_REQUIRED' || !state.pendingFinancialObligation) return;
    if (state.pendingFinancialObligation.debtorUid !== debtorUid) return;

    let debtor = state.players.find((p) => p.uid === debtorUid);
    if (!debtor) return;

    if (debtor.cash >= state.pendingFinancialObligation.amountDue) {
      await this.processCommand(
        gameId,
        {
          commandId: 'timeout_resolve_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6),
          roomId: state.roomId,
          gameId,
          expectedVersion: state.version,
          type: 'RESOLVE_OBLIGATION',
          payload: {},
        },
        debtorUid,
        { isServerTimeout: true }
      );
      await this.autoEndTurnIfManagement(gameId, debtorUid);
      return;
    }

    // Step 2 & 3: Sell assets one at a time following exact UI sorted order
    while (true) {
      state = this.games.get(gameId);
      if (!state || state.status === 'COMPLETED') return;

      // Stop immediately if obligation has already been resolved or cancelled
      if (state.phase !== 'ACTION_REQUIRED' || !state.pendingFinancialObligation) {
        break;
      }
      if (state.pendingFinancialObligation.debtorUid !== debtorUid) return;

      debtor = state.players.find((p) => p.uid === debtorUid);
      if (!debtor) return;

      // Check if cash has become sufficient
      if (debtor.cash >= state.pendingFinancialObligation.amountDue) {
        await this.processCommand(
          gameId,
          {
            commandId: 'timeout_resolve_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6),
            roomId: state.roomId,
            gameId,
            expectedVersion: state.version,
            type: 'RESOLVE_OBLIGATION',
            payload: {},
          },
          debtorUid,
          { isServerTimeout: true }
        );
        break;
      }

      // Retrieve exact Sell-to-Bank priority list
      const eligibleProps = getSortedEligibleSellToBankProperties(debtorUid, state.properties);
      if (eligibleProps.length === 0) {
        // No more eligible properties remain to sell
        break;
      }

      // Select and sell the first asset in the sorted list
      const nextToSell = eligibleProps[0];
      await this.processCommand(
        gameId,
        {
          commandId: 'timeout_mortgage_' + Date.now() + '_' + nextToSell.spaceIndex + '_' + crypto.randomUUID().slice(0, 6),
          roomId: state.roomId,
          gameId,
          expectedVersion: state.version,
          type: 'MORTGAGE',
          payload: { spaceIndex: nextToSell.spaceIndex },
        },
        debtorUid,
        { isServerTimeout: true }
      );
    }

    // Step 5: Surrender only after all eligible assets are exhausted
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
          // No eligible assets remain AND available cash < outstanding amount due -> Surrender!
          await this.processCommand(
            gameId,
            {
              commandId: 'timeout_give_up_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6),
              roomId: state.roomId,
              gameId,
              expectedVersion: state.version,
              type: 'GIVE_UP',
              payload: { reason: 'TIMEOUT' },
            },
            debtorUid,
            { isServerTimeout: true }
          );
          return;
        }
      }
    }

    // Step 6: Continue the turn after successful settlement
    await this.autoEndTurnIfManagement(gameId, debtorUid);
  }

  /**
   * Helper: If the given player is the active player and in MANAGEMENT/TURN_END phase
   * with no pending actions or debt, completes their turn automatically.
   */
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
          commandId: 'timeout_end_turn_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6),
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

  /**
   * Fail-safe recovery if a turn action threw an error or rejected,
   * applying a safe phase-specific fallback to prevent game freeze.
   */
  private recoverStuckTurn(gameId: string): void {
    const state = this.games.get(gameId);
    if (!state || state.status === 'COMPLETED') return;

    console.warn(
      `[GameManager] [STABILITY] Recovering stuck turn for game ${gameId} in phase ${state.phase}, player ${state.currentPlayerUid}`
    );

    const activePlayer = state.players.find((p) => p.uid === state.currentPlayerUid);
    const commandId = 'recovery_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6);

    // If active player is a CPU, trigger CPU controller directly to take safe action
    if (activePlayer && (activePlayer.isCpu || activePlayer.playerType === 'COMPUTER')) {
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

  public getGame(gameId: string): GameState | null {
    return this.games.get(gameId) || null;
  }

  /**
   * Persists final completed match results and player snapshots to the session archive.
   */
  private archiveGameSession(gameState: GameState): void {
    if (this.archives.has(gameState.gameId)) return; // Deduplicated: archive once

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
  }

  public getArchive(gameId: string): GameArchive | null {
    return this.archives.get(gameId) || null;
  }
}
