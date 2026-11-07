/**
 * Indian Monopoly - Rule Updates & Gameplay Improvements Acceptance Test Suite
 * Validates Section 12 Acceptance Criteria:
 * - Fixed Room Creation Settings (₹20,000 cash, ₹3,000 Start reward, ₹500 bail)
 * - 120-Second Financial Resolution Timer
 * - Sell to Bank & Acquisition with House Preservation
 * - Bail Key Usage & Statutory ₹500 Bail
 * - Standardized ₹500 GST & Infrastructure Wealth Levy
 * - Immediate Game Termination & Balance-based Winner Selection
 */

import { describe, it, expect } from 'vitest';
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import { applyGameCommand } from '../domain/game-engine/engine';
import { RoomMember } from '../domain/game-types';
import { calculateMortgageValue, DEFAULT_HOST_RULES } from '../domain/ruleset';

const mockMembers: Record<string, RoomMember> = {
  user_1: {
    uid: 'user_1',
    displayName: 'Aarav',
    photoURL: null,
    colorToken: '#C85A32',
    isReady: true,
    joinedAt: Date.now(),
  },
  user_2: {
    uid: 'user_2',
    displayName: 'Diya',
    photoURL: null,
    colorToken: '#1A2B4C',
    isReady: true,
    joinedAt: Date.now() + 1,
  },
  user_3: {
    uid: 'user_3',
    displayName: 'Kabir',
    photoURL: null,
    colorToken: '#2D6A4F',
    isReady: true,
    joinedAt: Date.now() + 2,
  },
};

describe('Acceptance Criteria: Standardized Room Creation Settings', () => {
  it('enforces starting cash ₹20,000, pass Start reward ₹3,000, and bail ₹500, rejecting client overrides', () => {
    // Attempt to pass manipulated custom rules from client
    const forgedRules = {
      startingCash: 50000,
      passStartReward: 10000,
      jailBail: 2500,
      turnTimerSeconds: 45,
      maxPlayers: 4,
      allowAuctions: true,
      gameMode: 'STANDARD' as const,
    };

    const state = createInitialGame('room_1', 'game_1', mockMembers, forgedRules, 'user_1');

    // Authoritative state must sanitize and enforce fixed defaults
    expect(state.rules?.startingCash).toBe(20000);
    expect(state.rules?.passStartReward).toBe(3000);
    expect(state.rules?.jailBail).toBe(500);

    for (const player of state.players) {
      expect(player.cash).toBe(20000);
      expect(player.netWorth).toBe(20000);
    }
  });

  it('accepts valid dynamic starting balance options (5000, 10000, 20000) and start pass rewards (1000, 2000, 3000)', () => {
    // Test 5000 starting cash and 1000 pass reward
    const state5k = createInitialGame('room_1', 'game_1', mockMembers, {
      ...DEFAULT_HOST_RULES,
      startingCash: 5000,
      passStartReward: 1000,
    });
    expect(state5k.rules?.startingCash).toBe(5000);
    expect(state5k.rules?.passStartReward).toBe(1000);
    for (const player of state5k.players) {
      expect(player.cash).toBe(5000);
      expect(player.netWorth).toBe(5000);
    }

    // Test 10000 starting cash and 2000 pass reward
    const state10k = createInitialGame('room_1', 'game_1', mockMembers, {
      ...DEFAULT_HOST_RULES,
      startingCash: 10000,
      passStartReward: 2000,
    });
    expect(state10k.rules?.startingCash).toBe(10000);
    expect(state10k.rules?.passStartReward).toBe(2000);
    for (const player of state10k.players) {
      expect(player.cash).toBe(10000);
      expect(player.netWorth).toBe(10000);
    }

    // Test 20000 starting cash and 3000 pass reward
    const state20k = createInitialGame('room_1', 'game_1', mockMembers, {
      ...DEFAULT_HOST_RULES,
      startingCash: 20000,
      passStartReward: 3000,
    });
    expect(state20k.rules?.startingCash).toBe(20000);
    expect(state20k.rules?.passStartReward).toBe(3000);
    for (const player of state20k.players) {
      expect(player.cash).toBe(20000);
      expect(player.netWorth).toBe(20000);
    }
  });
});

