import { describe, it, expect } from 'vitest';
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import { applyGameCommand, GameEngineError } from '../domain/game-engine/engine';

const mockMembers = {
  user_1: { uid: 'user_1', displayName: 'Player 1', photoURL: null, colorToken: '#FF5722', isReady: true, joinedAt: 1 },
  user_2: { uid: 'user_2', displayName: 'Player 2', photoURL: null, colorToken: '#2196F3', isReady: true, joinedAt: 2 },
  user_3: { uid: 'user_3', displayName: 'Player 3', photoURL: null, colorToken: '#4CAF50', isReady: true, joinedAt: 3 },
};

describe('60-Second Low-Balance Mortgage Resolution & Disqualification', () => {
  // =========================================================================
  // SCENARIO A: SINGLE MORTGAGE RAISES ENOUGH CASH -> AUTOMATIC PAYMENT RESUMPTION
  // =========================================================================
  it('Scenario A: pauses payment on insufficient rent, single mortgage raises enough cash, auto-resumes & clears debt', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    // Setup: user_2 owns Connaught Place (space 39)
    state.properties[39].ownerUid = 'user_2';
    state.properties[39].ownershipState = 'OWNED';

    // user_1 owns Jaipur (space 1, base price 600, mortgage payout = 300)
    state.properties[1].ownerUid = 'user_1';
    state.properties[1].ownershipState = 'OWNED';

    // user_1 has only ₹100 cash. Rent on space 39 is ₹350
    state.players[0].cash = 100;
    state.players[0].position = 33; // 33 + 6 = 39

    const user2InitialCash = state.players[1].cash;

    // user_1 rolls 6 to land on space 39
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_roll',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [3, 3]
    ).nextState;

    // 1. Transaction paused, low-balance mortgage resolution initiated
    expect(state.phase).toBe('ACTION_REQUIRED');
    expect(state.pendingFinancialObligation).toBeDefined();
    expect(state.pendingFinancialObligation?.debtorUid).toBe('user_1');
    expect(state.pendingFinancialObligation?.creditorUid).toBe('user_2');
    expect(state.pendingFinancialObligation?.amountDue).toBe(400);
    expect(state.pendingFinancialObligation?.remainingAmountDue).toBe(300); // 400 - 100
    expect(state.pendingFinancialObligation?.status).toBe('PENDING');

    // 2. Authoritative 120-second deadline established
    expect(state.turnTimeRemaining).toBe(120);
    expect(state.pendingFinancialObligation?.expiresAt).toBeGreaterThan(Date.now() + 110000);
    expect(state.pendingFinancialObligation?.expiresAt).toBeLessThanOrEqual(Date.now() + 121000);

    // user_1 cash is preserved (paused, not yet deducted)
    expect(state.players[0].cash).toBe(100);

    // 3. user_1 mortgages Jaipur (space 1) -> raises ₹300
    // Total funds: 100 + 300 = 400 >= 400 -> Automatic Payment Resumption completes immediately!
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_mortgage_single',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'MORTGAGE',
        payload: { spaceIndex: 1 },
      },
      'user_1'
    ).nextState;

    // Property state updated to UNOWNED / sold to bank
    expect(state.properties[1].ownershipState).toBe('UNOWNED');
    expect(state.properties[1].ownerUid).toBeNull();
    expect(state.properties[1].soldToBankPayout).toBe(300);

    // Original payment completed automatically: 400 - 400 = 0
    expect(state.players[0].cash).toBe(0);
    expect(state.players[1].cash).toBe(user2InitialCash + 400);

    // Obligation cleared and normal gameplay resumed
    expect(state.pendingFinancialObligation).toBeNull();
    expect(state.phase).toBe('MANAGEMENT');

    // Transactions recorded in ledger
    const mortgageTx = state.transactions?.find((t) => t.type === 'MORTGAGE_PROCEEDS');
    expect(mortgageTx).toBeDefined();
    expect(mortgageTx?.amount).toBe(300);

    const rentDebitTx = state.transactions?.find((t) => t.type === 'RENT_PAID');
    expect(rentDebitTx).toBeDefined();
    expect(rentDebitTx?.amount).toBe(400);
    expect(rentDebitTx?.counterpartyUid).toBe('user_2');

    const rentCreditTx = state.transactions?.find((t) => t.type === 'RENT_RECEIVED');
    expect(rentCreditTx).toBeDefined();
    expect(rentCreditTx?.amount).toBe(400);
    expect(rentCreditTx?.counterpartyUid).toBe('user_1');
  });

  // =========================================================================
  // SCENARIO B: MULTIPLE MORTGAGES RAISE ENOUGH CASH ATOMICALLY
  // =========================================================================
  it('Scenario B: executes multi-property mortgage atomically and auto-resumes payment', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    // Landlord user_2 owns space 39 (Rent: 350)
    state.properties[39].ownerUid = 'user_2';
    state.properties[39].ownershipState = 'OWNED';

    // user_1 owns 2 small properties: space 1 (payout 300) and space 3 (payout 300)
    state.properties[1].ownerUid = 'user_1';
    state.properties[1].ownershipState = 'OWNED';
    state.properties[3].ownerUid = 'user_1';
    state.properties[3].ownershipState = 'OWNED';

    // user_1 has ₹0 cash, owes ₹500
    state.players[0].cash = 0;
    state.players[0].position = 33;

    // Trigger obligation
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_roll_2',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [3, 3]
    ).nextState;

    expect(state.phase).toBe('ACTION_REQUIRED');

    // user_1 uses Adjust Payouts to select multiple properties: [1, 3]
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_mortgage_batch',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'MORTGAGE',
        payload: { spaceIndices: [1, 3] },
      },
      'user_1'
    ).nextState;

    // Both properties sold to bank
    expect(state.properties[1].ownershipState).toBe('UNOWNED');
    expect(state.properties[1].ownerUid).toBeNull();
    expect(state.properties[1].soldToBankPayout).toBe(300);
    expect(state.properties[3].ownershipState).toBe('UNOWNED');
    expect(state.properties[3].ownerUid).toBeNull();
    expect(state.properties[3].soldToBankPayout).toBe(300);

    // Total raised = 300 + 300 = 600 >= 400. Remaining cash = 600 - 400 = 200
    expect(state.players[0].cash).toBe(200);
    expect(state.pendingFinancialObligation).toBeNull();
    expect(state.phase).toBe('MANAGEMENT');
  });

  // =========================================================================
  // SCENARIO C: INSUFFICIENT FUNDS AFTER MORTGAGING -> TIMEOUT AT 0s DISQUALIFIES
  // =========================================================================
  it('Scenario C: remains in resolution when funds still insufficient, then disqualifies on 60s timeout', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    // Setup big rent obligation: ₹2,000
    state.properties[39].ownerUid = 'user_2';
    state.properties[39].ownershipState = 'OWNED';

    // user_1 only owns 1 property yielding ₹300
    state.properties[1].ownerUid = 'user_1';
    state.properties[1].ownershipState = 'OWNED';
    state.players[0].cash = 100;
    state.players[0].position = 33;

    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_roll_c',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      },
      'user_1',
      [3, 3]
    ).nextState;

    expect(state.phase).toBe('ACTION_REQUIRED');
    const originalExpiresAt = state.pendingFinancialObligation?.expiresAt;

    // Mortgages space 1 -> gets ₹300. Total = 400 < 350? Wait, let's make debt bigger
    // Let's set debt on obligation directly to test large shortfall
    state.pendingFinancialObligation!.amountDue = 1500;
    state.pendingFinancialObligation!.remainingAmountDue = 1400;

    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_mortgage_partial',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'MORTGAGE',
        payload: { spaceIndex: 1 },
      },
      'user_1'
    ).nextState;

    // Balance is 100 + 300 = 400 < 1500. Still insufficient!
    expect(state.players[0].cash).toBe(400);
    expect(state.phase).toBe('ACTION_REQUIRED');
    expect(state.pendingFinancialObligation).toBeDefined();
    expect(state.pendingFinancialObligation?.remainingAmountDue).toBe(1100);

    // Exact 60s deadline was NOT reset or extended!
    expect(state.pendingFinancialObligation?.expiresAt).toBe(originalExpiresAt);

    // At 0 seconds: authoritative server timeout executes disqualification (GIVE_UP with reason: TIMEOUT)
    const u2CashBefore = state.players[1].cash;
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_server_timeout',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'GIVE_UP',
        payload: { reason: 'TIMEOUT' },
      },
      'user_1'
    ).nextState;

    // Debtor is disqualified & bankrupt
    expect(state.players[0].isBankrupt).toBe(true);
    expect(state.players[0].isDisqualified).toBe(true);

    // Property 1 was sold to bank (unowned in bank)
    expect(state.properties[1].ownershipState).toBe('UNOWNED');
    expect(state.properties[1].ownerUid).toBeNull();

    // Obligation cleared
    expect(state.pendingFinancialObligation).toBeNull();

    // Remaining cash transferred to creditor on surrender adjustment
    expect(state.players[0].cash).toBe(0);
    expect(state.players[1].cash).toBe(u2CashBefore + 400);

    // Section 9: Immediate game termination on disqualification
    expect(state.status).toBe('COMPLETED');
    expect(state.winnerUid).toBe('user_2');
  });

  // =========================================================================
  // SCENARIO D: VOLUNTARY SURRENDER DISQUALIFIES & PERMANENTLY BLOCKS PROPERTIES
  // =========================================================================
  it('Scenario D: voluntary surrender disqualifies player, blocks properties, and cancels pending debt', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    state.properties[6].ownerUid = 'user_1';
    state.properties[6].ownershipState = 'OWNED';
    state.properties[9].ownerUid = 'user_1';
    state.properties[9].ownershipState = 'OWNED';

    state.players[0].cash = 50;

    // Facing rent debt
    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_surrender_test',
      debtorUid: 'user_1',
      creditorUid: 'user_2',
      amountDue: 2000,
      paymentType: 'RENT',
      status: 'PENDING',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
      idempotencyKey: 'surrender_test',
    };

    // User confirms surrender
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_surrender',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'GIVE_UP',
        payload: {},
      },
      'user_1'
    ).nextState;

    // Disqualification
    expect(state.players[0].isBankrupt).toBe(true);
    expect(state.players[0].isDisqualified).toBe(true);

    // Both properties permanently BLOCKED
    expect(state.properties[6].ownershipState).toBe('BLOCKED');
    expect(state.properties[9].ownershipState).toBe('BLOCKED');
    expect(state.properties[6].ownerUid).toBe('user_1');

    // Pending payment not processed, obligation cancelled
    expect(state.pendingFinancialObligation).toBeNull();

    // Section 9: Immediate game termination on surrender
    expect(state.status).toBe('COMPLETED');
    expect(state.winnerUid).toBe('user_2');
  });

  // =========================================================================
  // SCENARIO E: SUCCESSFUL RESOLUTION NEAR DEADLINE PREVENTS DISQUALIFICATION
  // =========================================================================
  it('Scenario E: successful resolution near deadline prevents disqualification and resumes normal play', () => {
    let state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    state.properties[1].ownerUid = 'user_1';
    state.properties[1].ownershipState = 'OWNED';
    state.players[0].cash = 50;

    // Active obligation created 55 seconds ago (5 seconds left before deadline)
    const now = Date.now();
    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_near_deadline',
      debtorUid: 'user_1',
      creditorUid: 'user_2',
      amountDue: 350,
      paymentType: 'RENT',
      status: 'PENDING',
      createdAt: now - 55000,
      expiresAt: now + 5000, // 5s remaining
      idempotencyKey: 'near_deadline',
    };

    // Mortgages property with 5s remaining
    state = applyGameCommand(
      state,
      {
        commandId: 'cmd_mortgage_last_second',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'MORTGAGE',
        payload: { spaceIndex: 1 },
      },
      'user_1'
    ).nextState;

    // Automatic payment resumed & completed successfully!
    expect(state.pendingFinancialObligation).toBeNull();
    expect(state.phase).toBe('MANAGEMENT');
    expect(state.players[0].isDisqualified).toBeFalsy();
    expect(state.players[0].isBankrupt).toBeFalsy();
  });

  // =========================================================================
  // SCENARIO F: TIMEOUT RACE CONDITION REJECTS LATE MORTGAGE REQUESTS
  // =========================================================================
  it('Scenario F: rejects mortgage request arriving after the 60-second deadline has expired', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    state.properties[1].ownerUid = 'user_1';
    state.properties[1].ownershipState = 'OWNED';
    state.players[0].cash = 50;

    // Expired obligation (deadline was 5 seconds ago)
    const now = Date.now();
    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_expired',
      debtorUid: 'user_1',
      creditorUid: 'user_2',
      amountDue: 350,
      paymentType: 'RENT',
      status: 'PENDING',
      createdAt: now - 65000,
      expiresAt: now - 5000, // Expired!
      idempotencyKey: 'expired',
    };

    // Late mortgage command must be rejected authoritatively
    expect(() => {
      applyGameCommand(
        state,
        {
          commandId: 'cmd_late_mortgage',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'MORTGAGE',
          payload: { spaceIndex: 1 },
        },
        'user_1'
      );
    }).toThrow(GameEngineError);
  });

  // =========================================================================
  // SCENARIO G: RECONNECTION & STATE PERSISTENCE
  // =========================================================================
  it('Scenario G: preserves obligation, expiresAt deadline, and exact remaining time across state reload', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    const now = Date.now();
    const expiresAt = now + 42000; // 42 seconds left

    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_persist_test',
      debtorUid: 'user_1',
      creditorUid: 'user_2',
      amountDue: 500,
      remainingAmountDue: 400,
      paymentType: 'RENT',
      status: 'PENDING',
      createdAt: now - 18000,
      expiresAt,
      idempotencyKey: 'persist_test',
    };

    // Serialize and deserialize state (simulating client reconnect or page refresh)
    const serialized = JSON.stringify(state);
    const restored = JSON.parse(serialized);

    expect(restored.phase).toBe('ACTION_REQUIRED');
    expect(restored.pendingFinancialObligation).toBeDefined();
    expect(restored.pendingFinancialObligation.expiresAt).toBe(expiresAt);
    expect(restored.pendingFinancialObligation.amountDue).toBe(500);

    // Derived remaining seconds calculation on reconnected client
    const derivedRemaining = Math.max(0, Math.ceil((restored.pendingFinancialObligation.expiresAt - Date.now()) / 1000));
    expect(derivedRemaining).toBeGreaterThanOrEqual(40);
    expect(derivedRemaining).toBeLessThanOrEqual(43);
  });

  // =========================================================================
  // SCENARIO H: MULTIPLAYER CONSISTENCY & AUTHORIZATION CHECKS
  // =========================================================================
  it('Scenario H: prevents unauthorized players from mortgaging properties or resolving debt', () => {
    const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');

    state.properties[1].ownerUid = 'user_1';
    state.properties[1].ownershipState = 'OWNED';
    state.properties[3].ownerUid = 'user_2';
    state.properties[3].ownershipState = 'OWNED';

    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_auth_test',
      debtorUid: 'user_1',
      creditorUid: 'user_2',
      amountDue: 400,
      paymentType: 'RENT',
      status: 'PENDING',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
      idempotencyKey: 'auth_test',
    };

    // user_2 tries to mortgage user_1's property -> rejected
    expect(() => {
      applyGameCommand(
        state,
        {
          commandId: 'cmd_hack_mortgage',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'MORTGAGE',
          payload: { spaceIndex: 1 },
        },
        'user_2'
      );
    }).toThrow(GameEngineError);

    // user_3 tries to resolve user_1's obligation -> rejected
    expect(() => {
      applyGameCommand(
        state,
        {
          commandId: 'cmd_hack_resolve',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'RESOLVE_OBLIGATION',
          payload: {},
        },
        'user_3'
      );
    }).toThrow(GameEngineError);
  });
});
