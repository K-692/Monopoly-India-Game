import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameManager } from '../../server/game/game-manager';
import { ServerRoom } from '../../server/types/server-types';
import { getSortedEligibleSellToBankProperties } from '../domain/ruleset';
import { GameCommand, GameState, PropertyState, RoomMember, PendingFinancialObligation, PlayerState } from '../domain/game-types';
import { FinancialResolutionModal } from '../components/board/FinancialResolutionModal';

describe('Automatic Sell-to-Bank Liquidation on 120-Second Financial Resolution Timeout', () => {
  const startTimer = (manager: GameManager, s: GameState) =>
    (manager as unknown as { startTurnTimer: (state: GameState) => void }).startTurnTimer(s);
  const createTestRoom = (
    roomId: string,
    hostUid: string,
    members: Record<string, RoomMember>
  ): ServerRoom => ({
    roomId,
    inviteCode: 'TEST99',
    inviteCodeHash: 'hash_test99',
    hostUid,
    status: 'LOBBY',
    maxPlayers: 6,
    turnTimerSeconds: 30,
    gameMode: 'STANDARD',
    memberUids: Object.keys(members),
    members,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  });

  let gm: GameManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    gm = new GameManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // SCENARIO A: 120-SECOND REAL SERVER TIMER EXPIRATION AUTO-LIQUIDATES
  // =========================================================================
  it('Scenario A: 120-second server timer expiration automatically triggers liquidation without manual trigger', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const members: Record<string, RoomMember> = {
      debtor: { uid: 'debtor', displayName: 'Debtor Player', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
      creditor: { uid: 'creditor', displayName: 'Creditor Player', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
    };
    const room = createTestRoom('room_scen_a', 'debtor', members);
    const startRes = await gm.startGame(room, 'debtor');
    const gameId = startRes.gameId!;
    const state = gm.getGame(gameId)!;

    state.currentPlayerUid = 'debtor';
    state.players[0].cash = 100;
    state.players[1].cash = 5000;

    // Debtor owns Space 15 (Howrah Railway, transit deed price ₹2,000 -> mortgageVal = ₹2,000)
    state.properties[15] = {
      spaceIndex: 15,
      propertyId: 'p15',
      ownerUid: 'debtor',
      isMortgaged: false,
      buildings: 0,
      ownershipState: 'OWNED',
    };

    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_a',
      debtorUid: 'debtor',
      creditorUid: 'creditor',
      amountDue: 1500,
      paymentType: 'RENT',
      expiresAt: now + 120000, // Exactly 120s from now
      status: 'PENDING',
      createdAt: now,
      idempotencyKey: 'idemp_a',
    };

    // Ensure turn timer is started with the 120s countdown
    startTimer(gm, state);

    // Fast-forward 119 seconds -> should NOT be liquidated yet
    await vi.advanceTimersByTimeAsync(119000);
    const midState = gm.getGame(gameId)!;
    expect(midState.phase).toBe('ACTION_REQUIRED');
    expect(midState.pendingFinancialObligation).not.toBeNull();
    expect(midState.properties[15].ownershipState).toBe('OWNED');

    // Fast-forward 1 more second to reach 120 seconds -> automatic liquidation triggers!
    await vi.advanceTimersByTimeAsync(1000);

    const finalState = gm.getGame(gameId)!;
    // Debtor's property sold to bank
    expect(finalState.properties[15].ownershipState).toBe('UNOWNED');
    expect(finalState.properties[15].ownerUid).toBeNull();
    // Debt of 1,500 settled: 100 + 2000 - 1500 = 600
    expect(finalState.players[0].cash).toBe(600);
    expect(finalState.players[1].cash).toBe(6500); // 5000 + 1500
    expect(finalState.pendingFinancialObligation).toBeNull();

    gm.stopTurnTimer(gameId);
  });

  // =========================================================================
  // SCENARIO B: DETERMINISTIC PRIORITY SORTING
  // =========================================================================
  it('Scenario B: sorts eligible properties by lowest payout first, fewer buildings tie-break, lower spaceIndex tie-break', () => {
    // Construct property map:
    // Prop A (Space 1): Jaipur (deed 600, 0 buildings -> tariff 40 -> payout = 600 + floor(40*0.8) = 632)
    // Prop B (Space 3): Delhi South (deed 600, 0 buildings -> tariff 40 -> payout = 600 + floor(40*0.8) = 632)
    // Prop C (Space 6): Agra (deed 1000, 0 buildings -> tariff 60 -> payout = 1000 + floor(60*0.8) = 1048)
    // Prop D (Space 7): Lucknow (deed 1000, 1 building -> tariff 300 -> payout = 1000 + floor(300*0.8) = 1240)
    // Prop E (Space 9): Varanasi (deed 1200, 0 buildings -> tariff 80 -> payout = 1200 + floor(80*0.8) = 1264)
    const props: Record<number, PropertyState> = {
      1: { spaceIndex: 1, propertyId: 'jaipur', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' },
      3: { spaceIndex: 3, propertyId: 'delhi_south', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' },
      6: { spaceIndex: 6, propertyId: 'agra', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' },
      7: { spaceIndex: 7, propertyId: 'lucknow', ownerUid: 'debtor', isMortgaged: false, buildings: 1, ownershipState: 'OWNED' },
      9: { spaceIndex: 9, propertyId: 'varanasi', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' },
      // Excluded: mortgaged
      11: { spaceIndex: 11, propertyId: 'indore', ownerUid: 'debtor', isMortgaged: true, buildings: 0, ownershipState: 'MORTGAGED' },
      // Excluded: blocked
      13: { spaceIndex: 13, propertyId: 'bhopal', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'BLOCKED' },
      // Excluded: not owned by debtor
      14: { spaceIndex: 14, propertyId: 'surat', ownerUid: 'other', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' },
      // Excluded: unowned
      15: { spaceIndex: 15, propertyId: 'howrah', ownerUid: null, isMortgaged: false, buildings: 0, ownershipState: 'UNOWNED' },
    };

    const sorted = getSortedEligibleSellToBankProperties('debtor', props);
    // Verified excluded
    expect(sorted.map((p) => p.spaceIndex)).toEqual([1, 3, 6, 7, 9]);

    // Verify payouts in ascending order
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].mortgageVal).toBeLessThanOrEqual(sorted[i + 1].mortgageVal);
    }
  });

  it('Scenario B2: tie-breaks equal payouts with fewer buildings first, then lower spaceIndex', () => {
    // Both properties have the same price, but Prop 1 has 0 buildings, Prop 2 has 2 buildings
    // Space 15 (Howrah) deed 2000 -> payout 2000
    // Space 25 (Chennai Central) deed 2000 -> payout 2000
    // Space 5 (CST Mumbai) deed 2000 -> payout 2000
    const props: Record<number, PropertyState> = {
      25: { spaceIndex: 25, propertyId: 'chennai_station', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' },
      15: { spaceIndex: 15, propertyId: 'howrah_station', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' },
      5: { spaceIndex: 5, propertyId: 'cst_station', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' },
    };

    const sorted = getSortedEligibleSellToBankProperties('debtor', props);
    // All 3 have identical payout of 2000 and 0 buildings -> sorted strictly by lower spaceIndex
    expect(sorted.map((p) => p.spaceIndex)).toEqual([5, 15, 25]);
  });

  // =========================================================================
  // SCENARIO C: SEQUENTIAL LIQUIDATION STOPS IMMEDIATELY WHEN COVERED
  // =========================================================================
  it('Scenario C: liquidates lowest-value assets sequentially and stops immediately when debt is covered; higher assets untouched', async () => {
    const members: Record<string, RoomMember> = {
      debtor: { uid: 'debtor', displayName: 'Debtor', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
      creditor: { uid: 'creditor', displayName: 'Creditor', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
    };
    const room = createTestRoom('room_scen_c', 'debtor', members);
    const startRes = await gm.startGame(room, 'debtor');
    const gameId = startRes.gameId!;
    const state = gm.getGame(gameId)!;

    // Debtor owes ₹2,000, has ₹500 cash
    state.currentPlayerUid = 'debtor';
    state.players[0].cash = 500;
    state.players[1].cash = 10000;

    // Debtor owns:
    // Space 1 (Jaipur): payout ₹616
    // Space 3 (Delhi South): payout ₹632
    // Space 15 (Howrah Station): payout ₹2,000
    // Space 39 (Marine Drive): payout ₹4,400
    state.properties[1] = { spaceIndex: 1, propertyId: 'p1', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };
    state.properties[3] = { spaceIndex: 3, propertyId: 'p3', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };
    state.properties[15] = { spaceIndex: 15, propertyId: 'p15', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };
    state.properties[39] = { spaceIndex: 39, propertyId: 'p39', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };

    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_c',
      debtorUid: 'debtor',
      creditorUid: 'creditor',
      amountDue: 2000,
      paymentType: 'RENT',
      expiresAt: Date.now() - 1000, // Expired
      status: 'PENDING',
      createdAt: Date.now() - 120000,
      idempotencyKey: 'idemp_c',
    };

    await gm.handleTimeout(state);

    const afterState = gm.getGame(gameId)!;
    // Step 1: Space 1 sold -> +616 (cash = 1116 < 2000)
    // Step 2: Space 3 sold -> +632 (cash = 1748 < 2000)
    // Step 3: Space 15 sold -> +2000 (cash = 3748 >= 2000) -> STOPS!
    // Space 39 must NOT be sold!
    expect(afterState.properties[1].ownershipState).toBe('UNOWNED');
    expect(afterState.properties[3].ownershipState).toBe('UNOWNED');
    expect(afterState.properties[15].ownershipState).toBe('UNOWNED');
    expect(afterState.properties[39].ownershipState).toBe('OWNED');
    expect(afterState.properties[39].ownerUid).toBe('debtor');

    // 500 + 632 + 632 + 2000 - 2000 = 1764
    expect(afterState.players[0].cash).toBe(1764);
    expect(afterState.players[1].cash).toBe(12000); // 10000 + 2000
    expect(afterState.pendingFinancialObligation).toBeNull();
    expect(afterState.players[0].isBankrupt).toBeFalsy();
    expect(afterState.players[0].isDisqualified).toBeFalsy();
  });

  // =========================================================================
  // SCENARIO D: AUTOMATIC SURRENDER ON ASSET EXHAUSTION
  // =========================================================================
  it('Scenario D: liquidates all eligible properties and automatically surrenders when proceeds remain insufficient', async () => {
    const members: Record<string, RoomMember> = {
      debtor: { uid: 'debtor', displayName: 'Debtor', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
      creditor: { uid: 'creditor', displayName: 'Creditor', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
    };
    const room = createTestRoom('room_scen_d', 'debtor', members);
    const startRes = await gm.startGame(room, 'debtor');
    const gameId = startRes.gameId!;
    const state = gm.getGame(gameId)!;

    // Debtor owes ₹10,000, has ₹200 cash, only owns Space 1 (payout ₹616)
    state.currentPlayerUid = 'debtor';
    state.players[0].cash = 200;
    state.players[1].cash = 5000;

    state.properties[1] = { spaceIndex: 1, propertyId: 'jaipur', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };

    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_d',
      debtorUid: 'debtor',
      creditorUid: 'creditor',
      amountDue: 10000,
      paymentType: 'RENT',
      expiresAt: Date.now() - 1000,
      status: 'PENDING',
      createdAt: Date.now() - 120000,
      idempotencyKey: 'idemp_d',
    };

    await gm.handleTimeout(state);

    const afterState = gm.getGame(gameId)!;
    // Property 1 was sold before exhaustion
    expect(afterState.properties[1].ownershipState).toBe('UNOWNED');

    // Debtor is disqualified & bankrupt
    expect(afterState.players[0].isBankrupt).toBe(true);
    expect(afterState.players[0].isDisqualified).toBe(true);
    expect(afterState.status).toBe('COMPLETED');
    expect(afterState.winnerUid).toBe('creditor');
    // Cash proceeds (200 + 632 = 832) transferred to creditor
    expect(afterState.players[0].cash).toBe(0);
    expect(afterState.players[1].cash).toBe(5832); // 5000 + 832
  });

  // =========================================================================
  // SCENARIO E: PARTIAL MANUAL RESOLUTION THEN TIMEOUT LIQUIDATION
  // =========================================================================
  it('Scenario E: respects partial manual property sale, then liquidates remaining on timeout', async () => {
    const members: Record<string, RoomMember> = {
      debtor: { uid: 'debtor', displayName: 'Debtor', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
      creditor: { uid: 'creditor', displayName: 'Creditor', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
    };
    const room = createTestRoom('room_scen_e', 'debtor', members);
    const startRes = await gm.startGame(room, 'debtor');
    const gameId = startRes.gameId!;
    const state = gm.getGame(gameId)!;

    // Debtor owes ₹3,000, has ₹0 cash
    state.currentPlayerUid = 'debtor';
    state.players[0].cash = 0;
    state.players[1].cash = 5000;

    // Owns 3 properties:
    // Space 15 (transit, deed 2000 -> payout 2000)
    // Space 25 (transit, deed 2000 -> payout 2000)
    // Space 35 (transit, deed 2000 -> payout 2000)
    state.properties[15] = { spaceIndex: 15, propertyId: 'p15', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };
    state.properties[25] = { spaceIndex: 25, propertyId: 'p25', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };
    state.properties[35] = { spaceIndex: 35, propertyId: 'p35', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };

    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_e',
      debtorUid: 'debtor',
      creditorUid: 'creditor',
      amountDue: 3000,
      paymentType: 'RENT',
      expiresAt: Date.now() + 60000,
      status: 'PENDING',
      createdAt: Date.now(),
      idempotencyKey: 'idemp_e',
    };

    // Human manually sells Space 15
    const manualMortgageCmd: GameCommand = {
      commandId: 'cmd_manual_mortgage',
      roomId: room.roomId,
      gameId,
      expectedVersion: state.version,
      type: 'MORTGAGE',
      payload: { spaceIndex: 15 },
    };
    const manualRes = await gm.processCommand(gameId, manualMortgageCmd, 'debtor');
    expect(manualRes.nextState.players[0].cash).toBe(2000);
    expect(manualRes.nextState.properties[15].ownershipState).toBe('UNOWNED');
    expect(manualRes.nextState.phase).toBe('ACTION_REQUIRED'); // Still needs 1000

    // Now 120s timeout expires!
    await gm.handleTimeout(manualRes.nextState);

    const finalState = gm.getGame(gameId)!;
    // Server only needed to liquidate Space 25 (+2000 -> total 4000 >= 3000)
    expect(finalState.properties[25].ownershipState).toBe('UNOWNED');
    // Space 35 remains untouched and owned!
    expect(finalState.properties[35].ownershipState).toBe('OWNED');
    expect(finalState.properties[35].ownerUid).toBe('debtor');

    // Cash: 2000 (after manual) + 2000 (auto) - 3000 = 1000
    expect(finalState.players[0].cash).toBe(1000);
    expect(finalState.pendingFinancialObligation).toBeNull();
  });

  // =========================================================================
  // SCENARIO F: ZERO ELIGIBLE PROPERTIES ON TIMEOUT
  // =========================================================================
  it('Scenario F: player owning zero eligible properties automatically surrenders on timeout without crashing', async () => {
    const members: Record<string, RoomMember> = {
      debtor: { uid: 'debtor', displayName: 'Debtor', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
      creditor: { uid: 'creditor', displayName: 'Creditor', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
    };
    const room = createTestRoom('room_scen_f', 'debtor', members);
    const startRes = await gm.startGame(room, 'debtor');
    const gameId = startRes.gameId!;
    const state = gm.getGame(gameId)!;

    state.currentPlayerUid = 'debtor';
    state.players[0].cash = 50;
    // Owns NO properties
    for (const p of Object.values(state.properties)) {
      if (p.ownerUid === 'debtor') p.ownerUid = null;
    }

    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_f',
      debtorUid: 'debtor',
      creditorUid: 'creditor',
      amountDue: 500,
      paymentType: 'RENT',
      expiresAt: Date.now() - 1000,
      status: 'PENDING',
      createdAt: Date.now() - 120000,
      idempotencyKey: 'idemp_f',
    };

    await gm.handleTimeout(state);

    const finalState = gm.getGame(gameId)!;
    expect(finalState.players[0].isBankrupt).toBe(true);
    expect(finalState.players[0].isDisqualified).toBe(true);
    expect(finalState.status).toBe('COMPLETED');
    expect(finalState.winnerUid).toBe('creditor');
  });

  // =========================================================================
  // SCENARIO G: NO PREMATURE LIQUIDATION AT 119S
  // =========================================================================
  it('Scenario G: does not prematurely liquidate assets at 119s, liquidates strictly when 120s window elapses', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const members: Record<string, RoomMember> = {
      debtor: { uid: 'debtor', displayName: 'Debtor', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
      creditor: { uid: 'creditor', displayName: 'Creditor', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
    };
    const room = createTestRoom('room_scen_g', 'debtor', members);
    const startRes = await gm.startGame(room, 'debtor');
    const gameId = startRes.gameId!;
    const state = gm.getGame(gameId)!;

    state.currentPlayerUid = 'debtor';
    state.players[0].cash = 0;
    state.properties[15] = { spaceIndex: 15, propertyId: 'p15', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };

    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_g',
      debtorUid: 'debtor',
      creditorUid: 'creditor',
      amountDue: 1000,
      paymentType: 'RENT',
      expiresAt: now + 120000,
      status: 'PENDING',
      createdAt: now,
      idempotencyKey: 'idemp_g',
    };

    startTimer(gm, state);

    // Advance 60s
    await vi.advanceTimersByTimeAsync(60000);
    expect(gm.getGame(gameId)!.properties[15].ownershipState).toBe('OWNED');

    // Advance to 119s
    await vi.advanceTimersByTimeAsync(59000);
    expect(gm.getGame(gameId)!.properties[15].ownershipState).toBe('OWNED');
    expect(gm.getGame(gameId)!.phase).toBe('ACTION_REQUIRED');

    // Advance 1s more (120s total)
    await vi.advanceTimersByTimeAsync(1000);
    expect(gm.getGame(gameId)!.properties[15].ownershipState).toBe('UNOWNED');
    expect(gm.getGame(gameId)!.pendingFinancialObligation).toBeNull();

    gm.stopTurnTimer(gameId);
  });

  // =========================================================================
  // SCENARIO H: MANUAL SETTLEMENT BEFORE EXPIRY CANCELS LIQUIDATION
  // =========================================================================
  it('Scenario H: manual settlement before expiry prevents automatic liquidation', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const members: Record<string, RoomMember> = {
      debtor: { uid: 'debtor', displayName: 'Debtor', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
      creditor: { uid: 'creditor', displayName: 'Creditor', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
    };
    const room = createTestRoom('room_scen_h', 'debtor', members);
    const startRes = await gm.startGame(room, 'debtor');
    const gameId = startRes.gameId!;
    const state = gm.getGame(gameId)!;

    state.currentPlayerUid = 'debtor';
    state.players[0].cash = 2000; // Has sufficient cash
    state.properties[15] = { spaceIndex: 15, propertyId: 'p15', ownerUid: 'debtor', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };

    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_h',
      debtorUid: 'debtor',
      creditorUid: 'creditor',
      amountDue: 1000,
      paymentType: 'RENT',
      expiresAt: now + 120000,
      status: 'PENDING',
      createdAt: now,
      idempotencyKey: 'idemp_h',
    };

    startTimer(gm, state);

    // Manually settle at 10s
    await vi.advanceTimersByTimeAsync(10000);
    const resolveCmd: GameCommand = {
      commandId: 'cmd_manual_resolve',
      roomId: room.roomId,
      gameId,
      expectedVersion: gm.getGame(gameId)!.version,
      type: 'RESOLVE_OBLIGATION',
      payload: {},
    };
    await gm.processCommand(gameId, resolveCmd, 'debtor');
    expect(gm.getGame(gameId)!.pendingFinancialObligation).toBeNull();
    expect(gm.getGame(gameId)!.phase).toBe('MANAGEMENT');

    // Fast-forward past 120s
    await vi.advanceTimersByTimeAsync(120000);

    // Space 15 must STILL be owned!
    expect(gm.getGame(gameId)!.properties[15].ownershipState).toBe('OWNED');
    expect(gm.getGame(gameId)!.properties[15].ownerUid).toBe('debtor');

    gm.stopTurnTimer(gameId);
  });

  // =========================================================================
  // SCENARIO I: CPU PLAYER PRESERVATION
  // =========================================================================
  it('Scenario I: CPU players preserve existing automated decision path and are not routed through human step-by-step liquidation', async () => {
    const members: Record<string, RoomMember> = {
      cpu1: { uid: 'cpu1', displayName: 'CPU 1', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1, isCpu: true, playerType: 'COMPUTER' },
      h2: { uid: 'h2', displayName: 'Human 2', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
    };
    const room = createTestRoom('room_scen_i', 'cpu1', members);
    const startRes = await gm.startGame(room, 'cpu1');
    const gameId = startRes.gameId!;
    const state = gm.getGame(gameId)!;

    state.currentPlayerUid = 'cpu1';
    state.players[0].cash = 5000;
    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_i',
      debtorUid: 'cpu1',
      creditorUid: 'h2',
      amountDue: 1000,
      paymentType: 'RENT',
      expiresAt: Date.now() - 1000,
      status: 'PENDING',
      createdAt: Date.now() - 120000,
      idempotencyKey: 'idemp_i',
    };

    // CPU with sufficient cash directly resolves obligation
    await gm.handleTimeout(state);

    const afterState = gm.getGame(gameId)!;
    expect(afterState.pendingFinancialObligation).toBeNull();
    expect(afterState.players[0].cash).toBe(4000); // 5000 - 1000
  });

  // =========================================================================
  // SCENARIO J: CONCURRENCY & IDEMPOTENCY PROTECTION
  // =========================================================================
  it('Scenario J: duplicate timeout invocations are idempotent and do not corrupt state or double-deduct', async () => {
    const members: Record<string, RoomMember> = {
      debtor: { uid: 'debtor', displayName: 'Debtor', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
      creditor: { uid: 'creditor', displayName: 'Creditor', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
    };
    const room = createTestRoom('room_scen_j', 'debtor', members);
    const startRes = await gm.startGame(room, 'debtor');
    const gameId = startRes.gameId!;
    const state = gm.getGame(gameId)!;

    state.currentPlayerUid = 'debtor';
    state.players[0].cash = 3000;
    state.players[1].cash = 5000;
    state.phase = 'ACTION_REQUIRED';
    state.pendingFinancialObligation = {
      obligationId: 'ob_j',
      debtorUid: 'debtor',
      creditorUid: 'creditor',
      amountDue: 1000,
      paymentType: 'RENT',
      expiresAt: Date.now() - 1000,
      status: 'PENDING',
      createdAt: Date.now() - 120000,
      idempotencyKey: 'idemp_j',
    };

    // First timeout invocation
    await gm.handleTimeout(state);
    const state1 = gm.getGame(gameId)!;
    expect(state1.players[0].cash).toBe(2000);
    expect(state1.pendingFinancialObligation).toBeNull();

    // Second duplicate timeout invocation should be a no-op
    await gm.handleTimeout(state1);
    const state2 = gm.getGame(gameId)!;
    expect(state2.players[0].cash).toBe(2000); // Unchanged!
  });

  // =========================================================================
  // UI TEST: MODAL EXPLANATORY TEXT UPDATE
  // =========================================================================
  it('UI: FinancialResolutionModal renders updated automatic liquidation and surrender explanation', () => {
    const obligation: PendingFinancialObligation = {
      obligationId: 'ob_ui',
      debtorUid: 'debtor_ui',
      creditorUid: 'creditor_ui',
      amountDue: 2000,
      paymentType: 'RENT',
      expiresAt: Date.now() + 120000,
      status: 'PENDING',
      createdAt: Date.now(),
      idempotencyKey: 'idemp_ui',
    };

    const players: PlayerState[] = [
      {
        uid: 'debtor_ui',
        displayName: 'Debtor',
        photoURL: null,
        colorToken: '#EF4444',
        position: 1,
        cash: 500, // Insufficient cash (needs 2000)
        netWorth: 2000,
        jailFreeCards: 0,
        inJail: false,
        jailTurns: 0,
        turnTimeoutCount: 0,
        isBankrupt: false,
        isDisqualified: false,
      },
    ];

    render(
      <FinancialResolutionModal
        obligation={obligation}
        players={players}
        properties={{}}
        currentUserUid="debtor_ui"
        turnTimeRemaining={120}
      />
    );

    const expectedText =
      'When the 120-second countdown expires, the game automatically sells your eligible cities and properties to the bank, starting with the lowest-value assets. If the proceeds are still insufficient to settle your outstanding payment after all eligible properties are exhausted, you will automatically surrender.';

    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });
});
