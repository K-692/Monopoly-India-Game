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
import { HostCustomRules } from '@/domain/ruleset';
import { getSocket } from '@/lib/socket/socket-client';
import { useToastStore } from '@/components/feedback/toast-store';
import { useAuthStore } from '@/features/auth/use-auth-store';

interface GameStoreState {
  gameState: GameState | null;
  events: GameEvent[];
  activeEmotes: EmoteReaction[];
  selectedSpaceIndex: number | null;
  isRolling: boolean;
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
  dismissError: () => void;
}

let activeWalkingTimer: NodeJS.Timeout | null = null;

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: null,
  events: [],
  activeEmotes: [],
  selectedSpaceIndex: null,
  isRolling: false,
  walkingAnimation: null,
  isLiveMultiplayer: true,
  error: null,

  // ==========================================
  // AUTHORITATIVE LIVE MULTIPLAYER INITIALIZATION & SOCKET SYNC
  // ==========================================

  initializeGameFromRoom: (roomId, gameId, members, customRules) => {
    const socket = getSocket();

    // Check if initial state is already cached
    const current = get().gameState;
    if (!current || current.gameId !== gameId) {
      const initial = createInitialGame(roomId, gameId, members, customRules);
      const welcomeEvent: GameEvent = {
        sequence: 1,
        commandId: 'init_' + Date.now(),
        actorUid: 'system',
        type: 'START_GAME',
        summary: `Welcome to Indian Monopoly! ${Object.keys(members).length} tycoons assembled in Room #${roomId.slice(-6).toUpperCase()}. Let the trading begin!`,
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
        isLiveMultiplayer: true,
        error: null,
      });
    }

    // Handle authoritative game state broadcast from server
    const handleServerGameState = (nextState: GameState) => {
      // If we are currently running a walking animation, hold committing position until animation finishes
      const { walkingAnimation } = get();
      if (walkingAnimation) {
        // Queue latest state to commit when animation completes
        return;
      }
      set({ gameState: nextState, isLiveMultiplayer: true });
    };

    // Handle authoritative game event broadcast from server
    const handleServerGameEvent = (event: GameEvent) => {
      set((s) => ({
        events: [event, ...s.events].slice(0, 50),
      }));

      // Presentation triggers based on authoritative event
      if (event.type === 'ROLL_DICE') {
        const { gameState } = get();
        if (!gameState) return;

        const payload = event.payload as { d1?: number; d2?: number } | undefined;
        const actorUid = event.actorUid;
        const player = gameState.players.find((p) => p.uid === actorUid);
        const startPos = player?.position ?? 0;

        sound.play('DICE_ROLL');
        set({ isRolling: true });

        setTimeout(() => {
          set({ isRolling: false });
          const totalSteps = payload?.d1 && payload?.d2 ? payload.d1 + payload.d2 : 0;
          if (totalSteps <= 0) return;

          const targetPos = (startPos + totalSteps) % 40;
          let currentStep = 0;

          if (activeWalkingTimer) clearInterval(activeWalkingTimer);

          activeWalkingTimer = setInterval(() => {
            currentStep++;
            const nextPos = (startPos + currentStep) % 40;
            const stepsRemaining = totalSteps - currentStep;

            if (nextPos === 0) {
              sound.play('PASS_START');
            } else {
              sound.play('PAWN_STEP');
            }

            set({
              walkingAnimation: {
                uid: actorUid,
                currentPos: nextPos,
                targetPos,
                stepsRemaining,
              },
            });

            if (currentStep >= totalSteps) {
              if (activeWalkingTimer) clearInterval(activeWalkingTimer);
              activeWalkingTimer = null;
              setTimeout(() => {
                set({ walkingAnimation: null });
              }, 400);
            }
          }, 450);
        }, 350);
      } else if (event.type === 'BUY_PROPERTY') {
        sound.play('BUY_PROPERTY');
      } else if (event.type === 'MORTGAGE') {
        const mortgageAmount = (event.payload as { mortgageAmount?: number })?.mortgageAmount;
        const myUid = useAuthStore.getState().player?.uid;
        useToastStore.getState().addToast({
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
          type: event.actorUid === myUid ? 'success' : 'info',
          title: 'Property Reacquired',
          message: event.summary,
          amount: cost,
          flow: event.actorUid === myUid ? 'DEBIT' : undefined,
        });
      } else if (event.type === 'RESOLVE_OBLIGATION') {
        const myUid = useAuthStore.getState().player?.uid;
        useToastStore.getState().addToast({
          type: event.actorUid === myUid ? 'success' : 'info',
          title: 'Payment Completed',
          message: event.summary,
        });
      } else if (event.type === 'GIVE_UP') {
        useToastStore.getState().addToast({
          type: 'error',
          title: 'Player Disqualified',
          message: event.summary,
        });
      } else if (event.type === 'PAY_BAIL') {
        sound.play('PAY_RENT');
      } else if (event.type === 'START_GAME') {
        sound.play('VICTORY');
      }
    };

    // Handle authoritative server turn timer ticks
    const handleServerTimer = (data: { remaining: number; activeUid: string }) => {
      set((s) => {
        if (!s.gameState) return s;
        return {
          gameState: {
            ...s.gameState,
            turnTimeRemaining: data.remaining,
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
    set({ gameState: state, isLiveMultiplayer: true });
  },

  selectSpace: (index: number | null) => {
    sound.play('BUTTON_CLICK');
    set({ selectedSpaceIndex: index });
  },

  // ==========================================
  // DISPATCH ACTION (AUTHORITATIVE SERVER EXECUTION)
  // ==========================================

  dispatchAction: (commandType, payload = {}) => {
    const { gameState, isRolling, walkingAnimation } = get();
    if (!gameState || isRolling || walkingAnimation) return;

    sound.play('BUTTON_CLICK');

    const command: GameCommand = {
      commandId: 'cmd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      roomId: gameState.roomId,
      gameId: gameState.gameId,
      expectedVersion: gameState.version,
      type: commandType,
      payload,
    };

    const socket = getSocket();
    socket.emit('game:command', command, (response) => {
      if (!response.ok) {
        const errMsg = response.error || 'Server rejected action';
        sound.play('GO_TO_JAIL');
        set({ error: errMsg });
      }
    });
  },

  sendEmote: (emote: string, _senderName: string) => {
    sound.play('EMOTE');
    const socket = getSocket();
    socket.emit('reaction:send', { emote });
  },

  tickTurnTimer: () => {
    // Authoritative server manages turn countdown via synchronized 'game:timer' broadcasts
  },

  dismissError: () => set({ error: null }),
}));
