/**
 * Indian Monopoly - Game State Store (Client)
 * Authoritative Server Synchronization for Multiplayer.
 * Dispatches multiplayer game actions to the LAN Node.js server and drives presentation
 * animations (dice roll, stepping pawn, audio triggers) based on server-broadcasted events.
 */

import { create } from 'zustand';
import {
  EmoteReaction,
  GameCommand,
  GameEvent,
  GameState,
  RoomMember,
  WalkingAnimationState,
} from '@/domain/game-types';
import { createInitialGame } from '@/domain/game-engine/create-initial-game';
import { sound } from '@/lib/audio/sound-engine';
import { HostCustomRules, GAME_CONSTANTS } from '@/domain/ruleset';
import { getSocket } from '@/lib/socket/socket-client';
import { useToastStore } from '@/components/feedback/toast-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { clientPerf } from '@/lib/diagnostics/perf-telemetry';

interface GameStoreState {
  gameState: GameState | null;
  events: GameEvent[];
  activeEmotes: EmoteReaction[];
  selectedSpaceIndex: number | null;
  isRolling: boolean;
  pendingCommandType: GameCommand['type'] | null;
  walkingAnimation: WalkingAnimationState | null;
  isLiveMultiplayer: boolean;
  error: string | null;

  // Actions
  initializeGameFromRoom: (
    roomId: string,
    gameId: string,
    members: Record<string, RoomMember>,
    customRules?: HostCustomRules
  ) => () => void;
  setLiveGameState: (state: GameState) => void;
  selectSpace: (index: number | null) => void;
  dispatchAction: (commandType: GameCommand['type'], payload?: Record<string, unknown>) => void;
  sendEmote: (emote: string, senderName: string) => void;
  tickTurnTimer: () => void;
  setError: (error: string | null) => void;
  dismissError: () => void;
  /** Closes a finished game: tells the host to delete it and wipes it from this device. */
  closeFinishedGame: (gameId: string) => void;
}

let activeWalkingTimer: NodeJS.Timeout | null = null;
let pendingServerState: GameState | null = null;
let pendingStateSafetyTimer: NodeJS.Timeout | null = null;
let lastDispatchedCommandId: string | null = null;
const processedRollIds = new Set<string>();
/** The only game this client is showing. Broadcasts for any other game are ignored. */
let activeGameId: string | null = null;

/** Drops every piece of in-flight presentation state (held server states, timers, roll ids). */
function resetTransientGameState(): void {
  if (activeWalkingTimer) {
    clearInterval(activeWalkingTimer);
    activeWalkingTimer = null;
  }
  if (pendingStateSafetyTimer) {
    clearTimeout(pendingStateSafetyTimer);
    pendingStateSafetyTimer = null;
  }
  pendingServerState = null;
  lastDispatchedCommandId = null;
  processedRollIds.clear();
}

