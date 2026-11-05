/**
 * Indian Monopoly - Comprehensive Test Suite
 * Covers:
 * 1. Bail Rule Consistency: Authoritative configuration across engine, transactions, and deductions.
 * 2. Dice Synchronization: Authoritative single source of truth, exact distance formula, and wrap-around.
 * 3. Token Layering & Grid Integrity: Position calculation and state preservation.
 * 4. Mortgaged City Ownership & Landing: Visiting player pays ₹0 rent, gets 0 buy/reacquire popups;
 *    original owner gets reacquisition opportunity upon landing.
 * 5. Property Wording: 'City' for property vs 'Property' for transit/utilities.
 */

import { describe, it, expect } from 'vitest';
import { applyGameCommand } from '../domain/game-engine/engine';
import { GameCommand, GameState, PlayerState, PropertyState } from '../domain/game-types';
import { BOARD_SPACES } from '../domain/board-config';
import { getAuthoritativeBailAmount, getPropertyNoun, GAME_CONSTANTS } from '../domain/ruleset';

function createMockGameState(overrides?: Partial<GameState>): GameState {
  const p1: PlayerState = {
    uid: 'p1',
    displayName: 'P1 Tycoon',
    photoURL: null,
    cash: 15000,
    netWorth: 15000,
    position: 0,
    inJail: false,
    jailTurns: 0,
    jailFreeCards: 0,
    isBankrupt: false,
    colorToken: '#EF4444',
    turnTimeoutCount: 0,
  };

  const p2: PlayerState = {
    uid: 'p2',
    displayName: 'P2 Mogul',
    photoURL: null,
    cash: 15000,
    netWorth: 15000,
    position: 0,
    inJail: false,
    jailTurns: 0,
    jailFreeCards: 0,
    isBankrupt: false,
    colorToken: '#3B82F6',
    turnTimeoutCount: 0,
  };

  const properties: Record<number, PropertyState> = {};
  for (const space of BOARD_SPACES) {
    if (space.type === 'PROPERTY' || space.type === 'TRANSIT' || space.type === 'UTILITY') {
      properties[space.spaceIndex] = {
        spaceIndex: space.spaceIndex,
        propertyId: space.id,
        ownerUid: null,
        ownershipState: 'UNOWNED',
        isMortgaged: false,
        buildings: 0,
      };
    }
  }

  return {
    roomId: 'room_test1',
    gameId: 'game_test1',
    rulesetVersion: '1.0.0',
    version: 1,
    status: 'IN_PROGRESS',
    playerOrder: ['p1', 'p2'],
    currentPlayerUid: 'p1',
    turnNumber: 1,
    phase: 'AWAIT_ROLL',
    players: [p1, p2],
    properties,
    pendingAction: null,
    dice: null,
    auction: null,
    activeTrade: null,
    winnerUid: null,
    turnTimeRemaining: 30,
    turnTimeLimit: 30,
    rules: {
      startingCash: 15000,
      passStartReward: 2000,
      turnTimerSeconds: 30,
      maxPlayers: 4,
      jailBail: 500,
      allowAuctions: true,
      gameMode: 'STANDARD',
    },
    startedAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    ...overrides,
  };
}

