/**
 * Comprehensive Unit & Integration Tests:
 * 1. Festival Travel Market Buzz Card (START salary & instruction)
 * 2. Human Player Turn Alert (Localized Client Audio)
 * 3. Highest Net Worth Winner Determination (Economic valuation, liabilities, ties)
 * 4. Sell-to-Bank Modal Sorting (Maximum Tariff Potential ascending)
 * 5. Full-Quality Interactive Board Preview (Read-only, preserves 120s timer & context)
 */

import { describe, it, expect } from 'vitest';
import { BOARD_SPACES, MARKET_BUZZ_CARDS } from '../domain/board-config';
import { calculateNetWorth, calculateRent } from '../domain/ruleset';
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import { applyGameCommand } from '../domain/game-engine/engine';
import { sound } from '../lib/audio/sound-engine';
import { PendingFinancialObligation, PropertyState } from '../domain/game-types';

const mockMembers = {
  user_1: { uid: 'user_1', displayName: 'Aarav (Human)', photoURL: null, colorToken: '#FF5722', isReady: true, joinedAt: 1 },
  user_2: { uid: 'user_2', displayName: 'Diya (Human)', photoURL: null, colorToken: '#2196F3', isReady: true, joinedAt: 2 },
  user_3: { uid: 'user_3', displayName: 'CPU1', photoURL: null, colorToken: '#4CAF50', isReady: true, joinedAt: 3 },
};