describe('Acceptance Criteria: 120-Second Financial Resolution Timer', () => {
  it('initializes financial resolution with exactly 120 seconds countdown upon rent debt', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    // Setup: user_2 owns Mumbai (space 39) with rent higher than user_1 cash
    state.properties[39].ownerUid = 'user_2';
    state.properties[39].ownershipState = 'OWNED';
    state.players[0].position = 38;
    state.players[0].cash = 50; // Insufficient for Mumbai base rent (₹400)
    state.phase = 'AWAIT_ROLL';

    // user_1 rolls 1 to land on Mumbai
    const res = applyGameCommand(
      state,
      {
        commandId: 'cmd_roll_mumbai',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [0, 1]
    );

    const next = res.nextState;
    expect(next.phase).toBe('ACTION_REQUIRED');
    expect(next.turnTimeRemaining).toBe(120);
    expect(next.pendingFinancialObligation).toBeDefined();
    expect(next.pendingFinancialObligation?.amountDue).toBe(400);
    expect(next.pendingFinancialObligation?.remainingAmountDue).toBe(350);
    expect(next.pendingFinancialObligation?.expiresAt).toBeGreaterThan(Date.now() + 115000);
    expect(next.pendingFinancialObligation?.expiresAt).toBeLessThanOrEqual(Date.now() + 121000);
  });
});

describe('Acceptance Criteria: Sell-to-Bank & Acquisition with House Preservation', () => {
  it('sells a city containing houses to bank: owner receives payout, ownership becomes unassigned, houses remain', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    // user_1 owns Jaipur (space 1) with 3 houses
    const prop1 = state.properties[1];
    prop1.ownerUid = 'user_1';
    prop1.ownershipState = 'OWNED';
    prop1.buildings = 3;

    const expectedMortgageVal = calculateMortgageValue(1, prop1);
    const initialCash = state.players[0].cash;

    // user_1 sells Jaipur to bank
    const res = applyGameCommand(
      state,
      {
        commandId: 'cmd_sell_jaipur',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'MORTGAGE',
        payload: { spaceIndex: 1 },
      },
      'user_1'
    );

    const next = res.nextState;
    const updatedProp = next.properties[1];

    // 1. Bank pays player
    expect(next.players[0].cash).toBe(initialCash + expectedMortgageVal);

    // 2. Ownership is immediately removed from selling player
    expect(updatedProp.ownerUid).toBeNull();
    expect(updatedProp.ownershipState).toBe('UNOWNED');

    // 3. Payout recorded against property
    expect(updatedProp.soldToBankPayout).toBe(expectedMortgageVal);

    // 4. Houses remain intact!
    expect(updatedProp.buildings).toBe(3);

    // 5. Transaction is recorded
    const tx = next.transactions?.find((t) => t.type === 'MORTGAGE_PROCEEDS');
    expect(tx).toBeDefined();
    expect(tx?.amount).toBe(expectedMortgageVal);
    expect(tx?.playerUid).toBe('user_1');
  });

  it('allows another player landing on the bank-sold city to acquire it for the exact sale payout and inherit houses', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_2');

    // Jaipur (space 1) was previously sold to bank for ₹750 with 2 houses
    const prop1 = state.properties[1];
    prop1.ownerUid = null;
    prop1.ownershipState = 'UNOWNED';
    prop1.buildings = 2;
    prop1.soldToBankPayout = 750;

    // user_2 starts at 0, rolls 1 to land on Jaipur
    state.players[1].position = 0;
    state.phase = 'AWAIT_ROLL';

    const rollRes = applyGameCommand(
      state,
      {
        commandId: 'cmd_u2_roll',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_2',
      [0, 1]
    );

    const postRollState = rollRes.nextState;
    expect(postRollState.phase).toBe('PROPERTY_DECISION');
    expect(postRollState.pendingAction?.type).toBe('BUY_OR_AUCTION');

    const u2CashBefore = postRollState.players[1].cash;

    // user_2 acquires Jaipur for ₹750
    const buyRes = applyGameCommand(
      postRollState,
      {
        commandId: 'cmd_u2_acquire',
        roomId: postRollState.roomId,
        gameId: postRollState.gameId,
        expectedVersion: postRollState.version,
        type: 'BUY_PROPERTY',
        payload: { spaceIndex: 1 },
      },
      'user_2'
    );

    const finalState = buyRes.nextState;
    const finalProp = finalState.properties[1];

    // user_2 paid exactly ₹750 (the recorded sale payout)
    expect(finalState.players[1].cash).toBe(u2CashBefore - 750);
    expect(finalProp.ownerUid).toBe('user_2');
    expect(finalProp.ownershipState).toBe('OWNED');
    expect(finalProp.soldToBankPayout).toBeUndefined();

    // Houses are inherited!
    expect(finalProp.buildings).toBe(2);
  });

  it('rejects acquisition if buyer has insufficient balance without altering ownership', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_2');

    const prop1 = state.properties[1];
    prop1.ownerUid = null;
    prop1.ownershipState = 'UNOWNED';
    prop1.soldToBankPayout = 1500;

    state.players[1].position = 1;
    state.players[1].cash = 500; // Needs 1500

    expect(() => {
      applyGameCommand(
        state,
        {
          commandId: 'cmd_poor_buy',
          roomId: state.roomId,
          gameId: state.gameId,
          expectedVersion: state.version,
          type: 'BUY_PROPERTY',
          payload: { spaceIndex: 1 },
        },
        'user_2'
      );
    }).toThrowError(/Insufficient balance to acquire this property/);

    expect(state.properties[1].ownerUid).toBeNull();
    expect(state.properties[1].ownershipState).toBe('UNOWNED');
  });

  it('allows bank-sold infrastructure (e.g. CST Mumbai #5) to be acquired at recorded sale payout', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_3');

    // Space 5: CST Mumbai (Transit, base price 2000, 50% mortgage = 1000)
    const prop5 = state.properties[5];
    prop5.ownerUid = null;
    prop5.ownershipState = 'UNOWNED';
    prop5.soldToBankPayout = 1000;

    state.players[2].position = 5;
    const initialCash = state.players[2].cash;

    const res = applyGameCommand(
      state,
      {
        commandId: 'cmd_u3_buy_transit',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'BUY_PROPERTY',
        payload: { spaceIndex: 5 },
      },
      'user_3'
    );

    expect(res.nextState.players[2].cash).toBe(initialCash - 1000);
    expect(res.nextState.properties[5].ownerUid).toBe('user_3');
    expect(res.nextState.properties[5].ownershipState).toBe('OWNED');
  });

  it('preserves standard purchase price for properties that have never been sold to bank', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    // Jaipur (space 1) has never been sold to bank -> catalog price is ₹600
    state.players[0].position = 1;
    const initialCash = state.players[0].cash;

    const res = applyGameCommand(
      state,
      {
        commandId: 'cmd_u1_buy_jaipur_fresh',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'BUY_PROPERTY',
        payload: { spaceIndex: 1 },
      },
      'user_1'
    );

    expect(res.nextState.players[0].cash).toBe(initialCash - 600);
    expect(res.nextState.properties[1].ownerUid).toBe('user_1');
  });
});

