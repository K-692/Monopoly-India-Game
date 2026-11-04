import { create } from 'zustand';
import { EmoteReaction, GameCommand, GameEvent, GameState, RoomMember, WalkingAnimationState } from '@/domain/game-types';
import { createInitialGame } from '@/domain/game-engine/create-initial-game';
import { applyGameCommand } from '@/domain/game-engine/engine';
import { sound } from '@/lib/audio/sound-engine';

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
  initializeGameFromRoom: (roomId: string, gameId: string, members: Record<string, RoomMember>) => void;
  setLiveGameState: (state: GameState) => void;
  selectSpace: (index: number | null) => void;
  dispatchAction: (commandType: GameCommand['type'], payload?: Record<string, unknown>) => void;
  sendEmote: (emote: string, senderName: string) => void;
  tickTurnTimer: () => void;
  dismissError: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: null,
  events: [],
  activeEmotes: [],
  selectedSpaceIndex: null,
  isRolling: false,
  walkingAnimation: null,
  isLiveMultiplayer: false,
  error: null,

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

  initializeGameFromRoom: (roomId: string, gameId: string, members: Record<string, RoomMember>) => {
    const initial = createInitialGame(roomId, gameId, members);
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
  },

  setLiveGameState: (state: GameState) => {
    set({ gameState: state, isLiveMultiplayer: true });
  },

  selectSpace: (index: number | null) => {
    sound.play('BUTTON_CLICK');
    set({ selectedSpaceIndex: index });
  },

  dispatchAction: (commandType, payload = {}) => {
    const { gameState, isRolling, walkingAnimation } = get();
    if (!gameState || isRolling || walkingAnimation) return;

    sound.play('BUTTON_CLICK');

    if (commandType === 'ROLL_DICE') {
      set({ isRolling: true });
      sound.play('DICE_ROLL');

      setTimeout(() => {
        try {
          const command: GameCommand = {
            commandId: 'cmd_' + Date.now(),
            roomId: gameState.roomId,
            gameId: gameState.gameId,
            expectedVersion: gameState.version,
            type: 'ROLL_DICE',
            payload,
          };

          const result = applyGameCommand(gameState, command, gameState.currentPlayerUid);

          // Locate active player
          const activeUid = gameState.currentPlayerUid;
          const activeP = gameState.players.find((p) => p.uid === activeUid);
          const startPos = activeP?.position ?? 0;
          const endPos = result.nextState.players.find((p) => p.uid === activeUid)?.position ?? startPos;

          // If incarcerated directly (e.g. 3 consecutive doubles)
          if (result.nextState.players.find((p) => p.uid === activeUid)?.inJail && !activeP?.inJail) {
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

          // Calculate total steps taken
          const totalSteps = result.nextState.dice
            ? result.nextState.dice.first + result.nextState.dice.second
            : ((endPos - startPos + 40) % 40);

          // Stop rolling physics and reveal rolled dice outcome
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

          // User Requirement: Animate piece moving one by one across the grids, 0.5 seconds per step
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
              // Hold at destination grid for 0.5s before finalizing state and actions
              setTimeout(() => {
                set((s) => ({
                  gameState: result.nextState,
                  events: [result.event, ...s.events].slice(0, 50),
                  walkingAnimation: null,
                  error: null,
                }));
              }, 500);
            }
          }, 500);

        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Action failed';
          set({ error: message, isRolling: false, walkingAnimation: null });
        }
      }, 400);
      return;
    }

    try {
      const command: GameCommand = {
        commandId: 'cmd_' + Date.now(),
        roomId: gameState.roomId,
        gameId: gameState.gameId,
        expectedVersion: gameState.version,
        type: commandType,
        payload,
      };

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
    sound.play('EMOTE');
    const newReaction: EmoteReaction = {
      id: 'reaction_' + Date.now() + Math.random(),
      roomId: get().gameState?.roomId || 'global',
      senderUid: get().gameState?.currentPlayerUid || 'me',
      senderName,
      emote,
      timestamp: Date.now(),
    };

    set((state) => ({
      activeEmotes: [...state.activeEmotes, newReaction],
    }));

    // Auto expire reaction after 5 seconds
    setTimeout(() => {
      set((state) => ({
        activeEmotes: state.activeEmotes.filter((e) => e.id !== newReaction.id),
      }));
    }, 5000);
  },

  tickTurnTimer: () => {
    const { gameState, isRolling, walkingAnimation } = get();
    if (!gameState || gameState.status === 'COMPLETED' || isRolling || walkingAnimation) return;

    const remaining = (gameState.turnTimeRemaining ?? 30) - 1;

    if (remaining <= 0) {
      // Auto-action when timer expires
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

