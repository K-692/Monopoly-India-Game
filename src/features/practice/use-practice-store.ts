/**
 * Indian Monopoly - Practice Match Controller
 * Completely isolated module for gameplay testing.
 * Runs the EXACT same authoritative engine and components as live room games.
 * Can be cleanly removed in the future without affecting core game code.
 */

import { create } from 'zustand';
import { EmoteReaction, GameCommand, GameEvent, GameState, RoomMember } from '@/domain/game-types';
import { createInitialGame } from '@/domain/game-engine/create-initial-game';
import { applyGameCommand } from '@/domain/game-engine/engine';
import { sound } from '@/lib/audio/sound-engine';
import { BOARD_SPACES } from '@/domain/board-config';
import { DEFAULT_HOST_RULES, HostCustomRules } from '@/domain/ruleset';

interface PracticeStoreState {
  gameState: GameState | null;
  events: GameEvent[];
  activeEmotes: EmoteReaction[];
  selectedSpaceIndex: number | null;
  isRolling: boolean;
  error: string | null;
  isAiThinking: boolean;

  startPracticeMatch: (playerName: string, customRules?: HostCustomRules) => void;
  selectSpace: (index: number | null) => void;
  dispatchAction: (commandType: GameCommand['type'], payload?: Record<string, unknown>) => void;
  sendEmote: (emote: string, senderName: string) => void;
  tickTurnTimer: () => void;
  dismissError: () => void;
}

export const usePracticeStore = create<PracticeStoreState>((set, get) => ({
  gameState: null,
  events: [],
  activeEmotes: [],
  selectedSpaceIndex: null,
  isRolling: false,
  error: null,
  isAiThinking: false,

  startPracticeMatch: (playerName = 'You (Maharaja)', customRules = DEFAULT_HOST_RULES) => {
    const demoMembers: Record<string, RoomMember> = {
      player_human: {
        uid: 'player_human',
        displayName: playerName,
        photoURL: null,
        isReady: true,
        joinedAt: Date.now(),
        colorToken: '#C85A32', // Terracotta
      },
      player_ai_1: {
        uid: 'player_ai_1',
        displayName: 'Priya (Mumbai)',
        photoURL: null,
        isReady: true,
        joinedAt: Date.now() + 1,
        colorToken: '#1A2B4C', // Navy
      },
      player_ai_2: {
        uid: 'player_ai_2',
        displayName: 'Vikram (Delhi)',
        photoURL: null,
        isReady: true,
        joinedAt: Date.now() + 2,
        colorToken: '#E5A93C', // Gold
      },
      player_ai_3: {
        uid: 'player_ai_3',
        displayName: 'Ananya (Bengaluru)',
        photoURL: null,
        isReady: true,
        joinedAt: Date.now() + 3,
        colorToken: '#2D6A4F', // Emerald
      },
    };

    const initial = createInitialGame('practice_room', 'practice_game', demoMembers, customRules);
    const welcomeEvent: GameEvent = {
      sequence: 1,
      commandId: 'init_practice',
      actorUid: 'system',
      type: 'START_GAME',
      summary: `Practice Match started! Starting Cash: ₹${customRules.startingCash.toLocaleString('en-IN')}, Timer: ${customRules.turnTimerSeconds}s.`,
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
      error: null,
      isAiThinking: false,
    });
  },

  selectSpace: (index) => {
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

          // If turn changed to an AI, trigger AI loop
          if (result.nextState.currentPlayerUid !== 'player_human') {
            triggerAiTurn();
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Action failed';
          set({ error: message, isRolling: false });
        }
      }, 600);
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

      // If turn ended and passed to AI, trigger AI turn
      if (result.nextState.currentPlayerUid !== 'player_human') {
        triggerAiTurn();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      set({ error: message });
    }
  },

  sendEmote: (emote, senderName) => {
    sound.play('EMOTE');
    const newReaction: EmoteReaction = {
      id: 'reaction_' + Date.now() + Math.random(),
      roomId: get().gameState?.roomId || 'practice',
      senderUid: get().gameState?.currentPlayerUid || 'me',
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
    const { gameState, isRolling, isAiThinking } = get();
    if (!gameState || gameState.status === 'COMPLETED' || isRolling || isAiThinking) return;

    const remaining = (gameState.turnTimeRemaining ?? 30) - 1;

    if (remaining <= 0) {
      // Auto-action when timer expires
      if (gameState.phase === 'AWAIT_ROLL') {
        get().dispatchAction('ROLL_DICE');
      } else if (gameState.phase === 'PROPERTY_DECISION') {
        get().dispatchAction('DECLINE_PROPERTY');
      } else if (gameState.phase === 'JAIL_DECISION') {
        get().dispatchAction('TRY_DOUBLES');
      } else {
        get().dispatchAction('END_TURN');
      }
      return;
    }

    set({
      gameState: {
        ...gameState,
        turnTimeRemaining: remaining,
      },
    });
  },

  dismissError: () => set({ error: null }),
}));

/**
 * Intelligent AI player turn execution
 */
function triggerAiTurn() {
  const store = usePracticeStore.getState();
  const state = store.gameState;
  if (!state || state.status === 'COMPLETED') return;

  const currentUid = state.currentPlayerUid;
  if (currentUid === 'player_human') return;

  usePracticeStore.setState({ isAiThinking: true });

  setTimeout(() => {
    const s = usePracticeStore.getState().gameState;
    if (!s || s.currentPlayerUid !== currentUid) {
      usePracticeStore.setState({ isAiThinking: false });
      return;
    }

    try {
      // Step 1: Roll dice
      if (s.phase === 'AWAIT_ROLL') {
        store.dispatchAction('ROLL_DICE');
      } else if (s.phase === 'JAIL_DECISION') {
        store.dispatchAction('TRY_DOUBLES');
      }

      // Step 2: Handle landing decision after brief roll animation
      setTimeout(() => {
        const afterRoll = usePracticeStore.getState().gameState;
        if (!afterRoll || afterRoll.currentPlayerUid !== currentUid) {
          usePracticeStore.setState({ isAiThinking: false });
          return;
        }

        const activeAi = afterRoll.players.find((p) => p.uid === currentUid);

        if (afterRoll.phase === 'PROPERTY_DECISION' && afterRoll.pendingAction?.spaceIndex !== undefined) {
          const space = BOARD_SPACES[afterRoll.pendingAction.spaceIndex];
          const price = 'price' in space ? space.price : 99999;
          // Buy if AI has cash > price + 1500 safety buffer
          if ((activeAi?.cash ?? 0) >= price + 1500) {
            store.dispatchAction('BUY_PROPERTY', { spaceIndex: space.spaceIndex });
          } else {
            store.dispatchAction('DECLINE_PROPERTY');
          }
        }

        // Step 3: End turn
        setTimeout(() => {
          const finalState = usePracticeStore.getState().gameState;
          if (finalState && finalState.currentPlayerUid === currentUid && (finalState.phase === 'MANAGEMENT' || finalState.phase === 'TURN_END')) {
            store.dispatchAction('END_TURN');
          }
          usePracticeStore.setState({ isAiThinking: false });
        }, 800);
      }, 1000);
    } catch {
      usePracticeStore.setState({ isAiThinking: false });
    }
  }, 1200);
}