describe('Section 1: Bail Rule Consistency', () => {
  it('reads authoritative bail amount from session rules config', () => {
    const stateDefault = createMockGameState();
    expect(getAuthoritativeBailAmount(stateDefault)).toBe(500);

    const stateCustom200 = createMockGameState({
      rules: {
        startingCash: 15000,
        passStartReward: 2000,
        turnTimerSeconds: 30,
        maxPlayers: 4,
        jailBail: 200,
        allowAuctions: true,
        gameMode: 'STANDARD',
      },
    });
    expect(getAuthoritativeBailAmount(stateCustom200)).toBe(200);

    const stateCustom1000 = createMockGameState({
      rules: {
        startingCash: 15000,
        passStartReward: 2000,
        turnTimerSeconds: 30,
        maxPlayers: 4,
        jailBail: 1000,
        allowAuctions: true,
        gameMode: 'STANDARD',
      },
    });
    expect(getAuthoritativeBailAmount(stateCustom1000)).toBe(1000);

    // Fallback to GAME_CONSTANTS.JAIL_BAIL (500) if rules or jailBail is missing
    expect(getAuthoritativeBailAmount(null)).toBe(GAME_CONSTANTS.JAIL_BAIL);
    expect(getAuthoritativeBailAmount(undefined)).toBe(GAME_CONSTANTS.JAIL_BAIL);
  });

  it('PAY_BAIL deducts the exact configured bail amount and records transaction', () => {
    const state = createMockGameState({
      rules: {
        startingCash: 15000,
        passStartReward: 2000,
        turnTimerSeconds: 30,
        maxPlayers: 4,
        jailBail: 200, // Custom ₹200 bail
        allowAuctions: true,
        gameMode: 'STANDARD',
      },
    });

    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.players[0].cash = 5000;
    state.phase = 'JAIL_DECISION';

    const cmd: GameCommand = {
      commandId: 'cmd_bail',
      roomId: state.roomId,
      gameId: state.gameId,
      expectedVersion: state.version,
      type: 'PAY_BAIL',
      payload: {},
    };

    const res = applyGameCommand(state, cmd, 'p1');

    // Exactly ₹200 must be deducted
    expect(res.nextState.players[0].cash).toBe(4800);
    expect(res.nextState.players[0].inJail).toBe(false);
    expect(res.nextState.phase).toBe('AWAIT_ROLL');

    // Transaction history records exactly ₹200
    const tx = res.nextState.transactions?.find((t) => t.type === 'JAIL_PAYMENT');
    expect(tx).toBeDefined();
    expect(tx?.amount).toBe(200);
    expect(tx?.balanceBefore).toBe(5000);
    expect(tx?.balanceAfter).toBe(4800);
    expect(tx?.description).toContain('₹200 bail');
  });

  it('PAY_BAIL rejects when player does not have enough cash for configured bail', () => {
    const state = createMockGameState({
      rules: {
        startingCash: 15000,
        passStartReward: 2000,
        turnTimerSeconds: 30,
        maxPlayers: 4,
        jailBail: 1000, // ₹1,000 bail
        allowAuctions: true,
        gameMode: 'STANDARD',
      },
    });

    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.players[0].cash = 450; // Insufficient
    state.phase = 'JAIL_DECISION';

    const cmd: GameCommand = {
      commandId: 'cmd_bail_fail',
      roomId: state.roomId,
      gameId: state.gameId,
      expectedVersion: state.version,
      type: 'PAY_BAIL',
      payload: {},
    };

    expect(() => applyGameCommand(state, cmd, 'p1')).toThrowError(/Need ₹1000 for bail/);
  });
});

