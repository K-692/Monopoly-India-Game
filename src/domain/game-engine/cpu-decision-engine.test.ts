import { describe, it, expect } from 'vitest';
import { createInitialGame } from './create-initial-game';
import {
  decideJailAction,
  decidePropertyAction,
  decideBuildingAction,
  decideSellToBankProperties,
  decideNextAction,
} from './cpu-decision-engine';
import { RoomMember } from '../game-types';

describe('CPU Decision Engine', () => {
  const mockMembers: Record<string, RoomMember> = {
    user_1: {
      uid: 'user_1',
      displayName: 'Player One',
      photoURL: null,
      isReady: true,
      joinedAt: 1,
      colorToken: '#C85A32',
      isCpu: false,
      playerType: 'HUMAN',
    },
    cpu_1: {
      uid: 'cpu_1',
      displayName: 'CPU1',
      photoURL: null,
      isReady: true,
      joinedAt: 2,
      colorToken: '#1A2B4C',
      isCpu: true,
      playerType: 'COMPUTER',
    },
  };

  describe('Jail Decisions', () => {
    it('uses a Bail Key when available', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.inJail = true;
      cpu.jailFreeCards = 1;
      cpu.cash = 20000;

      const decision = decideJailAction(state, cpu);
      expect(decision.type).toBe('USE_JAIL_CARD');
    });

    it('pays statutory bail when key is unavailable and cash is healthy', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.inJail = true;
      cpu.jailFreeCards = 0;
      cpu.cash = 5000;

      const decision = decideJailAction(state, cpu);
      expect(decision.type).toBe('PAY_BAIL');
    });

    it('attempts doubles when key is unavailable and cash is low', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.inJail = true;
      cpu.jailFreeCards = 0;
      cpu.cash = 300; // Less than bail

      const decision = decideJailAction(state, cpu);
      expect(decision.type).toBe('TRY_DOUBLES');
    });
  });

  describe('Property Acquisition Decisions', () => {
    it('decides to buy an unowned city when affordable', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.position = 1; // Guwahati Paltan Bazaar (price ₹600)
      cpu.cash = 10000;

      const decision = decidePropertyAction(state, cpu);
      expect(decision.type).toBe('BUY_PROPERTY');
    });

    it('declines to buy an unowned property when cash is insufficient', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.position = 39; // Mumbai Marine Drive (price ₹4000)
      cpu.cash = 2000; // Less than ₹4000

      const decision = decidePropertyAction(state, cpu);
      expect(decision.type).toBe('DECLINE_PROPERTY');
    });

    it('acquires a bank-sold property at recorded sale payout inheriting houses', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.position = 1;
      cpu.cash = 10000;

      // Mark property as sold to bank
      state.properties[1].ownerUid = null;
      state.properties[1].ownershipState = 'UNOWNED';
      state.properties[1].soldToBankPayout = 450;
      state.properties[1].buildings = 2; // 2 houses preserved

      const decision = decidePropertyAction(state, cpu);
      expect(decision.type).toBe('BUY_PROPERTY');
      expect(decision.reason).toContain('bank-sold');
    });

    it('reacquires own property when landing on reacquisition opportunity', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.position = 3;
      cpu.cash = 10000;

      state.reacquisitionOpportunity = {
        landingId: 'reacquire_1',
        turnNumber: 1,
        playerUid: cpu.uid,
        spaceIndex: 3,
        cost: 300,
        status: 'PENDING',
      };

      const decision = decidePropertyAction(state, cpu);
      expect(decision.type).toBe('UNMORTGAGE');
      expect(decision.payload?.spaceIndex).toBe(3);
    });
  });

  describe('Building Decisions', () => {
    it('builds on a monopoly when visiting the city and liquidity reserve is satisfied', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.cash = 10000;
      cpu.position = 1; // Visiting space 1
      state.turnNumber = 2; // Next turn after purchase

      // Grant Brown monopoly (spaces 1 and 3)
      state.properties[1].ownerUid = cpu.uid;
      state.properties[1].ownershipState = 'OWNED';
      state.properties[1].buildings = 0;
      state.properties[1].boughtOnTurn = 1;

      state.properties[3].ownerUid = cpu.uid;
      state.properties[3].ownershipState = 'OWNED';
      state.properties[3].buildings = 0;
      state.properties[3].boughtOnTurn = 1;

      const build = decideBuildingAction(state, cpu);
      expect(build).not.toBeNull();
      expect(build?.spaceIndex).toBe(1);
    });

    it('does not build if remaining cash would drop below reserve', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.cash = 1600; // Building cost is 500, remaining would be 1100 < 1500 reserve
      cpu.position = 1;
      state.turnNumber = 2;

      state.properties[1].ownerUid = cpu.uid;
      state.properties[1].ownershipState = 'OWNED';
      state.properties[1].boughtOnTurn = 1;
      state.properties[3].ownerUid = cpu.uid;
      state.properties[3].ownershipState = 'OWNED';
      state.properties[3].boughtOnTurn = 1;

      const build = decideBuildingAction(state, cpu);
      expect(build).toBeNull();
    });
  });

  describe('Sell to Bank (Mortgage) Priority Order', () => {
    it('sells unbuilt cities before cities with houses', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.cash = 0;

      // CPU owns a city with 3 houses and an unbuilt city
      state.properties[1].ownerUid = cpu.uid;
      state.properties[1].ownershipState = 'OWNED';
      state.properties[1].buildings = 0; // Unbuilt city

      state.properties[3].ownerUid = cpu.uid;
      state.properties[3].ownershipState = 'OWNED';
      state.properties[3].buildings = 3; // Built city

      // Debt is small enough to be covered by selling space 1
      const plan = decideSellToBankProperties(state, cpu, 200);
      expect(plan.selectedIndices).toContain(1);
      expect(plan.selectedIndices).not.toContain(3);
    });

    it('prioritizes selling cities with highest houses first when choosing among developed cities', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.cash = 0;

      // Only developed cities owned
      state.properties[1].ownerUid = cpu.uid;
      state.properties[1].ownershipState = 'OWNED';
      state.properties[1].buildings = 1; // 1 house

      state.properties[3].ownerUid = cpu.uid;
      state.properties[3].ownershipState = 'OWNED';
      state.properties[3].buildings = 4; // 4 houses

      // Required debt
      const plan = decideSellToBankProperties(state, cpu, 500);
      // Space 3 (4 houses) should be prioritized first over Space 1 (1 house)
      expect(plan.selectedIndices[0]).toBe(3);
    });

    it('does not sell more property than necessary to cover debt', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.cash = 100;

      state.properties[1].ownerUid = cpu.uid;
      state.properties[1].ownershipState = 'OWNED';
      state.properties[1].buildings = 0; // Value: ₹300

      state.properties[3].ownerUid = cpu.uid;
      state.properties[3].ownershipState = 'OWNED';
      state.properties[3].buildings = 0; // Value: ₹300

      // Debt is ₹350 (needed is ₹250). Selling 1 property (₹300) covers it!
      const plan = decideSellToBankProperties(state, cpu, 350);
      expect(plan.selectedIndices.length).toBe(1);
      expect(plan.canCover).toBe(true);
    });

    it('flags canCover = false when all properties are insufficient', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.cash = 100;

      state.properties[1].ownerUid = cpu.uid;
      state.properties[1].ownershipState = 'OWNED';
      state.properties[1].buildings = 0;

      // Debt of ₹50,000 cannot be covered by space 1 alone
      const plan = decideSellToBankProperties(state, cpu, 50000);
      expect(plan.canCover).toBe(false);
      expect(plan.selectedIndices).toContain(1);
    });
  });

  describe('Master Decision Flow (decideNextAction)', () => {
    it('returns ROLL_DICE during AWAIT_ROLL', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      state.currentPlayerUid = cpu.uid;
      state.phase = 'AWAIT_ROLL';

      const action = decideNextAction(state, cpu);
      expect(action?.type).toBe('ROLL_DICE');
    });

    it('returns RESOLVE_OBLIGATION when debtor has sufficient cash', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.cash = 2000;
      state.phase = 'ACTION_REQUIRED';
      state.pendingFinancialObligation = {
        obligationId: 'ob_1',
        debtorUid: cpu.uid,
        creditorUid: 'user_1',
        amountDue: 500,
        paymentType: 'RENT',
        status: 'PENDING',
        createdAt: Date.now(),
        expiresAt: Date.now() + 120000,
        idempotencyKey: 'rent_1',
      };

      const action = decideNextAction(state, cpu);
      expect(action?.type).toBe('RESOLVE_OBLIGATION');
    });

    it('returns MORTGAGE when debtor has insufficient cash but eligible properties', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.cash = 100;

      state.properties[1].ownerUid = cpu.uid;
      state.properties[1].ownershipState = 'OWNED';
      state.properties[1].buildings = 0;

      state.phase = 'ACTION_REQUIRED';
      state.pendingFinancialObligation = {
        obligationId: 'ob_1',
        debtorUid: cpu.uid,
        creditorUid: 'user_1',
        amountDue: 500,
        paymentType: 'RENT',
        status: 'PENDING',
        createdAt: Date.now(),
        expiresAt: Date.now() + 120000,
        idempotencyKey: 'rent_1',
      };

      const action = decideNextAction(state, cpu);
      expect(action?.type).toBe('MORTGAGE');
      expect(action?.payload?.spaceIndices).toEqual([1]);
    });

    it('returns GIVE_UP when debtor has insufficient cash and no properties to mortgage', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.cash = 100;

      // No properties owned by CPU
      state.phase = 'ACTION_REQUIRED';
      state.pendingFinancialObligation = {
        obligationId: 'ob_1',
        debtorUid: cpu.uid,
        creditorUid: 'user_1',
        amountDue: 500,
        paymentType: 'RENT',
        status: 'PENDING',
        createdAt: Date.now(),
        expiresAt: Date.now() + 120000,
        idempotencyKey: 'rent_1',
      };

      const action = decideNextAction(state, cpu);
      expect(action?.type).toBe('GIVE_UP');
    });

    it('returns END_TURN during MANAGEMENT when no building is desired', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'cpu_1');
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      state.currentPlayerUid = cpu.uid;
      state.phase = 'MANAGEMENT';

      const action = decideNextAction(state, cpu);
      expect(action?.type).toBe('END_TURN');
    });
  });
});
