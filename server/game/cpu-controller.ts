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

import { randomUUID } from '../lib/isomorphic-crypto';
import { isTestEnv } from '../lib/runtime-env';
import { GameCommand, GameState, PlayerState } from '../../src/domain/game-types';
import { decideNextAction, CpuActionDecision } from '../../src/domain/game-engine/cpu-decision-engine';
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
  rollDelay: 600,
  jailDelay: 600,
  managementDelay: 500,
  debtResolutionDelay: 400,
  postLandingBaseDelay: 500,
  stepAnimationMs: 200,
  diceTumbleMs: 350,
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
    const isTest = isTestEnv();
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
    if (!gameState || !gameState.gameId) return;
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

    // Session execution lock: If an action is already in flight, do not start overlapping executions
    if (session.isProcessing || session.status === 'ACTION_PENDING') {
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

    // Acquire session lock for current game turn and player
    session.lockedTurnId = gameState.turnNumber;
    session.lockedPlayerUid = activeCpu.uid;

    // Schedule next decision with human-like natural delay
    this.scheduleNextAction(gameState, activeCpu);
  }

  /**
   * Identifies whether the current turn or financial debt belongs to a computer player
   * or a temporarily bot-controlled human player.
   */
  private getActiveCpuPlayer(gameState: GameState): PlayerState | null {
    const isPlayerEligible = (p: PlayerState) =>
      Boolean(p.isCpu || p.playerType === 'COMPUTER' || p.isBotControlled || p.controllerType === 'BOT');

    // Check 1: Mandatory financial obligation has highest priority
    if (gameState.phase === 'ACTION_REQUIRED' && gameState.pendingFinancialObligation) {
      const debtorUid = gameState.pendingFinancialObligation.debtorUid;
      const debtor = gameState.players.find((p) => p.uid === debtorUid);
      if (debtor && isPlayerEligible(debtor) && !debtor.isBankrupt && !debtor.isDisqualified) {
        return debtor;
      }
      return null;
    }

    // Check 2: Active turn player
    const active = gameState.players.find((p) => p.uid === gameState.currentPlayerUid);
    if (active && isPlayerEligible(active) && !active.isBankrupt && !active.isDisqualified) {
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
   * Evaluates whether all conditions are satisfied for a CPU player to safely end its turn.
   */
  public canSafelyEndTurn(state: GameState, cpuUid: string): boolean {
    // 1. Must be the active player
    if (state.currentPlayerUid !== cpuUid) return false;

    // 2. Game must not be completed
    if (state.status === 'COMPLETED') return false;

    // 3. No active token movement
    if (state.movement && !state.movement.isComplete) return false;

    // 4. No active turn handoff
    if (state.handoff?.isActive) return false;

    // 5. No pending property or generic pending action
    if (state.pendingAction) return false;

    // 6. No pending reacquisition opportunity
    if (state.reacquisitionOpportunity && state.reacquisitionOpportunity.status === 'PENDING') return false;

    // 7. No pending financial debt obligation
    if (state.pendingFinancialObligation) return false;

    // 8. Phase must not be an unresolved mandatory phase
    if (
      state.phase === 'AWAIT_ROLL' ||
      state.phase === 'JAIL_DECISION' ||
      state.phase === 'PROPERTY_DECISION' ||
      state.phase === 'ACTION_REQUIRED' ||
      state.phase === 'AUCTION' ||
      state.phase === 'TRADE_RESPONSE'
    ) {
      return false;
    }

    // 9. Current engine phase must permit turn completion
    if (state.phase === 'MANAGEMENT' || state.phase === 'TURN_END') {
      return true;
    }

    return false;
  }

  /**
   * Generates a safe, legal fallback decision appropriate for the current game phase
   * whenever decision heuristics fail or encounter unexpected state.
   */
  public getSafeFallbackDecision(
    state: GameState,
    cpu: PlayerState
  ): CpuActionDecision | null {
    if (state.status === 'COMPLETED') return null;

    if (state.phase === 'AWAIT_ROLL') {
      return { type: 'ROLL_DICE', reason: 'Safe fallback roll' };
    }

    if (state.phase === 'JAIL_DECISION') {
      if (cpu.jailFreeCards && cpu.jailFreeCards > 0) {
        return { type: 'USE_JAIL_CARD', reason: 'Safe fallback: use jail card' };
      }
      const bailCost = state.rules?.jailBail ?? 500;
      if (cpu.cash >= bailCost) {
        return { type: 'PAY_BAIL', reason: 'Safe fallback: pay bail' };
      }
      return { type: 'TRY_DOUBLES', reason: 'Safe fallback: roll for doubles' };
    }

    if (state.phase === 'PROPERTY_DECISION') {
      return { type: 'DECLINE_PROPERTY', reason: 'Safe fallback: decline property' };
    }

    if (state.phase === 'ACTION_REQUIRED' && state.pendingFinancialObligation) {
      const obligation = state.pendingFinancialObligation;
      if (cpu.cash >= obligation.amountDue) {
        return { type: 'RESOLVE_OBLIGATION', reason: 'Safe fallback: resolve debt' };
      }
      const mortgageable = Object.values(state.properties).find(
        (p) => p.ownerUid === cpu.uid && p.ownershipState === 'OWNED' && (!p.buildings || p.buildings === 0)
      );
      if (mortgageable) {
        return {
          type: 'MORTGAGE',
          payload: { spaceIndex: mortgageable.spaceIndex },
          reason: 'Safe fallback: mortgage asset',
        };
      }
      return { type: 'GIVE_UP', payload: { reason: 'BANKRUPTCY_FALLBACK' }, reason: 'Safe fallback: surrender on debt' };
    }

    if (state.phase === 'MANAGEMENT' || state.phase === 'TURN_END') {
      return { type: 'END_TURN', reason: 'Safe fallback: end turn' };
    }

    return { type: 'END_TURN', reason: 'Emergency fallback: end turn' };
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

    if (session.isProcessing) {
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

      let decision = decideNextAction(freshState, freshCpu);

      // Section 4.2: Explicit null-decision handling
      if (!decision) {
        // Category C: The CPU is no longer the active player
        if (freshState.currentPlayerUid !== cpuUid) {
          session.isProcessing = false;
          session.status = 'WAITING_FOR_TURN';
          session.lockedTurnId = null;
          session.lockedPlayerUid = null;
          return;
        }

        // Category A: CPU has genuinely finished its turn and all conditions allow safe ending
        if (this.canSafelyEndTurn(freshState, cpuUid)) {
          decision = {
            type: 'END_TURN',
            reason: `${freshCpu.displayName} automatically completed turn with no further actions.`,
          };
        } else if (session.retryCount < 2) {
          // Category B: CPU still has an unresolved action or cannot end turn in current phase; retry once
          console.warn(
            `[CpuController] CPU ${cpuUid} received null decision during phase ${freshState.phase}. Retrying decision...`
          );
          session.isProcessing = false;
          session.currentActionId = null;
          session.retryCount++;
          session.status = 'DECIDING';
          setTimeout(() => {
            this.executeCpuAction(gameId, cpuUid, scheduledTurnNumber);
          }, 500);
          return;
        } else {
          // Category D: Fallback safe recovery - ensure turn NEVER halts
          console.warn(
            `[CpuController] [STABILITY] Retries exhausted for CPU ${cpuUid} in phase ${freshState.phase}. Invoking safe phase fallback.`
          );
          decision = this.getSafeFallbackDecision(freshState, freshCpu) || {
            type: 'END_TURN',
            reason: 'Emergency fallback: end turn to prevent stall',
          };
        }
      }

      const commandId = `cmd_cpu_${Date.now()}_${randomUUID().slice(0, 8)}`;
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

      // 1-5. Release action lock, clear current action ID, reset retry counter
      session.isProcessing = false;
      session.currentActionId = null;
      session.retryCount = 0;

      // 6. Retrieve latest authoritative game state through stateGetter
      const latestState = this.stateGetter(gameId);

      // 7. Check whether game is still active
      if (!latestState || latestState.status === 'COMPLETED') {
        this.stopGame(gameId);
        return;
      }

      // 8-9. Re-evaluate authoritative game state to continue turn sequence
      this.onGameStateChanged(latestState);
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

  public cancelPlayerAction(gameId: string, playerUid: string): void {
    const session = this.sessions.get(gameId);
    if (session && session.lockedPlayerUid === playerUid) {
      this.clearGameTimer(gameId);
      session.status = 'IDLE';
      session.lockedPlayerUid = null;
      session.lockedTurnId = null;
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