describe('Section 2: Dice Synchronization with Player Movement', () => {
  it('ROLL_DICE emits authoritative dice values and exact movement coordinates', () => {
    const state = createMockGameState();
    state.players[0].position = 4; // Start at position 4

    const cmd: GameCommand = {
      commandId: 'cmd_roll_1',
      roomId: state.roomId,
      gameId: state.gameId,
      expectedVersion: state.version,
      type: 'ROLL_DICE',
      payload: {},
    };

    // Inject 3 and 4 (Total 7)
    const res = applyGameCommand(state, cmd, 'p1', [3, 4]);

    // Authoritative Dice State
    expect(res.nextState.dice).toBeDefined();
    expect(res.nextState.dice?.first).toBe(3);
    expect(res.nextState.dice?.second).toBe(4);
    expect(res.nextState.dice?.die1).toBe(3);
    expect(res.nextState.dice?.die2).toBe(4);
    expect(res.nextState.dice?.total).toBe(7);
    expect(res.nextState.dice?.oldPos).toBe(4);
    expect(res.nextState.dice?.newPos).toBe(11);
    expect(res.nextState.dice?.rollId).toBeDefined();

    // Event Payload matches authoritative state
    expect(res.event.payload.die1).toBe(3);
    expect(res.event.payload.die2).toBe(4);
    expect(res.event.payload.total).toBe(7);
    expect(res.event.payload.steps).toBe(7);
    expect(res.event.payload.oldPos).toBe(4);
    expect(res.event.payload.newPos).toBe(11);

    // Player position matches exact formula: (oldPos + total) % 40
    expect(res.nextState.players[0].position).toBe(11);
  });

  it('wraps correctly around the 40-grid circular board', () => {
    const state = createMockGameState();
    state.players[0].position = 38; // 2 steps before START

    const cmd: GameCommand = {
      commandId: 'cmd_roll_wrap',
      roomId: state.roomId,
      gameId: state.gameId,
      expectedVersion: state.version,
      type: 'ROLL_DICE',
      payload: {},
    };

    // Inject 2 and 3 (Total 5): 38 + 5 = 43 % 40 = 3
    const res = applyGameCommand(state, cmd, 'p1', [2, 3]);

    expect(res.nextState.dice?.oldPos).toBe(38);
    expect(res.nextState.dice?.newPos).toBe(3);
    expect(res.nextState.players[0].position).toBe(3);
    expect(res.event.payload.oldPos).toBe(38);
    expect(res.event.payload.newPos).toBe(3);

    // Passed START reward awarded
    const startTx = res.nextState.transactions?.find((t) => t.type === 'START_REWARD');
    expect(startTx).toBeDefined();
    expect(startTx?.amount).toBe(2000);
  });

  it('TRY_DOUBLES populates complete authoritative dice state and payload', () => {
    const state = createMockGameState();
    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.phase = 'JAIL_DECISION';

    const cmd: GameCommand = {
      commandId: 'cmd_doubles_success',
      roomId: state.roomId,
      gameId: state.gameId,
      expectedVersion: state.version,
      type: 'TRY_DOUBLES',
      payload: {},
    };

    // Roll doubles: [4, 4] -> total 8, newPos = (10 + 8) = 18
    const res = applyGameCommand(state, cmd, 'p1', [4, 4]);

    expect(res.nextState.dice?.first).toBe(4);
    expect(res.nextState.dice?.second).toBe(4);
    expect(res.nextState.dice?.total).toBe(8);
    expect(res.nextState.dice?.isDouble).toBe(true);
    expect(res.nextState.dice?.oldPos).toBe(10);
    expect(res.nextState.dice?.newPos).toBe(18);

    expect(res.event.payload.oldPos).toBe(10);
    expect(res.event.payload.newPos).toBe(18);
    expect(res.event.payload.total).toBe(8);

    expect(res.nextState.players[0].inJail).toBe(false);
    expect(res.nextState.players[0].position).toBe(18);
  });
});

