import { describe, it, expect } from 'vitest';
import { createInitialGame } from './create-initial-game';
import { applyGameCommand } from './engine';
import { calculateRent, GAME_CONSTANTS } from '../ruleset';
import { RoomMember } from '../game-types';

describe('Pure Game Engine', () => {
  const mockMembers: Record<string, RoomMember> = {
    user_1: {
      uid: 'user_1',
      displayName: 'Arjun',
      photoURL: null,
      isReady: true,
      joinedAt: 1000,
      colorToken: '#C85A32',
    },
    user_2: {
      uid: 'user_2',
      displayName: 'Priya',
      photoURL: null,
      isReady: true,
      joinedAt: 1001,
      colorToken: '#1A2B4C',
    },
  };

  it('initializes game state with starting cash ₹15,000 and 40 unowned spaces', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers);
    expect(state.players).toHaveLength(2);
    expect(state.players[0].cash).toBe(GAME_CONSTANTS.STARTING_CASH);
    expect(state.players[1].cash).toBe(GAME_CONSTANTS.STARTING_CASH);
    expect(state.players[0].position).toBe(0);
    expect(state.phase).toBe('AWAIT_ROLL');
    expect(state.currentPlayerUid).toBe('user_1');
    expect(state.version).toBe(1);
  });

  it('executes dice roll, moves pawn, and handles landing on unowned property', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers);
    const { nextState, event } = applyGameCommand(
      state,
      {
        commandId: 'cmd_1',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: 1,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [1, 2] // Roll 3 -> Space 3 (Jodhpur Clock Tower)
    );

    expect(nextState.version).toBe(2);
    expect(nextState.players[0].position).toBe(3);
    expect(nextState.phase).toBe('PROPERTY_DECISION');
    expect(nextState.pendingAction?.type).toBe('BUY_OR_AUCTION');
    expect(event.summary).toContain('rolled 1 + 2 = 3');
  });

  it('allows buying unowned property and deducts correct price', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers);
    // Roll 1 + 0 = Space 1 (Jaipur MI Road, price 600)
    const rollRes = applyGameCommand(
      state,
      {
        commandId: 'cmd_1',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: 1,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [1, 0]
    );
    state = rollRes.nextState;

    const buyRes = applyGameCommand(
      state,
      {
        commandId: 'cmd_2',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: 2,
        type: 'BUY_PROPERTY',
        payload: { spaceIndex: 1 },
      },
      'user_1'
    );

    expect(buyRes.nextState.players[0].cash).toBe(15000 - 600);
    expect(buyRes.nextState.properties[1].ownerUid).toBe('user_1');
    expect(buyRes.nextState.phase).toBe('MANAGEMENT');
  });

  it('awards ₹2,000 reward when passing or landing on START', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers);
    state.players[0].position = 38; // Infrastructure Levy

    const { nextState } = applyGameCommand(
      state,
      {
        commandId: 'cmd_1',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: 1,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [2, 3] // 38 + 5 = 43 % 40 = 3 (passes 0)
    );

    // Initial 15,000 + 2,000 Start Reward = 17,000
    expect(nextState.players[0].cash).toBe(17000);
    expect(nextState.players[0].position).toBe(3);
  });

  it('sends player to Central Jail on 3 consecutive doubles', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers);

    // First double
    state = applyGameCommand(
      state,
      {
        commandId: 'c1',
        roomId: 'r1',
        gameId: 'g1',
        expectedVersion: 1,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [2, 2]
    ).nextState;
    expect(state.dice?.consecutiveDoubles).toBe(1);

    // Second double
    state.phase = 'AWAIT_ROLL';
    state = applyGameCommand(
      state,
      {
        commandId: 'c2',
        roomId: 'r1',
        gameId: 'g1',
        expectedVersion: 2,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [3, 3]
    ).nextState;
    expect(state.dice?.consecutiveDoubles).toBe(2);

    // Third double -> Central Jail!
    state.phase = 'AWAIT_ROLL';
    state = applyGameCommand(
      state,
      {
        commandId: 'c3',
        roomId: 'r1',
        gameId: 'g1',
        expectedVersion: 3,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [4, 4]
    ).nextState;

    expect(state.players[0].inJail).toBe(true);
    expect(state.players[0].position).toBe(10);
    expect(state.phase).toBe('TURN_END');
  });

  it('correctly calculates transit rent scaling (250, 500, 1000, 2000)', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers);
    // Give user_1 transit 1 (space 5)
    state.properties[5].ownerUid = 'user_1';
    expect(calculateRent(5, state.properties)).toBe(250);

    // Give user_1 transit 2 (space 15)
    state.properties[15].ownerUid = 'user_1';
    expect(calculateRent(5, state.properties)).toBe(500);

    // Give user_1 transit 3 (space 25)
    state.properties[25].ownerUid = 'user_1';
    expect(calculateRent(5, state.properties)).toBe(1000);

    // Give user_1 transit 4 (space 35)
    state.properties[35].ownerUid = 'user_1';
    expect(calculateRent(5, state.properties)).toBe(2000);
  });

  it('cycles turns strictly between 2 players in a 2-player match', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers);
    expect(state.players).toHaveLength(2);
    expect(state.currentPlayerUid).toBe('user_1');

    // Turn 1: user_1 ends turn -> switches to user_2
    state.phase = 'TURN_END';
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_end_1',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: 1,
        type: 'END_TURN',
        payload: {},
      },
      'user_1'
    ).nextState;

    expect(state.currentPlayerUid).toBe('user_2');
    expect(state.phase).toBe('AWAIT_ROLL');

    // Turn 2: user_2 ends turn -> cycles back to user_1
    state.phase = 'TURN_END';
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_end_2',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'END_TURN',
        payload: {},
      },
      'user_2'
    ).nextState;

    expect(state.currentPlayerUid).toBe('user_1');
    expect(state.phase).toBe('AWAIT_ROLL');
  });

  it('records boughtOnTurn and prohibits building house on the same turn, allowing it on subsequent turn', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers);
    state.turnNumber = 1;

    // Roll 1+0 -> Space 1 (Jaipur)
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_roll_1',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [1, 0]
    ).nextState;

    // Buy space 1 on Turn 1
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_buy_1',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'BUY_PROPERTY',
        payload: { spaceIndex: 1 },
      },
      'user_1'
    ).nextState;

    expect(state.properties[1].boughtOnTurn).toBe(1);

    // Try to build on turn 1 -> Should be rejected
    expect(() => {
      applyGameCommand(
        state,
        {
          commandId: 'cmd_build_fail',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'BUILD',
          payload: { spaceIndex: 1 },
        },
        'user_1'
      );
    }).toThrow(/next turn/i);

    // Advance to Turn 3, player visits space 1 again
    state.turnNumber = 3;
    state.players[0].position = 1;
    state.players[0].cash = 5000;

    // Now building is permitted!
    const buildRes = applyGameCommand(
      state,
      {
        commandId: 'cmd_build_success',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'BUILD',
        payload: { spaceIndex: 1 },
      },
      'user_1'
    );

    expect(buildRes.nextState.properties[1].buildings).toBe(1);
  });

  it('triggers index rule matching dice total when landing on Civic Fund and sets activeCardPopup', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers);
    const initialCash = state.players[0].cash;

    // Roll 1 + 1 = 2 -> Space 2 is Civic Fund!
    // Total dice is 2 -> Civic Fund Rule #2 is "Tax refund: Receive ₹700"
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_roll_civic',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [1, 1]
    ).nextState;

    expect(state.players[0].position).toBe(2);
    expect(state.activeCardPopup).toBeDefined();
    expect(state.activeCardPopup?.deck).toBe('CIVIC');
    expect(state.activeCardPopup?.ruleIndex).toBe(2);
    expect(state.activeCardPopup?.card.title).toBe('Tax refund');
    // Received ₹700
    expect(state.players[0].cash).toBe(initialCash + 700);

    // Dismiss card popup
    const dismissedState = applyGameCommand(
      state,
      {
        commandId: 'cmd_dismiss',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'DISMISS_CARD_POPUP',
        payload: {},
      },
      'user_1'
    ).nextState;

    expect(dismissedState.activeCardPopup).toBeNull();
  });
});

