import { create } from 'zustand';
import { EmoteReaction, GameCommand, GameEvent, GameState, RoomMember } from '@/domain/game-types';
import { createInitialGame } from '@/domain/game-engine/create-initial-game';
import { applyGameCommand } from '@/domain/game-engine/engine';
import { sound } from '@/lib/audio/sound-engine';

interface GameStoreState {
  gameState: GameState | null;
  events: GameEvent[];
  activeEmotes: EmoteReaction[];
  selectedSpaceIndex: number | null;
  isRolling: boolean;
  isLiveMultiplayer: boolean;
  error: string | null;

  // Actions
  initializeDemoGame: (userName?: string) => void;
  setLiveGameState: (state: GameState) => void;
  selectSpace: (index: number | null) => void;
  dispatchAction: (commandType: GameCommand['type'], payload?: Record<string, unknown>) => void;
  sendEmote: (emote: string, senderName: string) => void;
  dismissError: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: null,
  events: [],
  activeEmotes: [],
  selectedSpaceIndex: null,
  isRolling: false,
  isLiveMultiplayer: false,
  error: null,

  initializeDemoGame: (userName = 'You (Maharaja)') => {
    const demoMembers: Record<string, RoomMember> = {
      player_1: {
        uid: 'player_1',
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
      selectedSpaceIndex: 0,
      isRolling: false,
      isLiveMultiplayer: false,
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
    const { gameState, isRolling } = get();
    if (!gameState || isRolling) return;

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

          sound.play('PAWN_STEP');

          // Check if passed start
          if (result.event.summary.includes('Passed START')) {
            sound.play('PASS_START');
          }

          set((s) => ({
            gameState: result.nextState,
            events: [result.event, ...s.events].slice(0, 50),
            selectedSpaceIndex: result.nextState.players.find(
              (p) => p.uid === result.nextState.currentPlayerUid
            )?.position ?? s.selectedSpaceIndex,
            isRolling: false,
            error: null,
          }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Action failed';
          set({ error: message, isRolling: false });
        }
      }, 700);
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

  dismissError: () => set({ error: null }),
}));
