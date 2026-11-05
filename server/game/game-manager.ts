/**
 * Indian Monopoly - Authoritative Server Game Manager
 * Executes authoritative game commands using the core Monopoly engine,
 * guarantees cryptographic dice randomness, enforces serialized command queues,
 * and manages server-authoritative turn countdown timers and timeouts.
 */

import crypto from 'crypto';
import { GameCommand, GameState } from '../../src/domain/game-types';
import { createInitialGame } from '../../src/domain/game-engine/create-initial-game';
import { applyGameCommand, EngineResult, GameEngineError } from '../../src/domain/game-engine/engine';
import { generateFairDicePair } from '../../src/domain/game-engine/dice-fairness';
import { ServerRoom } from '../types/server-types';

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
  private gameTimers: Map<string, NodeJS.Timeout> = new Map();
  private commandQueues: Map<string, Promise<unknown>> = new Map();
  private processedCommands: Map<string, ProcessedCommandRecord> = new Map();
  private broadcastCallback: GameBroadcastCallback | null = null;

  public setBroadcastCallback(cb: GameBroadcastCallback) {
    this.broadcastCallback = cb;
  }

  // ==========================================
  // GAME INITIALIZATION
  // ==========================================

  /**
   * Starts an authoritative multiplayer match for a ready room.
   */
  public startGame(
    room: ServerRoom,
    callerUid: string
  ): { ok: boolean; gameId?: string; gameState?: GameState; error?: string } {
    if (room.hostUid !== callerUid) {
      return { ok: false, error: 'Only the room host can start the game.' };
    }

    const memberCount = Object.keys(room.members).length;
    if (memberCount < 2) {
      return { ok: false, error: 'At least 2 players are required to start a match.' };
    }

    const allReady = Object.values(room.members).every((m) => m.isReady);
    if (!allReady) {
      return { ok: false, error: 'All players must be Ready before starting.' };
    }

    const memberUids = Object.keys(room.members);
    // Requirement 1: Authoritative cryptographically unbiased random selection of first player
    const startingIndex = crypto.randomInt(0, memberUids.length);
    const startingPlayerUid = memberUids[startingIndex];

    const gameId = 'game_' + Date.now() + '_' + crypto.randomUUID().slice(0, 8);
    const initialGame = createInitialGame(
      room.roomId,
      gameId,
      room.members,
      room.customRules,
      startingPlayerUid
    );

    this.games.set(gameId, initialGame);
    room.status = 'IN_PROGRESS';
    room.gameId = gameId;

    // Start turn timer ticker for this game
    this.startTurnTimer(initialGame);

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
    actorUid: string
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
            const result = this.executeCommandInternal(gameId, command, actorUid);
            resolveCommand(result);
          } catch (err) {
            rejectCommand(err);
          }
        })
    );

    return nextPromise;
  }

  /**
   * Internal deterministic execution with cryptographic dice and deduplication.
   */
  private executeCommandInternal(
    gameId: string,
    command: GameCommand,
    actorUid: string
  ): EngineResult {
    const currentState = this.games.get(gameId);
    if (!currentState) {
      throw new GameEngineError('GAME_NOT_FOUND', 'Active game state not found');
    }

    // Check duplicate command prevention (idempotent retry handling)
    if (command.commandId && this.processedCommands.has(command.commandId)) {
      return this.processedCommands.get(command.commandId)!.result;
    }

    let injectedDice: [number, number] | undefined = undefined;

    // Generate cryptographic unbiased dice on the server for ROLL_DICE and TRY_DOUBLES
    if (command.type === 'ROLL_DICE' || command.type === 'TRY_DOUBLES') {
      injectedDice = generateFairDicePair();
    }

    const result = applyGameCommand(currentState, command, actorUid, injectedDice);

    // Save updated state and cache command for deduplication
    this.games.set(gameId, result.nextState);
    if (command.commandId) {
      this.processedCommands.set(command.commandId, {
        result,
        timestamp: Date.now(),
      });
    }

    // Reset or stop turn timer based on new state
    if (result.nextState.status === 'COMPLETED') {
      this.stopTurnTimer(gameId);
    } else {
      this.resetTurnTimer(result.nextState);
    }

    // Broadcast to room members
    if (this.broadcastCallback) {
      this.broadcastCallback(result.nextState.roomId, 'game:event', result.event);
      this.broadcastCallback(result.nextState.roomId, 'game:state', result.nextState);
    }

    return result;
  }

  // ==========================================
  // SERVER TURN TIMER & TIMEOUT AUTOMATION
  // ==========================================

  private startTurnTimer(gameState: GameState): void {
    const gameId = gameState.gameId;
    this.stopTurnTimer(gameId);

    const timer = setInterval(() => {
      const current = this.games.get(gameId);
      if (!current || current.status === 'COMPLETED') {
        this.stopTurnTimer(gameId);
        return;
      }

      const currentRemaining = current.turnTimeRemaining ?? 30;
      const nextRemaining = currentRemaining - 1;

      if (nextRemaining <= 0) {
        // Authoritative server timeout action
        this.handleTimeout(current);
      } else {
        current.turnTimeRemaining = nextRemaining;
        if (this.broadcastCallback) {
          this.broadcastCallback(current.roomId, 'game:timer', {
            remaining: nextRemaining,
            activeUid: current.currentPlayerUid,
          });
        }
      }
    }, 1000);

    this.gameTimers.set(gameId, timer);
  }

  private resetTurnTimer(gameState: GameState): void {
    // Reset timer countdown to standard turn duration (or custom rules)
    const turnDuration = gameState.rules?.turnTimerSeconds ?? 30;
    gameState.turnTimeRemaining = turnDuration;
    this.startTurnTimer(gameState);
  }

  public stopTurnTimer(gameId: string): void {
    const existing = this.gameTimers.get(gameId);
    if (existing) {
      clearInterval(existing);
      this.gameTimers.delete(gameId);
    }
  }

  /**
   * Executes an authoritative server timeout action when turn countdown hits zero.
   */
  private handleTimeout(gameState: GameState): void {
    const activeUid = gameState.currentPlayerUid;
    const commandId = 'timeout_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6);

    try {
      if (gameState.phase === 'AWAIT_ROLL') {
        const cmd: GameCommand = {
          commandId,
          roomId: gameState.roomId,
          gameId: gameState.gameId,
          expectedVersion: gameState.version,
          type: 'ROLL_DICE',
          payload: {},
        };
        this.processCommand(gameState.gameId, cmd, activeUid).catch((e) => {
          console.warn('Timeout ROLL_DICE failed:', e);
        });
      } else if (gameState.phase === 'PROPERTY_DECISION') {
        const cmd: GameCommand = {
          commandId,
          roomId: gameState.roomId,
          gameId: gameState.gameId,
          expectedVersion: gameState.version,
          type: 'DECLINE_PROPERTY',
          payload: {},
        };
        this.processCommand(gameState.gameId, cmd, activeUid).catch((e) => {
          console.warn('Timeout DECLINE_PROPERTY failed:', e);
        });
      } else if (gameState.phase === 'MANAGEMENT' || gameState.phase === 'TURN_END') {
        const cmd: GameCommand = {
          commandId,
          roomId: gameState.roomId,
          gameId: gameState.gameId,
          expectedVersion: gameState.version,
          type: 'END_TURN',
          payload: {},
        };
        this.processCommand(gameState.gameId, cmd, activeUid).catch((e) => {
          console.warn('Timeout END_TURN failed:', e);
        });
      } else if (gameState.phase === 'JAIL_DECISION') {
        const cmd: GameCommand = {
          commandId,
          roomId: gameState.roomId,
          gameId: gameState.gameId,
          expectedVersion: gameState.version,
          type: 'TRY_DOUBLES',
          payload: {},
        };
        this.processCommand(gameState.gameId, cmd, activeUid).catch((e) => {
          console.warn('Timeout TRY_DOUBLES failed:', e);
        });
      } else if (gameState.phase === 'ACTION_REQUIRED' && gameState.pendingFinancialObligation) {
        const debtor = gameState.players.find((p) => p.uid === gameState.pendingFinancialObligation?.debtorUid);
        const canResolve = debtor && debtor.cash >= gameState.pendingFinancialObligation.amountDue;
        const cmd: GameCommand = {
          commandId,
          roomId: gameState.roomId,
          gameId: gameState.gameId,
          expectedVersion: gameState.version,
          type: canResolve ? 'RESOLVE_OBLIGATION' : 'GIVE_UP',
          payload: {},
        };
        this.processCommand(gameState.gameId, cmd, activeUid).catch((e) => {
          console.warn('Timeout financial resolution failed:', e);
        });
      }
    } catch (err) {
      console.warn('Timeout execution error:', err);
    }
  }

  public getGame(gameId: string): GameState | null {
    return this.games.get(gameId) || null;
  }
}
