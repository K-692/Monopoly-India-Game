/**
 * Indian Monopoly - Server-Side Autonomous CPU Controller
 *
 * Coordinates turn execution, pacing, decision-making, and command dispatch
 * for computer-controlled players on the authoritative server.
 *
 * Enforces sequential turn execution and prevents overlapping CPU actions:
 * - Session-level execution locks per game, turn, and player UID.
 * - Respects the authoritative 2-second handoff delay between turns.
 * - Respects authoritative token movement animation before executing landing actions.
 * - Implements idempotent command IDs and bounded error retry.
 */

import crypto from 'crypto';
import { GameCommand, GameState, PlayerState } from '../../src/domain/game-types';
import { decideNextAction } from '../../src/domain/game-engine/cpu-decision-engine';
import { EngineResult } from '../../src/domain/game-engine/engine';

export type StateGetter = (gameId: string) => GameState | null;

export type CommandDispatcher = (
  gameId: string,
  command: GameCommand,
  actorUid: string
) => Promise<EngineResult>;

export interface CpuControllerTimingConfig {
  rollDelay: number;
  jailDelay: number;
  managementDelay: number;
  debtResolutionDelay: number;
  postLandingBaseDelay: number;
  stepAnimationMs: number;
  diceTumbleMs: number;
}

export const DEFAULT_CPU_TIMING: CpuControllerTimingConfig = {
  rollDelay: 1200,
  jailDelay: 1200,
  managementDelay: 1000,
  debtResolutionDelay: 800,
  postLandingBaseDelay: 1000,
  stepAnimationMs: 380,
  diceTumbleMs: 600,
};

export const FAST_CPU_TIMING: CpuControllerTimingConfig = {
  rollDelay: 40,
  jailDelay: 40,
  managementDelay: 40,
  debtResolutionDelay: 30,
  postLandingBaseDelay: 40,
  stepAnimationMs: 10,
  diceTumbleMs: 20,
};

interface GameCpuSession {
  gameId: string;
  lockedTurnId: number | null;
  lockedPlayerUid: string | null;
  status: 'IDLE' | 'HANDOFF' | 'WAITING_FOR_TURN' | 'DECIDING' | 'ACTION_PENDING' | 'WAITING_FOR_RESULT';
  activeTimer: NodeJS.Timeout | null;
  isProcessing: boolean;
  currentActionId: string | null;
  retryCount: number;
}

export class CpuController {
  private sessions: Map<string, GameCpuSession> = new Map();
  private stateGetter: StateGetter | null = null;
  private dispatcher: CommandDispatcher | null = null;
  private timingConfig: CpuControllerTimingConfig;

  constructor(
    stateGetter?: StateGetter,
    dispatcher?: CommandDispatcher,
    timingConfig?: Partial<CpuControllerTimingConfig>
  ) {
    if (stateGetter) this.stateGetter = stateGetter;
    if (dispatcher) this.dispatcher = dispatcher;
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    this.timingConfig = {
      ...(isTest ? FAST_CPU_TIMING : DEFAULT_CPU_TIMING),
      ...(timingConfig || {}),
    };
  }

  public setDependencies(stateGetter: StateGetter, dispatcher: CommandDispatcher): void {
    this.stateGetter = stateGetter;
    this.dispatcher = dispatcher;
  }

  public setTimingConfig(config: Partial<CpuControllerTimingConfig>): void {
    this.timingConfig = { ...this.timingConfig, ...config };
  }

  /**
   * Evaluates the latest authoritative game state to see if a CPU player needs to act.
   * Enforces session locks, movement pauses, and handoff delays.
   */
  public onGameStateChanged(gameState: GameState): void {
    const gameId = gameState.gameId;

    if (gameState.status === 'COMPLETED') {
      this.stopGame(gameId);
      return;
    }

    const session = this.getSession(gameId);

    // If turn handoff delay is currently active (e.g. 2-second inter-turn gap), CPU must not start
    if (gameState.handoff?.isActive) {
      session.status = 'HANDOFF';
      this.clearGameTimer(gameId);
      return;
    }

    // If token movement animation is currently active, CPU must wait until pawn reaches destination
    if (gameState.movement && !gameState.movement.isComplete) {
      session.status = 'WAITING_FOR_RESULT';
      this.clearGameTimer(gameId);
      return;
    }

    // Determine if any computer player has an active turn or financial debt responsibility
    const activeCpu = this.getActiveCpuPlayer(gameState);
    if (!activeCpu) {
      this.clearGameTimer(gameId);
      session.status = 'WAITING_FOR_TURN';
      session.lockedTurnId = null;
      session.lockedPlayerUid = null;
      return;
    }

    // Session execution lock: If an action is already in flight, do not start overlapping executions
    if (session.isProcessing || session.status === 'ACTION_PENDING') {
      return;
    }

    // Acquire session lock for current game turn and player
    session.lockedTurnId = gameState.turnNumber;
    session.lockedPlayerUid = activeCpu.uid;

    // Schedule next decision with human-like natural delay
    this.scheduleNextAction(gameState, activeCpu);
  }

  /**
   * Identifies whether the current turn or financial debt belongs to a computer player.
   */
  private getActiveCpuPlayer(gameState: GameState): PlayerState | null {
    // Check 1: Mandatory financial obligation has highest priority
    if (gameState.phase === 'ACTION_REQUIRED' && gameState.pendingFinancialObligation) {
      const debtorUid = gameState.pendingFinancialObligation.debtorUid;
      const debtor = gameState.players.find((p) => p.uid === debtorUid);
      if (debtor && (debtor.isCpu || debtor.playerType === 'COMPUTER') && !debtor.isBankrupt && !debtor.isDisqualified) {
        return debtor;
      }
      return null;
    }

    // Check 2: Active turn player
    const active = gameState.players.find((p) => p.uid === gameState.currentPlayerUid);
    if (active && (active.isCpu || active.playerType === 'COMPUTER') && !active.isBankrupt && !active.isDisqualified) {
      return active;
    }

    return null;
  }

