/**
 * Indian Monopoly - Practice Match Controller
 * Completely isolated module for gameplay testing.
 * Runs the EXACT same authoritative engine and components as live room games.
 * Can be cleanly removed in the future without affecting core game code.
 */

import { create } from 'zustand';
import { EmoteReaction, GameCommand, GameEvent, GameState, RoomMember, WalkingAnimationState } from '@/domain/game-types';
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
  walkingAnimation: WalkingAnimationState | null;
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
  walkingAnimation: null,
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
      walkingAnimation: null,
      error: null,
      isAiThinking: false,
    });
  },

  selectSpace: (index) => {
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

          // Locate starting and target positions
          const activeP = gameState.players.find((p) => p.uid === gameState.currentPlayerUid);
          const startPos = activeP?.position ?? 0;
          const finalPos = result.nextState.players.find((p) => p.uid === gameState.currentPlayerUid)?.position ?? 0;
          const totalSteps = result.nextState.dice
            ? (result.nextState.dice.first + result.nextState.dice.second)
            : ((finalPos - startPos + 40) % 40);

          // If incarcerated directly (e.g. 3 consecutive doubles)
          if (result.nextState.players.find((p) => p.uid === gameState.currentPlayerUid)?.inJail && !activeP?.inJail) {
            sound.play('GO_TO_JAIL');
            set((s) => ({
              gameState: result.nextState,
              events: [result.event, ...s.events].slice(0, 50),
              selectedSpaceIndex: finalPos,
              isRolling: false,
              walkingAnimation: null,
              error: null,
            }));
            if (result.nextState.currentPlayerUid !== 'player_human') {
              triggerAiTurn();
            }
            return;
          }

          // Step-by-step pawn walking animation along the lane
          let currentStepPos = startPos;
          let stepsLeft = totalSteps > 0 ? totalSteps : (finalPos - startPos + 40) % 40;

          set({
            isRolling: false,
            // Reveal rolled dice face values immediately
            gameState: {
              ...gameState,
              dice: result.nextState.dice,
            },
            walkingAnimation: {
              uid: gameState.currentPlayerUid,
              currentPos: startPos,
              targetPos: finalPos,
              stepsRemaining: stepsLeft,
            },
          });

          const walkInterval = setInterval(() => {
            if (stepsLeft <= 0 || currentStepPos === finalPos) {
              clearInterval(walkInterval);

              if (result.event.summary.includes('Passed START')) {
                sound.play('PASS_START');
              }

              set((s) => ({
                gameState: result.nextState,
                events: [result.event, ...s.events].slice(0, 50),
                selectedSpaceIndex: finalPos,
                walkingAnimation: null,
                error: null,
              }));

              // If turn changed to an AI, trigger AI loop
              if (result.nextState.currentPlayerUid !== 'player_human') {
                triggerAiTurn();
              }
              return;
            }

            currentStepPos = (currentStepPos + 1) % 40;
            stepsLeft -= 1;
            sound.play('PAWN_STEP');

            set({
              walkingAnimation: {
                uid: gameState.currentPlayerUid,
                currentPos: currentStepPos,
                targetPos: finalPos,
                stepsRemaining: stepsLeft,
              },
              selectedSpaceIndex: currentStepPos,
            });
          }, 140);

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
    const isWalking = !!usePracticeStore.getState().walkingAnimation;
    if (!s || s.currentPlayerUid !== currentUid || isWalking) {
      usePracticeStore.setState({ isAiThinking: false });
      return;
    }

    try {
      if (s.phase === 'AWAIT_ROLL') {
        store.dispatchAction('ROLL_DICE');
      } else if (s.phase === 'JAIL_DECISION') {
        store.dispatchAction('TRY_DOUBLES');
      } else if (s.phase === 'PROPERTY_DECISION' && s.pendingAction?.spaceIndex !== undefined) {
        const space = BOARD_SPACES[s.pendingAction.spaceIndex];
        const price = 'price' in space ? space.price : 99999;
        const activeAi = s.players.find((p) => p.uid === currentUid);
        if ((activeAi?.cash ?? 0) >= price + 1000) {
          store.dispatchAction('BUY_PROPERTY', { spaceIndex: space.spaceIndex });
        } else {
          store.dispatchAction('DECLINE_PROPERTY');
        }
      } else if (s.phase === 'MANAGEMENT' || s.phase === 'TURN_END') {
        store.dispatchAction('END_TURN');
      }
      usePracticeStore.setState({ isAiThinking: false });
    } catch {
      usePracticeStore.setState({ isAiThinking: false });
    }
  }, 450);
}