describe('Acceptance Criteria: Jail Key Usage & Statutory ₹500 Bail', () => {
  it('displays and executes USE_JAIL_CARD: consumes 1 key, frees player, allows roll', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    state.players[0].inJail = true;
    state.players[0].jailTurns = 1;
    state.players[0].jailFreeCards = 2;
    state.players[0].position = 10;
    state.phase = 'JAIL_DECISION';

    const res = applyGameCommand(
      state,
      {
        commandId: 'cmd_use_key',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'USE_JAIL_CARD',
        payload: {},
      },
      'user_1'
    );

    const next = res.nextState;
    expect(next.players[0].inJail).toBe(false);
    expect(next.players[0].jailTurns).toBe(0);
    expect(next.players[0].jailFreeCards).toBe(1);
    expect(next.phase).toBe('AWAIT_ROLL');
  });

  it('rejects USE_JAIL_CARD when player has zero keys', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    state.players[0].inJail = true;
    state.players[0].jailFreeCards = 0;
    state.phase = 'JAIL_DECISION';

    expect(() => {
      applyGameCommand(
        state,
        {
          commandId: 'cmd_use_empty_key',
          roomId: state.roomId,
          gameId: state.gameId,
          expectedVersion: state.version,
          type: 'USE_JAIL_CARD',
          payload: {},
        },
        'user_1'
      );
    }).toThrowError(/No Bail Key available|No Get Out of Jail card available/);
  });

  it('enforces that Get Out of Jail cards are strictly non-tradable between players', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
    state.players[0].jailFreeCards = 1;

    // Attempting to propose trade throws INVALID_ACTION
    expect(() => {
      applyGameCommand(
        state,
        {
          commandId: 'cmd_trade',
          roomId: state.roomId,
          gameId: state.gameId,
          expectedVersion: state.version,
          type: 'PROPOSE_TRADE',
          payload: { targetUid: 'user_2' },
        },
        'user_1'
      );
    }).toThrowError(/strictly non-tradable/);
  });

  it('PAY_BAIL deducts exactly ₹500 statutory bail', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.phase = 'JAIL_DECISION';
    const initialCash = state.players[0].cash;

    const res = applyGameCommand(
      state,
      {
        commandId: 'cmd_pay_bail',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'PAY_BAIL',
        payload: {},
      },
      'user_1'
    );

    expect(res.nextState.players[0].inJail).toBe(false);
    expect(res.nextState.players[0].cash).toBe(initialCash - 500);
    expect(res.nextState.phase).toBe('AWAIT_ROLL');
  });
});