describe('Section 3 & 4: Mortgaged City Ownership & Landing Rules', () => {
  it('BUY_PROPERTY strictly rejects buying a mortgaged property from any entry point', () => {
    const state = createMockGameState();
    // Space 1 is Old Delhi (PROPERTY)
    state.properties[1].ownerUid = 'p2';
    state.properties[1].ownershipState = 'MORTGAGED';
    state.properties[1].isMortgaged = true;

    state.players[0].position = 1;
    state.phase = 'PROPERTY_DECISION';

    const cmd: GameCommand = {
      commandId: 'cmd_illegal_buy',
      roomId: state.roomId,
      gameId: state.gameId,
      expectedVersion: state.version,
      type: 'BUY_PROPERTY',
      payload: {},
    };

    expect(() => applyGameCommand(state, cmd, 'p1')).toThrowError(/already owned, mortgaged, or blocked/);
  });

  it('when another player lands on a mortgaged city: ₹0 rent, no buy popup, no reacquire popup, ownership unchanged', () => {
    const state = createMockGameState();
    // Space 3 is Connaught Place (PROPERTY) owned by P2 and MORTGAGED
    state.properties[3].ownerUid = 'p2';
    state.properties[3].ownershipState = 'MORTGAGED';
    state.properties[3].isMortgaged = true;
    state.properties[3].mortgagePayout = 1200;

    const p1InitialCash = state.players[0].cash;
    const p2InitialCash = state.players[1].cash;

    // P1 rolls and lands on Space 3 (Start at 0, roll 1 + 2 = 3)
    const cmd: GameCommand = {
      commandId: 'cmd_p1_lands_mortgaged',
      roomId: state.roomId,
      gameId: state.gameId,
      expectedVersion: state.version,
      type: 'ROLL_DICE',
      payload: {},
    };

    const res = applyGameCommand(state, cmd, 'p1', [1, 2]);

    expect(res.nextState.players[0].position).toBe(3);

    // Rule 1: No rent paid (balances unchanged)
    expect(res.nextState.players[0].cash).toBe(p1InitialCash);
    expect(res.nextState.players[1].cash).toBe(p2InitialCash);

    // Rule 2: No buy or auction popup
    expect(res.nextState.pendingAction).toBeNull();

    // Rule 3: No reacquisition opportunity for visiting non-owner
    expect(res.nextState.reacquisitionOpportunity).toBeNull();

    // Rule 4: Ownership unchanged
    expect(res.nextState.properties[3].ownerUid).toBe('p2');
    expect(res.nextState.properties[3].isMortgaged).toBe(true);

    // Rule 5: Phase advances smoothly to MANAGEMENT
    expect(res.nextState.phase).toBe('MANAGEMENT');
  });

  it('when the mortgagor lands on their own mortgaged city: reacquisition opportunity is created', () => {
    const state = createMockGameState();
    // Space 3 is owned by P1 and MORTGAGED
    state.properties[3].ownerUid = 'p1';
    state.properties[3].ownershipState = 'MORTGAGED';
    state.properties[3].isMortgaged = true;
    state.properties[3].mortgagePayout = 1200;

    // P1 lands on Space 3 (Start at 0, roll 1 + 2 = 3)
    const cmd: GameCommand = {
      commandId: 'cmd_p1_reacquire_landing',
      roomId: state.roomId,
      gameId: state.gameId,
      expectedVersion: state.version,
      type: 'ROLL_DICE',
      payload: {},
    };

    const res = applyGameCommand(state, cmd, 'p1', [1, 2]);

    expect(res.nextState.players[0].position).toBe(3);

    // Reacquisition opportunity created with exact mortgage payout received
    expect(res.nextState.reacquisitionOpportunity).toBeDefined();
    expect(res.nextState.reacquisitionOpportunity?.spaceIndex).toBe(3);
    expect(res.nextState.reacquisitionOpportunity?.cost).toBe(1200);
    expect(res.nextState.reacquisitionOpportunity?.status).toBe('PENDING');
    expect(res.nextState.phase).toBe('PROPERTY_DECISION');
  });
});

describe('Section 5: Property Wording Standardize', () => {
  it('identifies City vs Property accurately using getPropertyNoun', () => {
    // City spaces (type: 'PROPERTY')
    const delhi = BOARD_SPACES[1]; // Old Delhi
    const mumbai = BOARD_SPACES[39]; // Marine Drive
    expect(delhi.type).toBe('PROPERTY');
    expect(mumbai.type).toBe('PROPERTY');
    expect(getPropertyNoun(delhi)).toBe('City');
    expect(getPropertyNoun(mumbai)).toBe('City');

    // Transit spaces (type: 'TRANSIT')
    const airport = BOARD_SPACES[25]; // Santacruz Airport
    const railway = BOARD_SPACES[5]; // Howrah Station
    expect(airport.type).toBe('TRANSIT');
    expect(railway.type).toBe('TRANSIT');
    expect(getPropertyNoun(airport)).toBe('Property');
    expect(getPropertyNoun(railway)).toBe('Property');

    // Utility spaces (type: 'UTILITY')
    const best = BOARD_SPACES[17]; // Electricity space
    expect(best.type).toBe('UTILITY');
    expect(getPropertyNoun(best)).toBe('Property');

    // Special spaces
    const jail = BOARD_SPACES[10];
    expect(getPropertyNoun(jail)).toBe('Property');
    expect(getPropertyNoun(null)).toBe('Property');
    expect(getPropertyNoun(undefined)).toBe('Property');
  });
});
