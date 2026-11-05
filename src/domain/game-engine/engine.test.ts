import { describe, it, expect } from 'vitest';
import { createInitialGame } from './create-initial-game';
import { applyGameCommand } from './engine';
import { calculateMortgageValue, calculateRent, GAME_CONSTANTS } from '../ruleset';
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

  it('does NOT grant another chance to roll on doubles (only one time rolling allowed)', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers);

    // Player 1 rolls doubles [2, 2] -> lands on Space 4 (Light Blue city, Agra)
    state = applyGameCommand(
      state,
      {
        commandId: 'c_roll_double',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: 1,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [2, 2]
    ).nextState;

    expect(state.dice?.isDouble).toBe(true);
    expect(state.currentPlayerUid).toBe('user_1');

    // Player declines city purchase
    state = applyGameCommand(
      state,
      {
        commandId: 'c_dec',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'DECLINE_PROPERTY',
        payload: {},
      },
      'user_1'
    ).nextState;

    // Player ends turn -> must advance to user_2 (NO extra turn or roll granted on doubles)
    state = applyGameCommand(
      state,
      {
        commandId: 'c_end',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'END_TURN',
        payload: {},
      },
      'user_1'
    ).nextState;

    expect(state.currentPlayerUid).toBe('user_2');
    expect(state.phase).toBe('AWAIT_ROLL');
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

  it('correctly calculates railway rent (250, 500) and airport rent (1000, 2500)', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers);
    // Give user_1 Railway 1 (space 5: CST Mumbai)
    state.properties[5].ownerUid = 'user_1';
    expect(calculateRent(5, state.properties)).toBe(250);

    // Give user_1 Railway 2 (space 15: Howrah Railway)
    state.properties[15].ownerUid = 'user_1';
    expect(calculateRent(5, state.properties)).toBe(500);
    expect(calculateRent(15, state.properties)).toBe(500);

    // Give user_1 Airport 1 (space 25: Chennai Airport)
    state.properties[25].ownerUid = 'user_1';
    expect(calculateRent(25, state.properties)).toBe(1000);

    // Give user_1 Airport 2 (space 35: IGI Airport)
    state.properties[35].ownerUid = 'user_1';
    expect(calculateRent(25, state.properties)).toBe(2500);
    expect(calculateRent(35, state.properties)).toBe(2500);
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

  it('prohibits jailed owner from earning any rent when another player lands on their property', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers);

    // User 2 owns Space 1 (Jaipur MI Road, base rent 50)
    state.properties[1].ownerUid = 'user_2';

    // User 2 is in jail
    state.players[1].inJail = true;

    const user1CashBefore = state.players[0].cash;
    const user2CashBefore = state.players[1].cash;

    // User 1 rolls 1+0 -> lands on Space 1
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_roll_rent',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [1, 0]
    ).nextState;

    expect(state.players[0].position).toBe(1);
    // User 2 is in jail, so User 1 pays 0 rent and User 2 earns 0!
    expect(state.players[0].cash).toBe(user1CashBefore);
    expect(state.players[1].cash).toBe(user2CashBefore);
  });

  it('records activeMoneyTransaction on property buy and clears on DISMISS_MONEY_ACK', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers);

    // Roll 1+0 -> Space 1
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_roll_buy',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [1, 0]
    ).nextState;

    // Buy space 1
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_buy_prop',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'BUY_PROPERTY',
        payload: { spaceIndex: 1 },
      },
      'user_1'
    ).nextState;

    expect(state.activeMoneyTransaction).toBeDefined();
    expect(state.activeMoneyTransaction?.type).toBe('BUY_PROPERTY');
    expect(state.activeMoneyTransaction?.amount).toBe(600);

    // Dismiss money acknowledgment
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_dismiss_money',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'DISMISS_MONEY_ACK',
        payload: {},
      },
      'user_1'
    ).nextState;

    expect(state.activeMoneyTransaction).toBeNull();
  });

  it('ends the game when a player is completely bankrupted with ₹0 cash and no places to mortgage', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers);
    const p1 = state.players.find((p) => p.uid === 'user_1')!;

    // Set user_1 cash to 100, no properties owned
    p1.cash = 100;

    // Roll [5, 3] = 8 to land on GST Tax space (space 8, amount ₹2,000)
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_roll_tax',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [5, 3]
    ).nextState;

    const updatedP1 = state.players.find((p) => p.uid === 'user_1')!;
    // user_1 had only ₹100, tax was ₹2,000, and user_1 had no properties to mortgage
    expect(updatedP1.cash).toBe(0);
    expect(updatedP1.isBankrupt).toBe(true);

    // With user_1 bankrupted, user_2 is the sole solvent player -> Game COMPLETED!
    expect(state.status).toBe('COMPLETED');
    expect(state.winnerUid).toBe('user_2');
  });

  // ==========================================
  // SECTION 1: JAIL & TRY DOUBLES TESTS
  // ==========================================
  describe('Jail Mechanics & Try Doubles', () => {
    it('releases player on double on attempt 1, moves them, and does NOT grant an extra turn', () => {
      let state = createInitialGame('room_1', 'game_1', mockMembers);
      state.players[0].inJail = true;
      state.players[0].jailTurns = 0;
      state.players[0].position = 10;
      state.phase = 'JAIL_DECISION';

      // Attempt 1: roll doubles [3, 3] = 6
      const res = applyGameCommand(
        state,
        {
          commandId: 'cmd_try_1',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'TRY_DOUBLES',
          payload: {},
        },
        'user_1',
        [3, 3]
      );
      state = res.nextState;

      expect(state.players[0].inJail).toBe(false);
      expect(state.players[0].jailTurns).toBe(0);
      expect(state.players[0].position).toBe(16); // 10 + 6 = 16 (Visakhapatnam)
      expect(state.players[0].escapedJailThisTurn).toBe(true);

      // Resolve pending action on landing space before ending turn
      if (state.pendingAction) {
        state = applyGameCommand(
          state,
          {
            commandId: 'cmd_decline_16',
            roomId: 'room_1',
            gameId: 'game_1',
            expectedVersion: state.version,
            type: 'DECLINE_PROPERTY',
            payload: {},
          },
          'user_1'
        ).nextState;
      }

      // End turn: because double was from jail escape, NO extra turn is granted
      const endTurnRes = applyGameCommand(
        state,
        {
          commandId: 'cmd_end_jail_turn',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        },
        'user_1'
      );

      // Must have advanced to user_2!
      expect(endTurnRes.nextState.currentPlayerUid).toBe('user_2');
      expect(endTurnRes.nextState.players[0].escapedJailThisTurn).toBe(false);
    });

    it('releases player on attempt 2 or 3, moves them, and does not grant extra turn', () => {
      let state = createInitialGame('room_1', 'game_1', mockMembers);
      state.players[0].inJail = true;
      state.players[0].jailTurns = 1; // attempt 1 already failed
      state.players[0].position = 10;
      state.phase = 'JAIL_DECISION';

      // Attempt 2: roll doubles [4, 4] = 8
      const res = applyGameCommand(
        state,
        {
          commandId: 'cmd_try_2',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'TRY_DOUBLES',
          payload: {},
        },
        'user_1',
        [4, 4]
      );
      state = res.nextState;

      expect(state.players[0].inJail).toBe(false);
      expect(state.players[0].position).toBe(18); // 10 + 8 = 18 (Kochi)

      if (state.pendingAction) {
        state = applyGameCommand(
          state,
          {
            commandId: 'cmd_decline_18',
            roomId: 'room_1',
            gameId: 'game_1',
            expectedVersion: state.version,
            type: 'DECLINE_PROPERTY',
            payload: {},
          },
          'user_1'
        ).nextState;
      }

      // End turn advances to user_2
      const endRes = applyGameCommand(
        state,
        {
          commandId: 'cmd_end_turn_2',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        },
        'user_1'
      );
      expect(endRes.nextState.currentPlayerUid).toBe('user_2');
    });

    it('releases player on double on attempt 3, moves them, and does not grant extra turn', () => {
      let state = createInitialGame('room_1', 'game_1', mockMembers);
      state.players[0].inJail = true;
      state.players[0].jailTurns = 2; // attempts 1 and 2 already failed
      state.players[0].position = 10;
      state.phase = 'JAIL_DECISION';

      // Attempt 3: roll doubles [5, 5] = 10
      const res = applyGameCommand(
        state,
        {
          commandId: 'cmd_try_3',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'TRY_DOUBLES',
          payload: {},
        },
        'user_1',
        [5, 5]
      );
      state = res.nextState;

      expect(state.players[0].inJail).toBe(false);
      expect(state.players[0].jailTurns).toBe(0);
      expect(state.players[0].position).toBe(20); // 10 + 10 = 20 (Rest House)
      expect(state.players[0].escapedJailThisTurn).toBe(true);

      // End turn: advances to user_2, no extra turn granted
      const endRes = applyGameCommand(
        state,
        {
          commandId: 'cmd_end_turn_3',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        },
        'user_1'
      );
      expect(endRes.nextState.currentPlayerUid).toBe('user_2');
    });

    it('enforces 3 consecutive failed attempts: player stays in jail and does not move', () => {
      let state = createInitialGame('room_1', 'game_1', mockMembers);
      state.players[0].inJail = true;
      state.players[0].jailTurns = 0;
      state.players[0].position = 10;
      state.phase = 'JAIL_DECISION';

      // Attempt 1 fail [1, 2]
      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_fail_1',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'TRY_DOUBLES',
          payload: {},
        },
        'user_1',
        [1, 2]
      ).nextState;

      expect(state.players[0].inJail).toBe(true);
      expect(state.players[0].jailTurns).toBe(1);
      expect(state.players[0].position).toBe(10); // Did not move!
      expect(state.phase).toBe('TURN_END');

      // End user_1 turn
      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_end_1',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        },
        'user_1'
      ).nextState;

      expect(state.currentPlayerUid).toBe('user_2');

      // user_2 rolls and ends turn
      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_u2_roll',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'user_2',
        [1, 2]
      ).nextState;

      if (state.pendingAction) {
        state = applyGameCommand(state, { commandId: 'cmd_u2_dec', roomId: 'room_1', gameId: 'game_1', expectedVersion: state.version, type: 'DECLINE_PROPERTY', payload: {} }, 'user_2').nextState;
      }

      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_u2_end',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        },
        'user_2'
      ).nextState;

      // Turn 2 for user_1: Attempt 2 fail [2, 3]
      expect(state.currentPlayerUid).toBe('user_1');
      expect(state.players[0].inJail).toBe(true);
      expect(state.players[0].jailTurns).toBe(1);

      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_fail_2',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'TRY_DOUBLES',
          payload: {},
        },
        'user_1',
        [2, 3]
      ).nextState;

      expect(state.players[0].jailTurns).toBe(2);
      expect(state.players[0].position).toBe(10);

      // End turn & cycle through user_2
      state = applyGameCommand(state, { commandId: 'c1', roomId: 'room_1', gameId: 'game_1', expectedVersion: state.version, type: 'END_TURN', payload: {} }, 'user_1').nextState;
      state = applyGameCommand(state, { commandId: 'c2', roomId: 'room_1', gameId: 'game_1', expectedVersion: state.version, type: 'ROLL_DICE', payload: {} }, 'user_2', [1, 2]).nextState;
      if (state.pendingAction) {
        state = applyGameCommand(state, { commandId: 'c2_dec', roomId: 'room_1', gameId: 'game_1', expectedVersion: state.version, type: 'DECLINE_PROPERTY', payload: {} }, 'user_2').nextState;
      }
      state = applyGameCommand(state, { commandId: 'c3', roomId: 'room_1', gameId: 'game_1', expectedVersion: state.version, type: 'END_TURN', payload: {} }, 'user_2').nextState;

      // Turn 3 for user_1: Attempt 3 fail [3, 4]
      expect(state.currentPlayerUid).toBe('user_1');
      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_fail_3',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'TRY_DOUBLES',
          payload: {},
        },
        'user_1',
        [3, 4]
      ).nextState;

      expect(state.players[0].jailTurns).toBe(3);
      expect(state.players[0].inJail).toBe(true);
      expect(state.players[0].position).toBe(10);
    });

    it('automatically releases the player on the fourth turn without requiring another try double attempt', () => {
      let state = createInitialGame('room_1', 'game_1', mockMembers);
      state.players[0].inJail = true;
      state.players[0].jailTurns = 3; // 3 failed attempts completed!
      state.players[0].position = 10;
      state.currentPlayerUid = 'user_2';
      state.phase = 'AWAIT_ROLL';

      // user_2 rolls and ends turn
      state = applyGameCommand(state, { commandId: 'c1', roomId: 'room_1', gameId: 'game_1', expectedVersion: state.version, type: 'ROLL_DICE', payload: {} }, 'user_2', [1, 2]).nextState;
      if (state.pendingAction) {
        state = applyGameCommand(state, { commandId: 'c1_dec', roomId: 'room_1', gameId: 'game_1', expectedVersion: state.version, type: 'DECLINE_PROPERTY', payload: {} }, 'user_2').nextState;
      }
      state = applyGameCommand(state, { commandId: 'c2', roomId: 'room_1', gameId: 'game_1', expectedVersion: state.version, type: 'END_TURN', payload: {} }, 'user_2').nextState;

      // Turn 4 begins for user_1:
      // Automatic release occurs!
      expect(state.currentPlayerUid).toBe('user_1');
      expect(state.players[0].inJail).toBe(false);
      expect(state.players[0].jailTurns).toBe(0);
      expect(state.phase).toBe('AWAIT_ROLL'); // Free to roll normally!

      // Normal roll [2, 3] = 5
      const normalRollRes = applyGameCommand(
        state,
        {
          commandId: 'cmd_normal_roll_4',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'user_1',
        [2, 3]
      );

      expect(normalRollRes.nextState.players[0].position).toBe(15); // Moved from 10 to 15 (Howrah)
    });
  });

  // ==========================================
  // SECTION 2: INSUFFICIENT BALANCE TESTS
  // ==========================================
  describe('Insufficient Balance Validation', () => {
    it('prevents property purchase popup and skips to MANAGEMENT when landing with insufficient funds', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers);
      // Give user_1 only ₹500 cash
      state.players[0].cash = 500;

      // Space 1 is Jaipur (Price ₹600)
      const rollRes = applyGameCommand(
        state,
        {
          commandId: 'cmd_roll_poor',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'user_1',
        [1, 0] // Lands on space 1
      );

      // Phase must not be PROPERTY_DECISION! It must be MANAGEMENT with no pendingAction
      expect(rollRes.nextState.players[0].position).toBe(1);
      expect(rollRes.nextState.phase).toBe('MANAGEMENT');
      expect(rollRes.nextState.pendingAction).toBeNull();
    });

    it('rejects BUY_PROPERTY command in backend if player has insufficient cash', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers);
      state.players[0].cash = 400;
      state.players[0].position = 1; // Jaipur price ₹600

      expect(() => {
        applyGameCommand(
          state,
          {
            commandId: 'cmd_buy_fail',
            roomId: 'room_1',
            gameId: 'game_1',
            expectedVersion: state.version,
            type: 'BUY_PROPERTY',
            payload: { spaceIndex: 1 },
          },
          'user_1'
        );
      }).toThrow(/Insufficient balance to purchase this property/i);
    });

    it('rejects BUILD command in backend if player has insufficient cash without deducting money', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers);
      state.properties[1].ownerUid = 'user_1';
      state.properties[1].boughtOnTurn = 1;
      state.turnNumber = 3;
      state.players[0].position = 1;
      state.players[0].cash = 200; // Building cost is ₹500

      expect(() => {
        applyGameCommand(
          state,
          {
            commandId: 'cmd_build_poor',
            roomId: 'room_1',
            gameId: 'game_1',
            expectedVersion: state.version,
            type: 'BUILD',
            payload: { spaceIndex: 1 },
          },
          'user_1'
        );
      }).toThrow(/Insufficient balance to build on this property/i);

      expect(state.players[0].cash).toBe(200); // Zero money deducted
    });
  });

  // ==========================================
  // SECTION 3 & 6: MORTGAGE SYSTEM & BLOCKED PROPERTIES
  // ==========================================
  describe('Mortgage System & Financial Obligations', () => {
    it('calculates mortgage values accounting for development investment and caps at purchase price', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers);
      // Jaipur: price 600, buildingCost 500
      // 0 houses: 0.5 * 600 = 300
      expect(calculateMortgageValue(1, state.properties[1])).toBe(300);

      // 1 house: 300 + 0.5 * 500 = 550
      state.properties[1].buildings = 1;
      expect(calculateMortgageValue(1, state.properties[1])).toBe(550);

      // 2 houses: 300 + 0.5 * 1000 = 800, capped at price 600!
      state.properties[1].buildings = 2;
      expect(calculateMortgageValue(1, state.properties[1])).toBe(600);
    });

    it('pauses financial transaction on insufficient rent, allows mortgaging, and completes obligation', () => {
      let state = createInitialGame('room_1', 'game_1', mockMembers);
      // user_2 owns Navi Mumbai (Space 36, rent 380)
      state.properties[36].ownerUid = 'user_2';
      state.properties[36].ownershipState = 'OWNED';

      // user_1 owns Jaipur (Space 1) and has only ₹100 cash
      state.properties[1].ownerUid = 'user_1';
      state.properties[1].ownershipState = 'OWNED';
      state.players[0].cash = 100;

      // user_1 rolls and lands on space 36
      state.players[0].position = 30;
      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_roll_rent_ob',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'user_1',
        [3, 3] // 30 + 6 = 36
      ).nextState;

      // Financial obligation must be created!
      expect(state.phase).toBe('ACTION_REQUIRED');
      expect(state.pendingFinancialObligation).toBeDefined();
      expect(state.pendingFinancialObligation?.amountDue).toBe(350);
      expect(state.pendingFinancialObligation?.debtorUid).toBe('user_1');
      expect(state.pendingFinancialObligation?.creditorUid).toBe('user_2');

      // user_1 cash is preserved (paused, not deducted yet)
      expect(state.players[0].cash).toBe(100);

      // user_1 mortgages Jaipur (space 1) -> receives ₹300
      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_mortgage_jaipur',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'MORTGAGE',
          payload: { spaceIndex: 1 },
        },
        'user_1'
      ).nextState;

      // user_1 cash now: 100 + 300 = 400
      expect(state.players[0].cash).toBe(400);
      expect(state.properties[1].isMortgaged).toBe(true);
      expect(state.properties[1].ownershipState).toBe('MORTGAGED');
      expect(state.properties[1].mortgagePayout).toBe(300);

      // Now user_1 has ₹400 >= ₹350, resolves obligation
      const u2CashBefore = state.players[1].cash;
      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_resolve_debt',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'RESOLVE_OBLIGATION',
          payload: {},
        },
        'user_1'
      ).nextState;

      expect(state.pendingFinancialObligation).toBeNull();
      expect(state.phase).toBe('MANAGEMENT');
      expect(state.players[0].cash).toBe(400 - 350); // 50
      expect(state.players[1].cash).toBe(u2CashBefore + 350);
    });

    it('marks all properties of surrendered player as BLOCKED, not unowned', () => {
      let state = createInitialGame('room_1', 'game_1', mockMembers);
      state.properties[1].ownerUid = 'user_1';
      state.properties[1].ownershipState = 'OWNED';
      state.properties[3].ownerUid = 'user_1';
      state.properties[3].ownershipState = 'OWNED';

      state.pendingFinancialObligation = {
        obligationId: 'ob_test',
        debtorUid: 'user_1',
        creditorUid: 'user_2',
        amountDue: 5000,
        paymentType: 'RENT',
        status: 'PENDING',
        createdAt: Date.now(),
        idempotencyKey: 'test_surrender',
      };
      state.players[0].cash = 300;

      // user_1 gives up
      const u2CashBefore = state.players[1].cash;
      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_give_up',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'GIVE_UP',
          payload: {},
        },
        'user_1'
      ).nextState;

      expect(state.players[0].isBankrupt).toBe(true);
      expect(state.players[0].isDisqualified).toBe(true);
      expect(state.players[0].cash).toBe(0);
      expect(state.players[1].cash).toBe(u2CashBefore + 300);

      // Properties MUST be in BLOCKED state, with records preserved
      expect(state.properties[1].ownershipState).toBe('BLOCKED');
      expect(state.properties[1].ownerUid).toBe('user_1');
      expect(state.properties[3].ownershipState).toBe('BLOCKED');
      expect(state.properties[3].ownerUid).toBe('user_1');

      // Blocked properties do NOT generate rent
      expect(calculateRent(1, state.properties)).toBe(0);
    });

    it('allows reacquiring mortgaged property for the exact original mortgage payout', () => {
      let state = createInitialGame('room_1', 'game_1', mockMembers);
      state.properties[1].ownerUid = 'user_1';
      state.properties[1].ownershipState = 'MORTGAGED';
      state.properties[1].isMortgaged = true;
      state.properties[1].mortgagePayout = 300;
      state.properties[1].buildings = 1; // Preserve development!
      state.players[0].cash = 1000;
      state.players[0].position = 1; // Landed on space 1

      // Requirement 3: Active landing reacquisition opportunity
      state.reacquisitionOpportunity = {
        landingId: 'landing_1_1',
        turnNumber: state.turnNumber,
        playerUid: 'user_1',
        spaceIndex: 1,
        cost: 300,
        status: 'PENDING',
      };

      // Reacquire property
      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_unmortgage_exact',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'UNMORTGAGE',
          payload: { spaceIndex: 1, landingId: 'landing_1_1' },
        },
        'user_1'
      ).nextState;

      expect(state.players[0].cash).toBe(1000 - 300); // 700
      expect(state.properties[1].isMortgaged).toBe(false);
      expect(state.properties[1].ownershipState).toBe('OWNED');
      expect(state.properties[1].buildings).toBe(1); // Buildings intact!
    });
  });

  // ==========================================
  // SECTION 8: TRANSACTION LEDGER TESTS
  // ==========================================
  describe('Authoritative Transaction Ledger', () => {
    it('records structured transactions for starting balance, purchases, and rent', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers);
      expect(state.transactions).toBeDefined();
      expect(state.transactions!.length).toBe(2);
      expect(state.transactions![0].type).toBe('STARTING_BALANCE');
      expect(state.transactions![0].amount).toBe(15000);
      expect(state.transactions![0].direction).toBe('CREDIT');
    });

    it('links paired debit and credit records for player-to-player rent with the same transactionId', () => {
      let state = createInitialGame('room_1', 'game_1', mockMembers);
      // user_2 owns Chennai Airport (space 25, rent ₹1,000)
      state.properties[25].ownerUid = 'user_2';
      state.properties[25].ownershipState = 'OWNED';

      // user_1 lands on Chennai Airport
      state.players[0].position = 20;
      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_roll_airport',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'user_1',
        [2, 3] // 20 + 5 = 25
      ).nextState;

      // Find the last 2 transactions (the debit for user_1 and credit for user_2)
      const lastTxns = state.transactions!.slice(-2);
      expect(lastTxns).toHaveLength(2);

      const debitTx = lastTxns.find((t) => t.playerUid === 'user_1')!;
      const creditTx = lastTxns.find((t) => t.playerUid === 'user_2')!;

      expect(debitTx.type).toBe('AIRPORT_RENT_PAID');
      expect(debitTx.direction).toBe('DEBIT');
      expect(debitTx.amount).toBe(1000);

      expect(creditTx.type).toBe('AIRPORT_RENT_RECEIVED');
      expect(creditTx.direction).toBe('CREDIT');
      expect(creditTx.amount).toBe(1000);

      // Must share the exact same transactionId!
      expect(debitTx.transactionId).toBe(creditTx.transactionId);
    });

    it('ensures blocked airport generates zero rent when visited', () => {
      let state = createInitialGame('room_1', 'game_1', mockMembers);
      // Mark Chennai Airport (space 25) as BLOCKED
      state.properties[25].ownerUid = 'user_2';
      state.properties[25].ownershipState = 'BLOCKED';

      expect(calculateRent(25, state.properties)).toBe(0);

      // user_1 lands on space 25
      const initialCash = state.players[0].cash;
      state.players[0].position = 20;
      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_roll_blocked_airport',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'user_1',
        [2, 3] // 20 + 5 = 25
      ).nextState;

      // Zero rent deducted
      expect(state.players[0].cash).toBe(initialCash);
      expect(state.phase).toBe('MANAGEMENT');
    });
  });
});