/** Switches the client to a new game, flushing everything that belonged to the previous one. */
function activateGame(gameId: string): boolean {
  if (activeGameId === gameId) return false;
  resetTransientGameState();
  activeGameId = gameId;
  return true;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: null,
  events: [],
  activeEmotes: [],
  selectedSpaceIndex: null,
  isRolling: false,
  pendingCommandType: null,
  walkingAnimation: null,
  isLiveMultiplayer: true,
  error: null,

  // ==========================================
  // AUTHORITATIVE LIVE MULTIPLAYER INITIALIZATION & SOCKET SYNC
  // ==========================================

  initializeGameFromRoom: (roomId, gameId, members, customRules) => {
    const socket = getSocket();

    // Switching games flushes all state from the previous game before anything else happens
    const switched = activateGame(gameId);
    const current = get().gameState;
    if (switched || !current || current.gameId !== gameId) {
      const initial = createInitialGame(roomId, gameId, members, customRules);
      const welcomeEvent: GameEvent = {
        sequence: 1,
        commandId: 'init_' + Date.now(),
        actorUid: 'system',
        type: 'START_GAME',
        summary: `Welcome to Indian Monopoly! ${Object.keys(members).length} tycoons assembled. Let the trading begin!`,
        payload: {},
        createdAt: Date.now(),
        versionAfter: 1,
      };

      set({
        gameState: initial,
        events: [welcomeEvent],
        activeEmotes: [],
        selectedSpaceIndex: null,
        isRolling: false,
        pendingCommandType: null,
        isLiveMultiplayer: true,
        error: null,
      });
    }

    // Handle authoritative game state broadcast from server
    const handleServerGameState = (nextState: GameState) => {
      // Ignore broadcasts from any other game this connection may still hear about
      if (!nextState || nextState.gameId !== gameId || activeGameId !== gameId) return;
      // Never step backwards: an out-of-order older snapshot must not overwrite a newer one
      const shown = get().gameState;
      const newestKnown = Math.max(shown?.gameId === gameId ? shown.version ?? 0 : 0, pendingServerState?.version ?? 0);
      if ((nextState.version ?? 0) < newestKnown) return;
      // If we are currently tumbling dice or walking, hold committing state until destination is reached
      const { isRolling, walkingAnimation } = get();
      if (isRolling || walkingAnimation) {
        pendingServerState = nextState;
        if (!pendingStateSafetyTimer) {
          pendingStateSafetyTimer = setTimeout(() => {
            const held = pendingServerState;
            pendingServerState = null;
            pendingStateSafetyTimer = null;
            if (held) {
              set({ gameState: held, isRolling: false, walkingAnimation: null });
            }
          }, 5000);
        }
        return;
      }

      // If incoming state contains a fresh dice roll that has not yet completed walking animation,
      // hold state to prevent snapping the token prematurely to newPos before walking begins
      if (nextState.dice?.rollId && !processedRollIds.has(nextState.dice.rollId)) {
        pendingServerState = nextState;
        if (!pendingStateSafetyTimer) {
          pendingStateSafetyTimer = setTimeout(() => {
            const held = pendingServerState;
            pendingServerState = null;
            pendingStateSafetyTimer = null;
            if (held) {
              set({ gameState: held, isRolling: false, walkingAnimation: null });
            }
          }, 5000);
        }
        return;
      }

      if (pendingStateSafetyTimer) {
        clearTimeout(pendingStateSafetyTimer);
        pendingStateSafetyTimer = null;
      }

      set({ gameState: nextState, isLiveMultiplayer: true });
      if (lastDispatchedCommandId) {
        clientPerf.recordActionRendered(lastDispatchedCommandId);
        lastDispatchedCommandId = null;
      }
    };

    /** Shows the START salary immediately (balance, history entry, toast) while the pawn is still walking. */
    const creditStartSalaryNow = (actorUid: string, rollId: string) => {
      const shown = get().gameState;
      if (!shown || shown.gameId !== gameId) return;
      const held = pendingServerState && pendingServerState.gameId === gameId ? pendingServerState : null;
      const shownTxIds = new Set((shown.transactions || []).map((t) => t.transactionId));
      const tx = held?.transactions
        ?.slice()
        .reverse()
        .find((t) => t.type === 'START_REWARD' && t.playerUid === actorUid && !shownTxIds.has(t.transactionId));
      // The authoritative result is known and has no START salary (e.g. sent to jail): nothing to credit
      if (held && !tx) return;
      const amount = tx?.amount ?? shown.rules?.passStartReward ?? GAME_CONSTANTS.START_REWARD;
      set((st) => {
        if (!st.gameState || st.gameState.gameId !== gameId) return st;
        return {
          gameState: {
            ...st.gameState,
            players: st.gameState.players.map((p) => (p.uid === actorUid ? { ...p, cash: p.cash + amount } : p)),
            transactions: tx ? [...(st.gameState.transactions || []), tx] : st.gameState.transactions,
          },
        };
      });
      if (actorUid === useAuthStore.getState().player?.uid) {
        useToastStore.getState().addToast({
          eventId: tx?.transactionId || `start_${rollId}`,
          type: 'success',
          title: 'START Salary',
          message: `You received ₹${amount.toLocaleString('en-IN')}`,
          amount,
          flow: 'CREDIT',
        });
      }
    };

    // Handle authoritative game event broadcast from server
    const handleServerGameEvent = (event: GameEvent) => {
      if (activeGameId !== gameId || (event.gameId && event.gameId !== gameId)) return;
      set((s) => ({
        events: [event, ...s.events].slice(0, 50),
      }));

      // Presentation triggers based on authoritative event
      if (event.type === 'ROLL_DICE' || event.type === 'TRY_DOUBLES') {
        const { gameState } = get();
        if (!gameState) return;

        const payload = event.payload as {
          rollId?: string;
          die1?: number;
          die2?: number;
          d1?: number;
          d2?: number;
          total?: number;
          steps?: number;
          oldPos?: number;
          newPos?: number;
          isDouble?: boolean;
          consecutiveDoubles?: number;
        } | undefined;

        const rollId = payload?.rollId || `roll_${event.sequence}`;
        if (processedRollIds.has(rollId)) {
          return; // Idempotent: do not replay movement
        }
        processedRollIds.add(rollId);

        const actorUid = event.actorUid;
        const isTryDoubles = event.type === 'TRY_DOUBLES';
        const isDouble = Boolean(payload?.isDouble);

        const d1 = Number(payload?.die1 ?? payload?.d1 ?? 1);
        const d2 = Number(payload?.die2 ?? payload?.d2 ?? 1);
        const totalSteps = Number(payload?.steps ?? (payload?.total ?? (d1 + d2)));

        // Authoritative start position: Use payload.oldPos if available to prevent race conditions
        const playerInState = gameState.players.find((p) => p.uid === actorUid);
        const startPos = typeof payload?.oldPos === 'number'
          ? payload.oldPos
          : (playerInState?.position ?? (isTryDoubles ? 10 : 0));

        const targetPos = typeof payload?.newPos === 'number'
          ? payload.newPos
          : (startPos + (isTryDoubles && !isDouble ? 0 : totalSteps)) % 40;

        // Authoritatively update gameState.dice IMMEDIATELY so the dice faces on the board
        // settle on the exact authoritative values without displaying stale or previous-turn numbers
        set((s) => ({
          gameState: s.gameState
            ? {
                ...s.gameState,
                dice: {
                  rollId,
                  first: d1,
                  second: d2,
                  die1: d1,
                  die2: d2,
                  total: d1 + d2,
                  oldPos: startPos,
                  newPos: targetPos,
                  isDouble,
                  consecutiveDoubles: Number(payload?.consecutiveDoubles ?? 0),
                  rolledAt: Date.now(),
                },
              }
            : s.gameState,
          isRolling: true,
        }));

        sound.play('DICE_ROLL');

        // Phase 1: 3D Dice tumble and settle on the authoritative values (snappy 350ms)
        setTimeout(() => {
          set({ isRolling: false });

          // If failed jail double, no movement occurs
          if (isTryDoubles && !isDouble) {
            setTimeout(() => {
              const finalState = pendingServerState;
              pendingServerState = null;
              if (pendingStateSafetyTimer) {
                clearTimeout(pendingStateSafetyTimer);
                pendingStateSafetyTimer = null;
              }
              if (finalState) set({ gameState: finalState });
            }, 180);
            return;
          }

          if (totalSteps <= 0) {
            const finalState = pendingServerState;
            pendingServerState = null;
            if (pendingStateSafetyTimer) {
              clearTimeout(pendingStateSafetyTimer);
              pendingStateSafetyTimer = null;
            }
            if (finalState) set({ gameState: finalState });
            return;
          }

          // Phase 2: Token walking begins ONLY AFTER the roll finishes settling.
          // Sequential step-by-step movement along circular path (280ms per step for an easy-to-follow walk).
          let currentStep = 0;
          let startSalaryShown = false;
          if (activeWalkingTimer) clearInterval(activeWalkingTimer);

          activeWalkingTimer = setInterval(() => {
            currentStep++;
            const nextPos = (startPos + currentStep) % 40;
            const stepsRemaining = totalSteps - currentStep;

            sound.play('PAWN_STEP');

            set({
              walkingAnimation: {
                uid: actorUid,
                currentPos: nextPos,
                targetPos,
                stepsRemaining,
              },
            });

            // Crossing (or landing on) START: credit the salary the moment the pawn reaches it.
            // Everything else (rent, tax, purchases) is applied when the pawn arrives at its tile.
            if (nextPos === 0 && !startSalaryShown) {
              startSalaryShown = true;
              creditStartSalaryNow(actorUid, rollId);
            }

            // Phase 3: Token reaches destination (snappy 180ms settle)
            if (currentStep >= totalSteps) {
              if (activeWalkingTimer) clearInterval(activeWalkingTimer);
              activeWalkingTimer = null;

              setTimeout(() => {
                const finalState = pendingServerState;
                pendingServerState = null;
                if (pendingStateSafetyTimer) {
                  clearTimeout(pendingStateSafetyTimer);
                  pendingStateSafetyTimer = null;
                }
                set({
                  walkingAnimation: null,
                  ...(finalState ? { gameState: finalState } : {}),
                });
              }, 180);
            }
          }, 280);
        }, 350);
      } else if (event.type === 'MORTGAGE') {
        const mortgageAmount = (event.payload as { mortgageAmount?: number })?.mortgageAmount;
        const myUid = useAuthStore.getState().player?.uid;
        useToastStore.getState().addToast({
          eventId: event.commandId || `mortgage_${event.sequence}`,
          type: event.actorUid === myUid ? 'warning' : 'info',
          title: 'Property Mortgaged',
          message: event.summary,
          amount: mortgageAmount,
          flow: event.actorUid === myUid ? 'CREDIT' : undefined,
        });
      } else if (event.type === 'UNMORTGAGE') {
        const cost = (event.payload as { cost?: number })?.cost;
        const myUid = useAuthStore.getState().player?.uid;
        useToastStore.getState().addToast({
          eventId: event.commandId || `unmortgage_${event.sequence}`,
          type: event.actorUid === myUid ? 'success' : 'info',
          title: 'Property Reacquired',
          message: event.summary,
          amount: cost,
          flow: event.actorUid === myUid ? 'DEBIT' : undefined,
        });
      } else if (event.type === 'RESOLVE_OBLIGATION') {
        const myUid = useAuthStore.getState().player?.uid;
        useToastStore.getState().addToast({
          eventId: event.commandId || `resolve_${event.sequence}`,
          type: event.actorUid === myUid ? 'success' : 'info',
          title: 'Payment Completed',
          message: event.summary,
        });
      } else if (event.type === 'USE_JAIL_CARD') {
        const myUid = useAuthStore.getState().player?.uid;
        useToastStore.getState().addToast({
          eventId: event.commandId || `jailcard_${event.sequence}`,
          type: event.actorUid === myUid ? 'success' : 'info',
          title: 'Bail Key Used',
          message: event.summary,
        });
      } else if (event.type === 'GIVE_UP') {
        useToastStore.getState().addToast({
          eventId: event.commandId || `giveup_${event.sequence}`,
          type: 'error',
          title: 'Player Disqualified',
          message: event.summary,
        });
      }
    };

    // Handle authoritative server turn timer ticks
    const handleServerTimer = (data: {
      gameId?: string;
      remaining: number;
      activeUid: string;
      isPaused?: boolean;
      phase?: string;
      handoff?: boolean;
      elapsedSeconds?: number;
    }) => {
      if (activeGameId !== gameId || (data.gameId && data.gameId !== gameId)) return;
      set((s) => {
        if (!s.gameState || s.gameState.gameId !== gameId) return s;
        return {
          gameState: {
            ...s.gameState,
            turnTimeRemaining: data.remaining,
            isTimerPaused: data.isPaused ?? s.gameState.isTimerPaused,
            ...(typeof data.elapsedSeconds === 'number'
              ? { totalGameTimeSeconds: data.elapsedSeconds }
              : {}),
          },
        };
      });
    };

    // Handle incoming emote reactions
    const handleReaction = (reaction: {
      id: string;
      roomId: string;
      senderUid: string;
      senderName: string;
      emote: string;
      timestamp: number;
    }) => {
      if (reaction.roomId && reaction.roomId !== roomId) return;
      sound.play('EMOTE');
      const emoteObj: EmoteReaction = {
        id: reaction.id,
        roomId: reaction.roomId,
        senderUid: reaction.senderUid,
        senderName: reaction.senderName,
        emote: reaction.emote,
        timestamp: reaction.timestamp,
      };

      set((s) => ({
        activeEmotes: [...s.activeEmotes, emoteObj],
      }));

      setTimeout(() => {
        set((s) => ({
          activeEmotes: s.activeEmotes.filter((e) => e.id !== emoteObj.id),
        }));
      }, 5000);
    };

    socket.on('game:state', handleServerGameState);
    socket.on('game:event', handleServerGameEvent);
    socket.on('game:timer', handleServerTimer);
    socket.on('reaction:received', handleReaction);

    return () => {
      socket.off('game:state', handleServerGameState);
      socket.off('game:event', handleServerGameEvent);
      socket.off('game:timer', handleServerTimer);
      socket.off('reaction:received', handleReaction);
      if (activeWalkingTimer) {
        clearInterval(activeWalkingTimer);
        activeWalkingTimer = null;
      }
    };
  },

  setLiveGameState: (state: GameState) => {
    if (!state) return;
    if (activateGame(state.gameId)) {
      // A different game: start from a clean slate so nothing from the previous game leaks in
      set({
        gameState: state,
        events: [],
        activeEmotes: [],
        selectedSpaceIndex: null,
        isRolling: false,
        pendingCommandType: null,
        walkingAnimation: null,
        isLiveMultiplayer: true,
        error: null,
      });
      return;
    }
    // Same game: never roll back to an older version than the one already shown
    const current = get().gameState;
    if (current && current.gameId === state.gameId && (current.version ?? 0) > (state.version ?? 0)) return;
    set({ gameState: state, isLiveMultiplayer: true });
  },

  selectSpace: (index: number | null) => {
    set({ selectedSpaceIndex: index });
  },

  // ==========================================
  // DISPATCH ACTION (AUTHORITATIVE SERVER EXECUTION)
  // ==========================================

  dispatchAction: (commandType, payload = {}) => {
    const { gameState, isRolling, walkingAnimation, pendingCommandType } = get();
    if (
      !gameState ||
      isRolling ||
      walkingAnimation ||
      pendingCommandType !== null ||
      gameState.handoff?.isActive ||
      (gameState.movement && !gameState.movement.isComplete)
    ) {
      return;
    }

    const commandId = 'cmd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const command: GameCommand = {
      commandId,
      roomId: gameState.roomId,
      gameId: gameState.gameId,
      expectedVersion: gameState.version,
      type: commandType,
      payload,
    };

    lastDispatchedCommandId = commandId;
    clientPerf.recordActionStart(commandId, commandType);

    // Provide immediate UI feedback and prevent duplicate command emissions
    set({ pendingCommandType: commandType });

    // Safety timeout to auto-reset pending state if connection drops or server fails
    const safetyTimeout = setTimeout(() => {
      if (get().pendingCommandType === commandType) {
        set({ pendingCommandType: null });
      }
    }, 6000);

    const socket = getSocket();
    socket.emit('game:command', command, (response) => {
      clearTimeout(safetyTimeout);
      set({ pendingCommandType: null });
      clientPerf.recordActionAck(commandId);

      if (!response.ok) {
        const errMsg = response.error || 'Server rejected action';
        if (errMsg.includes('Stale version')) {
          console.warn('[GameCommand] Stale version detected, server state will auto-sync on next event:', errMsg);
          return;
        }
        set({ error: errMsg });
      }
    });
  },

  sendEmote: (emote: string, _senderName: string) => {
    const socket = getSocket();
    socket.emit('reaction:send', { emote });
  },

  tickTurnTimer: () => {
    // Authoritative server manages turn countdown via synchronized 'game:timer' broadcasts
  },

  setError: (error: string | null) => set({ error }),

  dismissError: () => set({ error: null }),

  closeFinishedGame: (gameId: string) => {
    try {
      getSocket().emit('game:close', { gameId }, () => {});
    } catch {
      // socket unavailable — the host still deletes the game after its retention window
    }
    resetTransientGameState();
    activeGameId = null;
    set({
      gameState: null,
      events: [],
      selectedSpaceIndex: null,
      isRolling: false,
      pendingCommandType: null,
      walkingAnimation: null,
      error: null,
    });
  },
}));
