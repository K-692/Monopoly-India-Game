/**
 * Indian Monopoly - Server-Side Autonomous CPU Controller
 *
 * Coordinates turn execution, pacing, decision-making, and command dispatch
 * for computer-controlled players on the authoritative server.
 *
 * Implements the required lifecycle:
 * WAITING_FOR_TURN → DECIDING → ACTION_PENDING → WAITING_FOR_RESULT → NEXT_ACTION/COMPLETE
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
  postLandingBaseDelay: 1200,
  stepAnimationMs: 380,
  diceTumbleMs: 600,
};

export const FAST_CPU_TIMING: CpuControllerTimingConfig = {
  rollDelay: 50,
  jailDelay: 50,
  managementDelay: 50,
  debtResolutionDelay: 40,
  postLandingBaseDelay: 50,
  stepAnimationMs: 10,
  diceTumbleMs: 20,
};

interface GameCpuSession {
  status: 'IDLE' | 'WAITING_FOR_TURN' | 'DECIDING' | 'ACTION_PENDING' | 'WAITING_FOR_RESULT';
  activeTimer: NodeJS.Timeout | null;
  isProcessing: boolean;
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
   */
  public onGameStateChanged(gameState: GameState): void {
    const gameId = gameState.gameId;

    if (gameState.status === 'COMPLETED') {
      this.stopGame(gameId);
      return;
    }

    // Determine if any computer player has an active responsibility
    const activeCpu = this.getActiveCpuPlayer(gameState);
    if (!activeCpu) {
      // It is a human's turn or human's debt -> cancel any pending CPU timer for this game
      this.clearGameTimer(gameId);
      const session = this.getSession(gameId);
      session.status = 'WAITING_FOR_TURN';
      return;
    }

    const session = this.getSession(gameId);

    // If an action is already actively executing, wait for it to complete
    if (session.isProcessing || session.status === 'ACTION_PENDING') {
      return;
    }

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
      // Calculate remaining movement animation duration if dice was rolled this turn
      let animDuration = 0;
      if (gameState.dice) {
        const steps = Number(gameState.dice.total ?? (gameState.dice.first + gameState.dice.second));
        animDuration = this.timingConfig.diceTumbleMs + steps * this.timingConfig.stepAnimationMs;
      }
      return animDuration + this.timingConfig.postLandingBaseDelay;
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
      await this.executeCpuAction(gameId, cpuPlayer.uid);
    }, delay);
  }

  /**
   * Evaluates decision and dispatches command to GameManager.
   */
  private async executeCpuAction(gameId: string, cpuUid: string): Promise<void> {
    const session = this.getSession(gameId);
    if (!this.dispatcher || !this.stateGetter) return;

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

      const command: GameCommand = {
        commandId: `cmd_cpu_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`,
        roomId: freshState.roomId,
        gameId: freshState.gameId,
        expectedVersion: freshState.version,
        type: decision.type,
        payload: decision.payload || {},
      };

      session.status = 'WAITING_FOR_RESULT';
      const result = await this.dispatcher(gameId, command, cpuUid);
      session.isProcessing = false;
      session.retryCount = 0;

      // Result of action updates state and triggers next phase
      if (result && result.nextState) {
        this.onGameStateChanged(result.nextState);
      }
    } catch (err) {
      console.warn(`[CpuController] Error executing CPU action for ${cpuUid} in ${gameId}:`, err);
      session.isProcessing = false;
      session.retryCount++;

      if (session.retryCount <= 2) {
        // Safe bounded retry
        setTimeout(() => {
          this.executeCpuAction(gameId, cpuUid);
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
        status: 'IDLE',
        activeTimer: null,
        isProcessing: false,
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