  /**
   * Computes the natural decision delay based on phase and animation pacing.
   */
  private calculateDelay(gameState: GameState): number {
    if (gameState.phase === 'ACTION_REQUIRED') {
      return this.timingConfig.debtResolutionDelay;
    }

    if (gameState.phase === 'AWAIT_ROLL') {
      return this.timingConfig.rollDelay;
    }

    if (gameState.phase === 'JAIL_DECISION') {
      return this.timingConfig.jailDelay;
    }

    if (gameState.phase === 'PROPERTY_DECISION') {
      return this.timingConfig.postLandingBaseDelay;
    }

    if (gameState.phase === 'MANAGEMENT' || gameState.phase === 'TURN_END') {
      return this.timingConfig.managementDelay;
    }

    return 1000;
  }

  /**
   * Schedules execution of the next CPU action.
   */
  private scheduleNextAction(gameState: GameState, cpuPlayer: PlayerState): void {
    const gameId = gameState.gameId;
    this.clearGameTimer(gameId);

    const session = this.getSession(gameId);
    session.status = 'DECIDING';

    const delay = this.calculateDelay(gameState);

    session.activeTimer = setTimeout(async () => {
      session.activeTimer = null;
      await this.executeCpuAction(gameId, cpuPlayer.uid, gameState.turnNumber);
    }, delay);
  }

  /**
   * Evaluates decision and dispatches command to GameManager under session lock.
   */
  private async executeCpuAction(
    gameId: string,
    cpuUid: string,
    scheduledTurnNumber: number
  ): Promise<void> {
    const session = this.getSession(gameId);
    if (!this.dispatcher || !this.stateGetter) return;

    // Verify session lock matches scheduled turn and player
    if (session.lockedTurnId !== scheduledTurnNumber || session.lockedPlayerUid !== cpuUid) {
      session.status = 'IDLE';
      return;
    }

    session.isProcessing = true;
    session.status = 'ACTION_PENDING';

    try {
      const freshState = this.stateGetter(gameId);
      if (!freshState || freshState.status === 'COMPLETED') {
        this.stopGame(gameId);
        session.isProcessing = false;
        session.status = 'IDLE';
        return;
      }

      // Check if turn handoff or movement is active in fresh state
      if (freshState.handoff?.isActive || (freshState.movement && !freshState.movement.isComplete)) {
        session.isProcessing = false;
        session.status = freshState.handoff?.isActive ? 'HANDOFF' : 'WAITING_FOR_RESULT';
        return;
      }

      // If turn number advanced while scheduled, discard obsolete execution
      if (freshState.turnNumber !== scheduledTurnNumber) {
        session.isProcessing = false;
        session.status = 'WAITING_FOR_TURN';
        return;
      }

      const freshCpu = freshState.players.find((p) => p.uid === cpuUid);
      if (!freshCpu || freshCpu.isBankrupt || freshCpu.isDisqualified) {
        session.isProcessing = false;
        session.status = 'IDLE';
        return;
      }

      // Check if it is still this CPU's responsibility
      const activeCpu = this.getActiveCpuPlayer(freshState);
      if (!activeCpu || activeCpu.uid !== cpuUid) {
        session.isProcessing = false;
        session.status = 'WAITING_FOR_TURN';
        return;
      }

      const decision = decideNextAction(freshState, freshCpu);
      if (!decision) {
        session.isProcessing = false;
        session.status = 'IDLE';
        return;
      }

      const commandId = `cmd_cpu_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      session.currentActionId = commandId;

      const command: GameCommand = {
        commandId,
        roomId: freshState.roomId,
        gameId: freshState.gameId,
        expectedVersion: freshState.version,
        type: decision.type,
        payload: decision.payload || {},
      };

      session.status = 'WAITING_FOR_RESULT';
      await this.dispatcher(gameId, command, cpuUid);
      session.isProcessing = false;
      session.currentActionId = null;
      session.retryCount = 0;
    } catch (err) {
      console.warn(`[CpuController] Error executing CPU action for ${cpuUid} in ${gameId}:`, err);
      session.isProcessing = false;
      session.currentActionId = null;
      session.retryCount++;

      if (session.retryCount <= 2) {
        // Safe bounded retry
        setTimeout(() => {
          this.executeCpuAction(gameId, cpuUid, scheduledTurnNumber);
        }, 1000);
      } else {
        session.status = 'IDLE';
        session.retryCount = 0;
      }
    }
  }

  private getSession(gameId: string): GameCpuSession {
    let session = this.sessions.get(gameId);
    if (!session) {
      session = {
        gameId,
        lockedTurnId: null,
        lockedPlayerUid: null,
        status: 'IDLE',
        activeTimer: null,
        isProcessing: false,
        currentActionId: null,
        retryCount: 0,
      };
      this.sessions.set(gameId, session);
    }
    return session;
  }

  private clearGameTimer(gameId: string): void {
    const session = this.sessions.get(gameId);
    if (session && session.activeTimer) {
      clearTimeout(session.activeTimer);
      session.activeTimer = null;
    }
  }

  public stopGame(gameId: string): void {
    this.clearGameTimer(gameId);
    this.sessions.delete(gameId);
  }

  public clearAll(): void {
    for (const [gameId] of this.sessions.entries()) {
      this.stopGame(gameId);
    }
  }
}