describe('Acceptance Criteria: GST Checkpost and Infrastructure Wealth Levy (₹500)', () => {
  it('deducts exactly ₹500 on GST Checkpost (space 8)', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
    state.players[0].position = 7;
    const initialCash = state.players[0].cash;

    const res = applyGameCommand(
      state,
      {
        commandId: 'cmd_roll_gst',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [0, 1] // lands on 8
    );

    expect(res.nextState.players[0].position).toBe(8);
    expect(res.nextState.players[0].cash).toBe(initialCash - 500);
    const tx = res.nextState.transactions?.find((t) => t.type === 'TAX_PAYMENT');
    expect(tx?.amount).toBe(500);
  });

  it('deducts exactly ₹500 on Infrastructure Wealth Levy (space 37)', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
    state.players[0].position = 36;
    const initialCash = state.players[0].cash;

    const res = applyGameCommand(
      state,
      {
        commandId: 'cmd_roll_infra',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [0, 1] // lands on 37
    );

    expect(res.nextState.players[0].position).toBe(37);
    expect(res.nextState.players[0].cash).toBe(initialCash - 500);
    const tx = res.nextState.transactions?.find((t) => t.type === 'TAX_PAYMENT');
    expect(tx?.amount).toBe(500);
  });
});

describe('Acceptance Criteria: Immediate Game Termination & Highest Balance Winner', () => {
  it('terminates game immediately when player gives up; player with highest balance wins', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    state.players[0].cash = 10000;
    state.players[1].cash = 25000; // Highest balance
    state.players[2].cash = 18000;

    const res = applyGameCommand(
      state,
      {
        commandId: 'cmd_u1_giveup',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'GIVE_UP',
        payload: {},
      },
      'user_1'
    );

    const next = res.nextState;

    // 1. Surrendering player marked bankrupt & disqualified
    expect(next.players[0].isBankrupt).toBe(true);
    expect(next.players[0].isDisqualified).toBe(true);

    // 2. Session stopped immediately
    expect(next.status).toBe('COMPLETED');
    expect(next.phase).toBe('TURN_END');
    expect(next.turnTimeRemaining).toBe(0);
    expect(next.gameOverReason).toBe('PLAYER_SURRENDER');
    expect(next.disqualifiedPlayerUid).toBe('user_1');

    // 3. Diya (user_2) wins with highest balance (₹25,000)
    expect(next.winnerUid).toBe('user_2');

    // 4. Further actions are strictly rejected
    expect(() => {
      applyGameCommand(
        next,
        {
          commandId: 'cmd_after_gameover',
          roomId: next.roomId,
          gameId: next.gameId,
          expectedVersion: next.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'user_2'
      );
    }).toThrow('Game has already concluded');
  });

  it('terminates game immediately on disqualification (timer timeout); selects highest balance winner', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    state.players[0].cash = 5000;
    state.players[1].cash = 12000;
    state.players[2].cash = 30000; // Kabir has highest balance

    const res = applyGameCommand(
      state,
      {
        commandId: 'cmd_timeout_disqualify',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'GIVE_UP',
        payload: { reason: 'TIMEOUT' },
      },
      'user_1'
    );

    const next = res.nextState;
    expect(next.status).toBe('COMPLETED');
    expect(next.gameOverReason).toBe('PLAYER_DISQUALIFIED');
    expect(next.disqualifiedPlayerUid).toBe('user_1');
    expect(next.winnerUid).toBe('user_3'); // Kabir wins
  });

  it('breaks cash ties using net worth when selecting winner', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    // user_2 and user_3 have identical cash (₹20,000)
    state.players[1].cash = 20000;
    state.players[2].cash = 20000;

    // user_3 owns properties, giving higher net worth
    state.properties[1].ownerUid = 'user_3';
    state.properties[1].ownershipState = 'OWNED';

    const res = applyGameCommand(
      state,
      {
        commandId: 'cmd_u1_surrender_tie',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'GIVE_UP',
        payload: {},
      },
      'user_1'
    );

    expect(res.nextState.status).toBe('COMPLETED');
    expect(res.nextState.winnerUid).toBe('user_3'); // Higher net worth wins tie-breaker
    expect(res.nextState.isTie).toBe(false);
  });
});
