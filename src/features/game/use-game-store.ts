/**
 * Indian Monopoly - Game State Store (Client)
 * Authoritative Server Synchronization for Multiplayer & Offline Sandbox for Practice.
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
import { applyGameCommand } from '@/domain/game-engine/engine';
import { sound } from '@/lib/audio/sound-engine';
import { HostCustomRules } from '@/domain/ruleset';
import { getSocket } from '@/lib/socket/socket-client';

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
  initializeDemoGame: (userName?: string, userUid?: string) => void;
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
  isLiveMultiplayer: false,
  error: null,

  // ==========================================
  // PRACTICE / SANDBOX INITIALIZATION
  // ==========================================

  initializeDemoGame: (userName = 'You (Maharaja)', userUid = 'player_1') => {
    const activeUid = userUid || 'player_1';
    const demoMembers: Record<string, RoomMember> = {
      [activeUid]: {
        uid: activeUid,
        displayName: userName,
        photoURL: null,
        isReady: true,
        joinedAt: Date.now(),
        colorToken: '#C85A32', // Terracotta
      },
      player_2: {
        uid: 'player_2',
        displayName: 'Priya (Mumbai)',
        photoURL: null,
        isReady: true,
        joinedAt: Date.now() + 1,
        colorToken: '#1A2B4C', // Navy
      },
      player_3: {
        uid: 'player_3',
        displayName: 'Vikram (Delhi)',
        photoURL: null,
        isReady: true,
        joinedAt: Date.now() + 2,
        colorToken: '#E5A93C', // Gold
      },
      player_4: {
        uid: 'player_4',
        displayName: 'Ananya (Bengaluru)',
        photoURL: null,
        isReady: true,
        joinedAt: Date.now() + 3,
        colorToken: '#2D6A4F', // Emerald
      },
    };

    const initial = createInitialGame('demo_room', 'demo_game', demoMembers);
    const welcomeEvent: GameEvent = {
      sequence: 1,
      commandId: 'init',
      actorUid: 'system',
      type: 'START_GAME',
      summary: 'Welcome to Indian Monopoly! 4 players assembled. Let the trading begin!',
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
      isLiveMultiplayer: false,
      error: null,
    });
  },

  // ==========================================
  // LIVE MULTIPLAYER INITIALIZATION & SOCKET SYNC
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
  // DISPATCH ACTION (LAN MULTIPLAYER vs PRACTICE)
  // ==========================================

  dispatchAction: (commandType, payload = {}) => {
    const { gameState, isRolling, walkingAnimation, isLiveMultiplayer } = get();
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

    // 1. LIVE MULTIPLAYER: Authoritative Server Execution
    if (isLiveMultiplayer) {
      const socket = getSocket();
      socket.emit('game:command', command, (response) => {
        if (!response.ok) {
          const errMsg = response.error || 'Server rejected action';
          sound.play('GO_TO_JAIL');
          set({ error: errMsg });
        }
      });
      return;
    }

    // 2. OFFLINE PRACTICE MODE: Local Sandbox Execution
    if (commandType === 'ROLL_DICE') {
      set({ isRolling: true });
      sound.play('DICE_ROLL');

      setTimeout(() => {
        try {
          const result = applyGameCommand(gameState, command, gameState.currentPlayerUid);
          const activeUid = gameState.currentPlayerUid;
          const activeP = gameState.players.find((p) => p.uid === activeUid);
          const startPos = activeP?.position ?? 0;
          const endPos =
            result.nextState.players.find((p) => p.uid === activeUid)?.position ?? startPos;

          if (
            result.nextState.players.find((p) => p.uid === activeUid)?.inJail &&
            !activeP?.inJail
          ) {
            sound.play('GO_TO_JAIL');
            set((s) => ({
              gameState: result.nextState,
              events: [result.event, ...s.events].slice(0, 50),
              isRolling: false,
              walkingAnimation: null,
              error: null,
            }));
            return;
          }

          const totalSteps = result.nextState.dice
            ? result.nextState.dice.first + result.nextState.dice.second
            : (endPos - startPos + 40) % 40;

          set({ isRolling: false });

          if (totalSteps <= 0) {
            set((s) => ({
              gameState: result.nextState,
              events: [result.event, ...s.events].slice(0, 50),
              walkingAnimation: null,
              error: null,
            }));
            return;
          }

          let currentStep = 0;
          const stepInterval = setInterval(() => {
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
                uid: activeUid,
                currentPos: nextPos,
                targetPos: endPos,
                stepsRemaining,
              },
            });

            if (currentStep >= totalSteps) {
              clearInterval(stepInterval);
              setTimeout(() => {
                set((s) => ({
                  gameState: result.nextState,
                  events: [result.event, ...s.events].slice(0, 50),
                  walkingAnimation: null,
                  error: null,
                }));
              }, 400);
            }
          }, 450);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Action failed';
          set({ error: message, isRolling: false, walkingAnimation: null });
        }
      }, 350);
      return;
    }

    try {
      const result = applyGameCommand(gameState, command, gameState.currentPlayerUid);

      if (commandType === 'BUY_PROPERTY') {
        sound.play('BUY_PROPERTY');
      } else if (commandType === 'PAY_BAIL') {
        sound.play('PAY_RENT');
      }

      set((s) => ({
        gameState: result.nextState,
        events: [result.event, ...s.events].slice(0, 50),
        error: null,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      set({ error: message });
    }
  },

  sendEmote: (emote: string, senderName: string) => {
    const { gameState, isLiveMultiplayer } = get();
    sound.play('EMOTE');

    if (isLiveMultiplayer) {
      const socket = getSocket();
      socket.emit('reaction:send', { emote });
      return;
    }

    // Local Practice Mode reaction
    const newReaction: EmoteReaction = {
      id: 'reaction_' + Date.now() + Math.random(),
      roomId: gameState?.roomId || 'practice',
      senderUid: gameState?.currentPlayerUid || 'me',
      senderName,
      emote,
      timestamp: Date.now(),
    };

    set((state) => ({
      activeEmotes: [...state.activeEmotes, newReaction],
    }));

    setTimeout(() => {
      set((state) => ({
        activeEmotes: state.activeEmotes.filter((e) => e.id !== newReaction.id),
      }));
    }, 5000);
  },

  tickTurnTimer: () => {
    const { gameState, isRolling, walkingAnimation, isLiveMultiplayer } = get();
    // Do NOT run local timer ticker during live multiplayer (authoritative server manages it)
    if (isLiveMultiplayer || !gameState || gameState.status === 'COMPLETED' || isRolling || walkingAnimation) {
      return;
    }

    const remaining = (gameState.turnTimeRemaining ?? 30) - 1;

    if (remaining <= 0) {
      if (gameState.phase === 'AWAIT_ROLL') {
        get().dispatchAction('ROLL_DICE');
      } else if (gameState.phase === 'PROPERTY_DECISION') {
        get().dispatchAction('DECLINE_PROPERTY');
      } else if (gameState.phase === 'MANAGEMENT' || gameState.phase === 'TURN_END') {
        get().dispatchAction('END_TURN');
      } else if (gameState.phase === 'JAIL_DECISION') {
        get().dispatchAction('TRY_DOUBLES');
      }
    } else {
      set((state) => ({
        gameState: state.gameState
          ? { ...state.gameState, turnTimeRemaining: remaining }
          : null,
      }));
    }
  },

  dismissError: () => set({ error: null }),
}));
