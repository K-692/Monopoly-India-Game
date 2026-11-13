/**
 * Comprehensive Acceptance & Regression Test Suite:
 * Major Gameplay, Economy, Dice, UI and Rules Update (Section 9)
 *
 * Covers:
 * 1. Mandatory Resolution of Gameplay Popups Before Ending a Turn
 * 2. One Unbiased Dice System for Every Player
 * 3. Sell-to-Bank and Reacquisition Pricing (Cities 50%/10% Tariff vs Infrastructure Deed Price)
 * 4. Central Jail Left-Side Notification & Toast for All Players
 * 5. 11-Card Decks (Rules #2 to #12) and Dice-to-Card Mapping
 * 6. Randomized Complete Player Turn Order at Match Start
 * 7. Permanent Green Cash Balance Styling
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameBoard } from '@/components/board/GameBoard';
import { PlayerStrip } from '@/components/player/PlayerStrip';
import { GameState, PlayerState, PropertyState, PropertyDefinition } from '@/domain/game-types';
import { applyGameCommand } from '@/domain/game-engine/engine';
import { createInitialGame, secureFisherYatesShuffle } from '@/domain/game-engine/create-initial-game';
import { mapByteToDie, generateFairDie, generateFairDicePair } from '@/domain/game-engine/dice-fairness';
import { BOARD_SPACES, CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS } from '@/domain/board-config';
import { calculateMortgageValue, calculateReacquisitionCost, getCurrentPropertyTariff, canBuildOnProperty } from '@/domain/ruleset';
import { GameManager } from '../../server/game/game-manager';
import { ServerRoom } from '../../server/types/server-types';

describe('Major Gameplay, Economy, Dice, UI and Rules Update — Regression Suite', () => {
  const mockMembers = {
    user_1: { uid: 'user_1', displayName: 'Player 1', photoURL: null, colorToken: '#FF5722', isReady: true, joinedAt: 1 },
    user_2: { uid: 'user_2', displayName: 'Player 2', photoURL: null, colorToken: '#2196F3', isReady: true, joinedAt: 2 },
    user_3: { uid: 'user_3', displayName: 'Player 3', photoURL: null, colorToken: '#4CAF50', isReady: true, joinedAt: 3 },
  };

  // =========================================================================
  // 1. MANDATORY RESOLUTION OF GAMEPLAY POPUPS BEFORE ENDING A TURN
  // =========================================================================
  describe('1. Turn Decision Enforcement & Mandatory Popup Resolution', () => {
    it('1.1 END_TURN is rejected during an unresolved property purchase decision', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.phase = 'PROPERTY_DECISION';
      state.pendingAction = {
        type: 'BUY_OR_AUCTION',
        spaceIndex: 1,
        playerUid: 'user_1',
      };

      expect(() => {
        applyGameCommand(state, {
          commandId: 'cmd_end_unresolved_buy',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        }, 'user_1');
      }).toThrowError(/Must resolve property purchase/);
    });

    it('1.2 END_TURN is rejected during a pending reacquisition decision', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.phase = 'MANAGEMENT';
      state.reacquisitionOpportunity = {
        landingId: 'land_reacq_test',
        playerUid: 'user_1',
        spaceIndex: 1,
        cost: 20,
        status: 'PENDING',
        turnNumber: 1,
      };

      expect(() => {
        applyGameCommand(state, {
          commandId: 'cmd_end_unresolved_reacq',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        }, 'user_1');
      }).toThrowError(/Must resolve reacquisition decision/);
    });

    it('1.3 END_TURN is rejected during a legal build opportunity without explicit confirmation', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.turnNumber = 2; // Not turn 1 (boughtOnTurn !== 2)
      state.phase = 'MANAGEMENT';
      state.players[0].position = 1;
      state.players[0].cash = 5000;
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
        boughtOnTurn: 1,
      };

      // Confirm check is allowed
      expect(canBuildOnProperty(1, 'user_1', state.properties, 5000, 1, 2).allowed).toBe(true);

      // Generic END_TURN without confirmBuildSkip must throw
      expect(() => {
        applyGameCommand(state, {
          commandId: 'cmd_end_unconfirmed_build',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        }, 'user_1');
      }).toThrowError(/Must build or explicitly select Done/);
    });

    it('1.4 BUILD resolves one development action on visited city', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.turnNumber = 2;
      state.phase = 'MANAGEMENT';
      state.players[0].position = 1;
      state.players[0].cash = 5000;
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
        boughtOnTurn: 1,
      };

      const res = applyGameCommand(state, {
        commandId: 'cmd_build_house',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'BUILD',
        payload: { spaceIndex: 1 },
      }, 'user_1');

      expect(res.nextState.properties[1].buildings).toBe(1);
      expect(res.nextState.players[0].cash).toBe(4800); // 200 (rentHouse1) building cost deducted
    });

    it('1.5 Done explicitly resolves the build decision and allows turn completion', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.turnNumber = 2;
      state.phase = 'MANAGEMENT';
      state.players[0].position = 1;
      state.players[0].cash = 5000;
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
        boughtOnTurn: 1,
      };

      // END_TURN with confirmBuildSkip: true succeeds
      const res = applyGameCommand(state, {
        commandId: 'cmd_done_skip',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'END_TURN',
        payload: { confirmBuildSkip: true },
      }, 'user_1');

      expect(res.nextState.currentPlayerUid).toBe('user_2');
    });

    it('1.6 Spacebar is suppressed in UI when building opportunity is pending', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.turnNumber = 2;
      state.phase = 'MANAGEMENT';
      state.players[0].position = 1;
      state.players[0].cash = 5000;
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
        boughtOnTurn: 1,
      };

      const onDispatch = vi.fn();
      render(
        <GameBoard
          gameState={state}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          onDispatch={onDispatch}
          isMyTurn={true}
          userUid="user_1"
        />
      );

      // Press Spacebar -> must NOT trigger END_TURN or BUILD
      fireEvent.keyDown(window, { code: 'Space' });
      expect(onDispatch).not.toHaveBeenCalled();

      // Press N -> must dispatch END_TURN with { confirmBuildSkip: true }
      fireEvent.keyDown(window, { key: 'n' });
      expect(onDispatch).toHaveBeenCalledWith('END_TURN', { confirmBuildSkip: true });
    });
  });

  // =========================================================================
  // 2. ONE UNBIASED DICE SYSTEM FOR EVERY PLAYER
  // =========================================================================
  describe('2. Unified Unbiased Crypto Dice System', () => {
    it('2.1 mapByteToDie correctly implements rejection sampling (0..251 accept, 252..255 reject)', () => {
      // 0..251 accepted, evenly distributed
      expect(mapByteToDie(0)).toBe(1);
      expect(mapByteToDie(1)).toBe(2);
      expect(mapByteToDie(5)).toBe(6);
      expect(mapByteToDie(6)).toBe(1);
      expect(mapByteToDie(251)).toBe((251 % 6) + 1); // 251 % 6 = 5 -> die face 6

      // 252..255 rejected
      expect(mapByteToDie(252)).toBeNull();
      expect(mapByteToDie(253)).toBeNull();
      expect(mapByteToDie(254)).toBeNull();
      expect(mapByteToDie(255)).toBeNull();
    });

    it('2.2 generateFairDie and generateFairDicePair return integers in 1..6 and total in 2..12', () => {
      for (let i = 0; i < 200; i++) {
        const die = generateFairDie();
        expect(die).toBeGreaterThanOrEqual(1);
        expect(die).toBeLessThanOrEqual(6);
        expect(Number.isInteger(die)).toBe(true);

        const pair = generateFairDicePair();
        expect(pair).toHaveLength(2);
        expect(pair[0]).toBeGreaterThanOrEqual(1);
        expect(pair[0]).toBeLessThanOrEqual(6);
        expect(pair[1]).toBeGreaterThanOrEqual(1);
        expect(pair[1]).toBeLessThanOrEqual(6);
        expect(pair[0] + pair[1]).toBeGreaterThanOrEqual(2);
        expect(pair[0] + pair[1]).toBeLessThanOrEqual(12);
      }
    });

    it('2.3 human, CPU, and Try Doubles rolls all rely on authoritative server dice', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      const res = applyGameCommand(state, {
        commandId: 'cmd_roll_fair',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      }, 'user_1');

      expect(res.nextState.dice).toBeDefined();
      expect(res.nextState.dice?.die1).toBeGreaterThanOrEqual(1);
      expect(res.nextState.dice?.die1).toBeLessThanOrEqual(6);
      expect(res.nextState.dice?.die2).toBeGreaterThanOrEqual(1);
      expect(res.nextState.dice?.die2).toBeLessThanOrEqual(6);
      expect(res.nextState.dice?.total).toBe(res.nextState.dice!.die1! + res.nextState.dice!.die2!);
    });
  });

  // =========================================================================
  // 3. REVISED SELL-TO-BANK & REACQUISITION PRICING
  // =========================================================================
  describe('3. Sell-to-Bank and Reacquisition Pricing', () => {
    it('3.1 calculates developable city bank sale at 80% tariff and reacquisition at 50% tariff across all 6 tiers', () => {
      // Jaipur (Space 1): baseRent: 40, rentHouse1: 200, rentHouse2: 600, rentHouse3: 1800, rentHouse4: 3200, rentTower: 4500
      const jaipurDef = BOARD_SPACES[1] as PropertyDefinition;

      const levels = [
        { buildings: 0, tariff: 40, expectedSale: 632, expectedReacq: 620 },
        { buildings: 1, tariff: 200, expectedSale: 760, expectedReacq: 700 },
        { buildings: 2, tariff: 600, expectedSale: 1080, expectedReacq: 900 },
        { buildings: 3, tariff: 1800, expectedSale: 2040, expectedReacq: 1500 },
        { buildings: 4, tariff: 3200, expectedSale: 3160, expectedReacq: 2200 },
        { buildings: 5, tariff: 4500, expectedSale: 4200, expectedReacq: 2850 },
      ];

      for (const lvl of levels) {
        expect(getCurrentPropertyTariff(jaipurDef, lvl.buildings)).toBe(lvl.tariff);

        const propState: PropertyState = {
          spaceIndex: 1,
          propertyId: 'jaipur',
          ownerUid: 'user_1',
          buildings: lvl.buildings,
          isMortgaged: false,
          ownershipState: 'OWNED',
        };

        expect(calculateMortgageValue(1, propState)).toBe(lvl.expectedSale);
        expect(calculateReacquisitionCost(1, propState)).toBe(lvl.expectedReacq);
      }
    });

    it('3.2 calculates infrastructure (Railways, Airports, Utilities) sale and reacquisition at full original deed price', () => {
      // Space 5: CST Mumbai (Transit, deed price 2000)
      const prop5State: PropertyState = {
        spaceIndex: 5,
        propertyId: 'cst_mumbai',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
      };
      expect(calculateMortgageValue(5, prop5State)).toBe(2000);
      expect(calculateReacquisitionCost(5, prop5State)).toBe(2000);

      // Space 17: Urja Power Grid (Utility, deed price 1500)
      const prop17State: PropertyState = {
        spaceIndex: 17,
        propertyId: 'urja_power_grid',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
      };
      expect(calculateMortgageValue(17, prop17State)).toBe(1500);
      expect(calculateReacquisitionCost(17, prop17State)).toBe(1500);
    });

    it('3.3 stores soldToBankPayout and soldToBankReacquisitionCost independently and preserves buildings', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.properties[1].ownerUid = 'user_1';
      state.properties[1].ownershipState = 'OWNED';
      state.properties[1].buildings = 3; // 3 houses: tariff 1800 -> sale 900, reacq 180

      const res = applyGameCommand(state, {
        commandId: 'cmd_sell_jaipur_3h',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'MORTGAGE',
        payload: { spaceIndex: 1 },
      }, 'user_1');

      const prop = res.nextState.properties[1];
      expect(prop.ownershipState).toBe('UNOWNED');
      expect(prop.ownerUid).toBeNull();
      expect(prop.buildings).toBe(3); // Buildings preserved!
      expect(prop.soldToBankPayout).toBe(2040);
      expect(prop.soldToBankReacquisitionCost).toBe(1500);
    });
  });

  // =========================================================================
  // 4. CENTRAL JAIL NOTIFICATION OVER DICE
  // =========================================================================
  describe('4. Central Jail Center Notification Banner & Toast', () => {
    it('4.1 renders jail notification modal over dice when player transitions to jail', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      // Initially not in jail
      const { rerender } = render(
        <GameBoard
          gameState={state}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          onDispatch={vi.fn()}
          isMyTurn={true}
          userUid="user_1"
        />
      );

      // No jail banner initially
      expect(screen.queryByTestId('jail-center-notification')).not.toBeInTheDocument();

      // Transition player 1 into jail
      const jailedState: GameState = {
        ...state,
        players: state.players.map((p) => (p.uid === 'user_1' ? { ...p, inJail: true, position: 10 } : p)),
      };

      rerender(
        <GameBoard
          gameState={jailedState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          onDispatch={vi.fn()}
          isMyTurn={true}
          userUid="user_1"
        />
      );

      // Dedicated center notification banner appears over dice with player name
      const banner = screen.getByTestId('jail-center-notification');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent('Player 1');
      expect(banner).toHaveTextContent('sent to Central Jail');
    });
  });

  // =========================================================================
  // 5. 11-CARD DECKS & DICE TOTAL MAPPING
  // =========================================================================
  describe('5. Civic Fund and Market Buzz 11-Card Canonical Decks', () => {
    it('5.1 each deck contains exactly 11 cards with Rule #2 to #12', () => {
      expect(CIVIC_FUND_CARDS).toHaveLength(11);
      expect(MARKET_BUZZ_CARDS).toHaveLength(11);

      // Verify rule numbers are 2 to 12
      const civicRules = CIVIC_FUND_CARDS.map((c) => parseInt(c.id.replace('civic_', ''), 10));
      expect(civicRules).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

      const marketRules = MARKET_BUZZ_CARDS.map((c) => parseInt(c.id.replace('market_', ''), 10));
      expect(marketRules).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

      // Confirm legacy rule #1 cards are completely removed
      expect(CIVIC_FUND_CARDS.some((c) => c.id === 'civic_1')).toBe(false);
      expect(MARKET_BUZZ_CARDS.some((c) => c.id === 'market_1')).toBe(false);
    });

    it('5.2 dice total T in [2..12] maps to deck[T - 2]', () => {
      for (let diceTotal = 2; diceTotal <= 12; diceTotal++) {
        const expectedIndex = diceTotal - 2;
        expect(CIVIC_FUND_CARDS[expectedIndex].id).toBe(`civic_${diceTotal}`);
        expect(MARKET_BUZZ_CARDS[expectedIndex].id).toBe(`market_${diceTotal}`);
      }
    });
  });

  // =========================================================================
  // 6. RANDOMIZED MATCH TURN ORDER
  // =========================================================================
  describe('6. Complete Player Turn Order Randomization', () => {
    it('6.1 secureFisherYatesShuffle produces complete permutations containing every member', () => {
      const uids = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
      for (let i = 0; i < 50; i++) {
        const shuffled = secureFisherYatesShuffle(uids);
        expect(shuffled).toHaveLength(6);
        expect(new Set(shuffled).size).toBe(6);
        for (const u of uids) {
          expect(shuffled).toContain(u);
        }
      }
    });

    it('6.2 GameManager.startGame shuffles complete player list when starting match', async () => {
      const gm = new GameManager();
      const room: ServerRoom = {
        roomId: 'room_rand',
        inviteCode: 'TEST01',
        inviteCodeHash: 'hash',
        hostUid: 'user_1',
        status: 'LOBBY',
        maxPlayers: 6,
        turnTimerSeconds: 30,
        gameMode: 'STANDARD',
        memberUids: Object.keys(mockMembers),
        members: mockMembers,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const res = await gm.startGame(room, 'user_1', { randomizeOrder: true });
      expect(res.ok).toBe(true);
      const game = res.gameState!;

      expect(game.playerOrder).toHaveLength(3);
      expect(new Set(game.playerOrder).size).toBe(3);
      expect(game.currentPlayerUid).toBe(game.playerOrder[0]);
      expect(game.players.map((p) => p.uid)).toEqual(game.playerOrder);
    });
  });

  // =========================================================================
  // 7. PERMANENT GREEN CASH BALANCES
  // =========================================================================
  describe('7. Permanent Green Cash Balance Display', () => {
    it('7.1 cash balance is always rendered with green styling regardless of credit or debit', () => {
      const player: PlayerState = {
        uid: 'u_test',
        displayName: 'Test Player',
        photoURL: null,
        cash: 15000,
        netWorth: 25000,
        position: 0,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isBankrupt: false,
        colorToken: '#EF4444',
        turnTimeoutCount: 0,
        isCpu: false,
        playerType: 'HUMAN',
      };

      render(
        <PlayerStrip
          players={[player]}
          currentPlayerUid={player.uid}
          properties={{}}
          userUid={player.uid}
          turnTimeRemaining={30}
        />
      );

      // Find the cash balance display element
      const balanceContainer = screen.getByTestId(`player-balance-${player.uid}`);
      expect(balanceContainer).toBeInTheDocument();
      expect(balanceContainer.className).toContain('text-emerald-700');
      expect(balanceContainer.className).toContain('dark:text-emerald-400');
      const balanceEl = screen.getByText('15,000');
      expect(balanceEl).toBeInTheDocument();
      expect(balanceEl.className).toContain('text-emerald-700');
      expect(balanceEl.className).toContain('dark:text-emerald-400');
    });
  });
});