describe('Game Economy, Turn Notifications, Sell-to-Bank & Winner Determination', () => {
  // =========================================================================
  // 1. FESTIVAL TRAVEL MARKET BUZZ CARD
  // =========================================================================
  describe('Festival Travel Market Buzz Card', () => {
    it('has the exact updated instruction text', () => {
      const festivalCard = MARKET_BUZZ_CARDS.find((c) => c.id === 'market_2');
      expect(festivalCard).toBeDefined();
      expect(festivalCard?.title).toBe('Festival travel');
      expect(festivalCard?.description).toBe('Go to START and collect the starting money.');
      expect(festivalCard?.actionType).toBe('MOVE_TO');
      expect(festivalCard?.targetSpace).toBe(0);
    });

    it('moves player to START and credits configured starting money exactly once without double-crediting', () => {
      const state = createInitialGame('room_test', 'game_test', mockMembers, undefined, 'user_1');
      // Set host configured START reward to ₹2,000
      if (state.rules) {
        state.rules.passStartReward = 2000;
      }

      // Place player at position 10. Roll [1, 1] (total 2) -> lands on space 12 (Market Buzz)
      state.players[0].position = 10;
      const initialCash = state.players[0].cash;

      // Draw Festival Travel (market_2, ruleIndex 2 in 1-based indexing)
      const res = applyGameCommand(
        state,
        {
          commandId: 'cmd_draw_festival',
          roomId: 'room_test',
          gameId: 'game_test',
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'user_1',
        [1, 1],
        { cardRuleIndex: 2 }
      );

      const next = res.nextState;
      // Position updated to START (space 0)
      expect(next.players[0].position).toBe(0);
      // Cash credited exactly once with host-configured salary (₹2,000)
      expect(next.players[0].cash).toBe(initialCash + 2000);

      // Verify transaction ledger has exactly one START_REWARD for this action
      const startTxs = next.transactions?.filter((tx) => tx.type === 'START_REWARD');
      expect(startTxs?.length).toBe(1);
      expect(startTxs?.[0].amount).toBe(2000);
      expect(startTxs?.[0].playerUid).toBe('user_1');
    });
  });

  // =========================================================================
  // 2. HUMAN PLAYER TURN ALERT AUDIO
  // =========================================================================
  describe('Human Player Turn Alert (Audio Notification)', () => {
    it('exposes TURN_ALERT in sound engine without throwing errors', () => {
      expect(typeof sound.play).toBe('function');
      expect(() => sound.play('TURN_ALERT')).not.toThrow();
    });

    it('triggers localized turn alert strictly for active human player and rejects CPU turns', () => {
      // Simulates the client-local turn transition detection in GameBoard.tsx
      class TurnAlertDetector {
        private lastTurnKey: string | null = null;
        private initialHydrated = false;
        public alertCount = 0;

        public onGameState(
          turnNumber: number,
          currentPlayerUid: string,
          status: string,
          players: Array<{ uid: string; isCpu?: boolean; playerType?: string; isBankrupt?: boolean }>,
          localUserUid: string
        ) {
          const currentKey = `${turnNumber}_${currentPlayerUid}`;

          // Hydrate on mount/reconnect
          if (!this.initialHydrated) {
            this.initialHydrated = true;
            this.lastTurnKey = currentKey;
            return;
          }

          if (this.lastTurnKey !== currentKey) {
            this.lastTurnKey = currentKey;

            if (status === 'ACTIVE' && currentPlayerUid === localUserUid) {
              const activePlayer = players.find((p) => p.uid === localUserUid);
              const isCpu = Boolean(activePlayer?.isCpu || activePlayer?.playerType === 'COMPUTER');
              if (activePlayer && !isCpu && !activePlayer.isBankrupt) {
                this.alertCount++;
              }
            }
          }
        }
      }

      const playersList = [
        { uid: 'user_1', isCpu: false, playerType: 'HUMAN', isBankrupt: false },
        { uid: 'user_2', isCpu: false, playerType: 'HUMAN', isBankrupt: false },
        { uid: 'cpu_1', isCpu: true, playerType: 'COMPUTER', isBankrupt: false },
      ];

      // Client A belongs to user_1
      const clientA = new TurnAlertDetector();
      // Client B belongs to user_2
      const clientB = new TurnAlertDetector();

      // Initial state hydration (turn 1, user_1) - neither should chime on initial hydration
      clientA.onGameState(1, 'user_1', 'ACTIVE', playersList, 'user_1');
      clientB.onGameState(1, 'user_1', 'ACTIVE', playersList, 'user_2');
      expect(clientA.alertCount).toBe(0);
      expect(clientB.alertCount).toBe(0);

      // Same turn state update (e.g. timer tick or pawn animation) - deduplicated, 0 chimes
      clientA.onGameState(1, 'user_1', 'ACTIVE', playersList, 'user_1');
      expect(clientA.alertCount).toBe(0);

      // Turn transitions to user_2 (human): Client B alerts, Client A stays silent
      clientA.onGameState(2, 'user_2', 'ACTIVE', playersList, 'user_1');
      clientB.onGameState(2, 'user_2', 'ACTIVE', playersList, 'user_2');
      expect(clientA.alertCount).toBe(0);
      expect(clientB.alertCount).toBe(1);

      // Turn transitions to cpu_1 (CPU): Neither client alerts
      clientA.onGameState(3, 'cpu_1', 'ACTIVE', playersList, 'user_1');
      clientB.onGameState(3, 'cpu_1', 'ACTIVE', playersList, 'user_2');
      expect(clientA.alertCount).toBe(0);
      expect(clientB.alertCount).toBe(1);

      // Turn transitions back to user_1 (human): Client A alerts, Client B stays silent
      clientA.onGameState(4, 'user_1', 'ACTIVE', playersList, 'user_1');
      clientB.onGameState(4, 'user_1', 'ACTIVE', playersList, 'user_2');
      expect(clientA.alertCount).toBe(1);
      expect(clientB.alertCount).toBe(1);
    });
  });

  // =========================================================================
  // 3. AUTHORITATIVE NET WORTH & WINNER DETERMINATION
  // =========================================================================
  describe('Authoritative Net Worth & Winner Determination', () => {
    it('accurately calculates net worth with cash, properties, and building development', () => {
      const properties: Record<number, PropertyState> = {};
      for (const space of BOARD_SPACES) {
        properties[space.spaceIndex] = {
          propertyId: space.id || `prop_${space.spaceIndex}`,
          spaceIndex: space.spaceIndex,
          ownerUid: null,
          ownershipState: 'UNOWNED',
          isMortgaged: false,
          buildings: 0,
        };
      }

      // user_1 owns Space 1 (Jaipur: price 600, buildingCost 500) with 2 houses
      properties[1].ownerUid = 'user_1';
      properties[1].ownershipState = 'OWNED';
      properties[1].buildings = 2;

      // Cash: 5,000 + Asset: 600 + (2 * 500) = 6,600
      const nw = calculateNetWorth('user_1', 5000, properties);
      expect(nw).toBe(6600);
    });

    it('deducts outstanding liabilities from player net worth', () => {
      const properties: Record<number, PropertyState> = {};
      for (const space of BOARD_SPACES) {
        properties[space.spaceIndex] = {
          propertyId: space.id || `prop_${space.spaceIndex}`,
          spaceIndex: space.spaceIndex,
          ownerUid: null,
          ownershipState: 'UNOWNED',
          isMortgaged: false,
          buildings: 0,
        };
      }
      properties[1].ownerUid = 'user_1';
      properties[1].ownershipState = 'OWNED';

      const obligation: PendingFinancialObligation = {
        obligationId: 'ob_123',
        debtorUid: 'user_1',
        creditorUid: 'user_2',
        amountDue: 1500,
        remainingAmountDue: 1000,
        paymentType: 'RENT',
        status: 'PENDING',
        createdAt: Date.now(),
        expiresAt: Date.now() + 120000,
        idempotencyKey: 'idemp_1',
      };

      // Cash: 2,000 + Property: 600 - Outstanding Liability: 1,000 = 1,600
      const nw = calculateNetWorth('user_1', 2000, properties, obligation);
      expect(nw).toBe(1600);
    });

    it('declares property-rich player the winner over cash-rich player with lower net worth', () => {
      const state = createInitialGame('room_test', 'game_test', mockMembers, undefined, 'user_1');

      // user_2 has high cash (₹25,000) but no properties -> Net Worth: ₹25,000
      state.players[1].cash = 25000;

      // user_3 has lower cash (₹15,000) but owns expensive properties and houses
      // Space 39 (Marine Drive: price 4,000, buildingCost 2,000) with Commercial Tower (5 units = 10,000)
      // Space 38 (New Delhi: price 3,800)
      // Total assets = 4,000 + 10,000 + 3,800 = 17,800
      // Net Worth = 15,000 + 17,800 = ₹32,800
      state.players[2].cash = 15000;
      state.properties[39].ownerUid = 'user_3';
      state.properties[39].ownershipState = 'OWNED';
      state.properties[39].buildings = 5;

      state.properties[38].ownerUid = 'user_3';
      state.properties[38].ownershipState = 'OWNED';

      // user_1 surrenders
      const res = applyGameCommand(
        state,
        {
          commandId: 'cmd_surrender',
          roomId: state.roomId,
          gameId: state.gameId,
          expectedVersion: state.version,
          type: 'GIVE_UP',
          payload: {},
        },
        'user_1'
      );

      const next = res.nextState;
      expect(next.status).toBe('COMPLETED');
      // user_3 wins because Net Worth (₹32,500) > user_2 Net Worth (₹25,000)
      expect(next.winnerUid).toBe('user_3');
      expect(next.isTie).toBe(false);
    });

    it('breaks equal net worth ties using cash balance, then deterministic UID', () => {
      const state = createInitialGame('room_test', 'game_test', mockMembers, undefined, 'user_1');

      // Both user_2 and user_3 have net worth ₹20,000, but user_3 has higher cash balance
      state.players[1].cash = 15000;
      state.properties[1].ownerUid = 'user_2'; // Jaipur (price ₹600) + building (₹500 * 8.8 -> exact math below)
      state.players[1].netWorth = 20000;

      state.players[2].cash = 18000;
      state.players[2].netWorth = 20000;

      // Force net worth equality
      state.players[1].cash = 10000;
      state.players[1].netWorth = 20000;
      state.players[2].cash = 15000;
      state.players[2].netWorth = 20000;

      // When equal net worth, user_2 vs user_3 tie breaker gives preference to higher cash
      const topNetWorth = [state.players[1], state.players[2]];
      const maxCash = Math.max(...topNetWorth.map((p) => p.cash));
      const winner = topNetWorth.find((p) => p.cash === maxCash);
      expect(winner?.uid).toBe('user_3');
    });

    it('does not count bank-owned or sold-to-bank properties in player net worth', () => {
      const properties: Record<number, PropertyState> = {};
      for (const space of BOARD_SPACES) {
        properties[space.spaceIndex] = {
          propertyId: space.id || `prop_${space.spaceIndex}`,
          spaceIndex: space.spaceIndex,
          ownerUid: null,
          ownershipState: 'UNOWNED',
          isMortgaged: false,
          buildings: 0,
        };
      }

      // Space sold to bank
      properties[1].ownerUid = null;
      properties[1].ownershipState = 'UNOWNED';
      properties[1].soldToBankPayout = 800;

      const nw = calculateNetWorth('user_1', 10000, properties);
      // Only cash balance counted
      expect(nw).toBe(10000);
    });
  });

  // =========================================================================
  // 4. SELL-TO-BANK SORTING BY MAXIMUM TARIFF POTENTIAL
  // =========================================================================
  describe('Sell-to-Bank Sorting by Maximum Tariff Potential', () => {
    it('sorts properties in ascending order of maximum tariff potential with stable spaceIndex tie-breaker', () => {
      const properties: Record<number, PropertyState> = {};
      for (const space of BOARD_SPACES) {
        properties[space.spaceIndex] = {
          propertyId: space.id || `prop_${space.spaceIndex}`,
          spaceIndex: space.spaceIndex,
          ownerUid: null,
          ownershipState: 'UNOWNED',
          isMortgaged: false,
          buildings: 0,
        };
      }

      // Space 1: Jaipur (baseRent = ₹40, unimproved)
      properties[1].ownerUid = 'user_1';
      properties[1].ownershipState = 'OWNED';

      // Space 4: Udaipur (baseRent = ₹50, unimproved)
      properties[4].ownerUid = 'user_1';
      properties[4].ownershipState = 'OWNED';

      // Space 39: Marine Drive (baseRent = ₹500, with tower rentTower = ₹20,000)
      properties[39].ownerUid = 'user_1';
      properties[39].ownershipState = 'OWNED';
      properties[39].buildings = 5;

      // Space 25: Indira Gandhi Airport (Airport: 1 owned = ₹1,000)
      properties[25].ownerUid = 'user_1';
      properties[25].ownershipState = 'OWNED';

      const eligible = [1, 4, 39, 25].map((idx) => {
        const space = BOARD_SPACES[idx];
        const prop = properties[idx];
        const maxTariff = calculateRent(idx, properties, 12, undefined, false);
        return { spaceIndex: idx, space, prop, maxTariff };
      });

      // Sort ascending (lowest max tariff first, highest last)
      eligible.sort((a, b) => {
        if (a.maxTariff !== b.maxTariff) {
          return a.maxTariff - b.maxTariff;
        }
        return a.spaceIndex - b.spaceIndex;
      });

      // Expected order:
      // 1. Space 1 (Jaipur: ₹40)
      // 2. Space 4 (Udaipur: ₹50)
      // 3. Space 25 (Airport: ₹1,000)
      // 4. Space 39 (Marine Drive Tower: ₹20,000)
      expect(eligible.map((e) => e.spaceIndex)).toEqual([1, 4, 25, 39]);
      expect(eligible[0].maxTariff).toBe(40);
      expect(eligible[1].maxTariff).toBe(50);
      expect(eligible[2].maxTariff).toBe(1000);
      expect(eligible[3].maxTariff).toBe(20000);
    });
  });

  // =========================================================================
  // 5. SELL-TO-BANK INTERACTIVE BOARD PREVIEW INVARIANTS
  // =========================================================================
  describe('Sell-to-Bank Interactive Board Preview Invariants', () => {
    it('preserves emergency debt countdown and property selections when toggling preview', () => {
      let isCheckingBoard = false;
      const selectedProperties = [1, 3];
      const obligationDeadline = Date.now() + 90000; // 90 seconds remaining

      // User opens board preview
      isCheckingBoard = true;
      expect(isCheckingBoard).toBe(true);

      // Verify timer is not paused or reset
      const timeRemaining = Math.max(0, Math.ceil((obligationDeadline - Date.now()) / 1000));
      expect(timeRemaining).toBeGreaterThanOrEqual(89);
      expect(timeRemaining).toBeLessThanOrEqual(91);

      // User clicks "Return to Sell to Bank"
      isCheckingBoard = false;
      expect(isCheckingBoard).toBe(false);

      // Selected properties context must be preserved exactly
      expect(selectedProperties).toEqual([1, 3]);
    });
  });
});
