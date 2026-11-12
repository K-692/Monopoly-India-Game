import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BOARD_SPACES } from '../domain/board-config';
import { PropertyState, GameState, RoomMember, PropertyDefinition } from '../domain/game-types';
import {
  calculateMortgageValue,
  calculateReacquisitionCost,
  calculateBuildingCost,
  canBuildOnProperty,
  calculateNetWorth,
  getCurrentPropertyTariff,
} from '../domain/ruleset';
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import { applyGameCommand } from '../domain/game-engine/engine';
import { GameManager } from '../../server/game/game-manager';
import { ServerRoom } from '../../server/types/server-types';
import { GameBoard } from '../components/board/GameBoard';
import { CityDeedModal } from '../components/board/CityDeedModal';
import { PlayerStrip } from '../components/player/PlayerStrip';
import { useToastStore } from '../components/feedback/toast-store';
import { GAME_RULES_SECTIONS, BUILDINGS_RULE_SECTION } from '../domain/game-rules-guide';

const mockMembers: Record<string, RoomMember> = {
  user_1: { uid: 'user_1', displayName: 'Player 1', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
  user_2: { uid: 'user_2', displayName: 'Player 2', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
};

describe('Feature Update: Revised Property Economy, Central Jail Notification, and Sell-to-Bank Restrictions', () => {
  describe('1. Revised Sell-to-Bank & Reacquisition Pricing', () => {
    it('calculates developable city bank sale at P + floor(T * 0.80) and reacquisition at P + floor(T * 0.50) for all tiers', () => {
      // Jaipur (Space 1): deed price P = 600
      // Tariffs: 0 houses: 40, 1 house: 200, 2 houses: 600, 3 houses: 1800, 4 houses: 3200, Tower: 4500
      const jaipurDef = BOARD_SPACES[1] as PropertyDefinition;
      expect(jaipurDef.price).toBe(600);

      const expectedTiers = [
        { buildings: 0, tariff: 40, sale: 600 + Math.floor(40 * 0.8), reacq: 600 + Math.floor(40 * 0.5) }, // 632, 620
        { buildings: 1, tariff: 200, sale: 600 + Math.floor(200 * 0.8), reacq: 600 + Math.floor(200 * 0.5) }, // 760, 700
        { buildings: 2, tariff: 600, sale: 600 + Math.floor(600 * 0.8), reacq: 600 + Math.floor(600 * 0.5) }, // 1080, 900
        { buildings: 3, tariff: 1800, sale: 600 + Math.floor(1800 * 0.8), reacq: 600 + Math.floor(1800 * 0.5) }, // 2040, 1500
        { buildings: 4, tariff: 3200, sale: 600 + Math.floor(3200 * 0.8), reacq: 600 + Math.floor(3200 * 0.5) }, // 3160, 2200
        { buildings: 5, tariff: 4500, sale: 600 + Math.floor(4500 * 0.8), reacq: 600 + Math.floor(4500 * 0.5) }, // 4200, 2850
      ];

      for (const tier of expectedTiers) {
        expect(getCurrentPropertyTariff(jaipurDef, tier.buildings)).toBe(tier.tariff);

        const propState: PropertyState = {
          spaceIndex: 1,
          propertyId: 'jaipur',
          ownerUid: 'user_1',
          buildings: tier.buildings,
          isMortgaged: false,
          ownershipState: 'OWNED',
        };

        expect(calculateMortgageValue(1, propState)).toBe(tier.sale);
        expect(calculateReacquisitionCost(1, propState)).toBe(tier.reacq);
      }
    });

    it('calculates infrastructure (Railways, Airports, Utilities) sale and reacquisition at 100% of deed price', () => {
      // Space 5: CST Mumbai (Transit, price 2000)
      const prop5: PropertyState = {
        spaceIndex: 5,
        propertyId: 'cst_mumbai',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
      };
      expect(calculateMortgageValue(5, prop5)).toBe(2000);
      expect(calculateReacquisitionCost(5, prop5)).toBe(2000);

      // Space 15: Howrah Railway (Transit, price 2000)
      const prop15: PropertyState = {
        spaceIndex: 15,
        propertyId: 'howrah_railway',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
      };
      expect(calculateMortgageValue(15, prop15)).toBe(2000);
      expect(calculateReacquisitionCost(15, prop15)).toBe(2000);

      // Space 17: Urja Power Grid (Utility, price 1500)
      const prop17: PropertyState = {
        spaceIndex: 17,
        propertyId: 'urja_power_grid',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
      };
      expect(calculateMortgageValue(17, prop17)).toBe(1500);
      expect(calculateReacquisitionCost(17, prop17)).toBe(1500);

      // Space 25: Chennai Airport (Airport, price 2000)
      const prop25: PropertyState = {
        spaceIndex: 25,
        propertyId: 'chennai_airport',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
      };
      expect(calculateMortgageValue(25, prop25)).toBe(2000);
      expect(calculateReacquisitionCost(25, prop25)).toBe(2000);
    });
  });

  describe('2. Dynamic Construction Cost Equal to Resulting Tariff', () => {
    it('returns exact resulting tariff for each construction level', () => {
      // Jaipur (Space 1): rentHouse1: 200, rentHouse2: 600, rentHouse3: 1800, rentHouse4: 3200, rentTower: 4500
      expect(calculateBuildingCost(1, 0)).toBe(200); // Level 0 -> 1: House 1 tariff
      expect(calculateBuildingCost(1, 1)).toBe(600); // Level 1 -> 2: House 2 tariff
      expect(calculateBuildingCost(1, 2)).toBe(1800); // Level 2 -> 3: House 3 tariff
      expect(calculateBuildingCost(1, 3)).toBe(3200); // Level 3 -> 4: House 4 tariff
      expect(calculateBuildingCost(1, 4)).toBe(4500); // Level 4 -> 5: Tower tariff
      expect(calculateBuildingCost(1, 5)).toBe(0); // Max level reached
    });

    it('enforces dynamic building cost in canBuildOnProperty and engine BUILD command', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.turnNumber = 2;
      state.phase = 'MANAGEMENT';
      state.players[0].position = 1;
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
        boughtOnTurn: 1,
      };

      // Player has 150 cash, needs 200
      state.players[0].cash = 150;
      expect(canBuildOnProperty(1, 'user_1', state.properties, 150, 1, 2).allowed).toBe(false);
      expect(canBuildOnProperty(1, 'user_1', state.properties, 150, 1, 2).reason).toMatch(/Insufficient cash/);

      // Player has 200 cash, exactly enough
      state.players[0].cash = 200;
      expect(canBuildOnProperty(1, 'user_1', state.properties, 200, 1, 2).allowed).toBe(true);

      const res = applyGameCommand(state, {
        commandId: 'cmd_build_1',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'BUILD',
        payload: { spaceIndex: 1 },
      }, 'user_1');

      expect(res.nextState.properties[1].buildings).toBe(1);
      expect(res.nextState.players[0].cash).toBe(0); // 200 - 200 = 0
    });

    it('calculates net worth using cumulative tariff investments for built levels', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.players[0].cash = 1000;
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 2, // 2 houses built: Level 1 tariff (200) + Level 2 tariff (600) = 800
        ownershipState: 'OWNED',
      };

      // Base price = 600, buildings = 200 + 600 = 800. Cash = 1000. Total = 600 + 800 + 1000 = 2400.
      const nw = calculateNetWorth('user_1', state.players[0].cash, state.properties);
      expect(nw).toBe(2400);
    });
  });

  describe('3. Central Jail Notification Over Dice', () => {
    it('renders jail notification inside dice center anchor completely covering dice area', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
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

      expect(screen.queryByTestId('jail-center-notification')).not.toBeInTheDocument();

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

      const modal = screen.getByTestId('jail-center-notification');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveTextContent('CENTRAL JAIL');
      expect(modal).toHaveTextContent('Player 1 sent to Central Jail');

      // Verify it is placed inside dice anchor container at the middle of the game board
      const diceAnchor = modal.closest('#board-inspection-dice-anchor');
      expect(diceAnchor).not.toBeNull();

      // Verify no toast notification was generated at the bottom-left of the screen
      const jailToasts = useToastStore.getState().toasts.filter((t) => t.title === 'Central Jail');
      expect(jailToasts).toHaveLength(0);
    });

    it('auto-dismisses central jail notification after exactly 2000ms', () => {
      vi.useFakeTimers();
      try {
        const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
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

        expect(screen.getByTestId('jail-center-notification')).toBeInTheDocument();

        // At 1900ms, it is still visible
        act(() => {
          vi.advanceTimersByTime(1900);
        });
        expect(screen.getByTestId('jail-center-notification')).toBeInTheDocument();

        // At 2000ms (+150ms), it auto-dismisses
        act(() => {
          vi.advanceTimersByTime(150);
        });
        expect(screen.queryByTestId('jail-center-notification')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('4. Sell-to-Bank Restrictions & Grid Tile Decoupling', () => {
    it('CityDeedModal does NOT contain any Sell-to-Bank button when clicked on board grid tile', () => {
      const propState: PropertyState = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: 'user_1',
        isMortgaged: false,
        buildings: 1,
        ownershipState: 'OWNED',
      };

      render(
        <CityDeedModal
          space={BOARD_SPACES[1]}
          propertyState={propState}
          players={[]}
          onClose={vi.fn()}
          isMyTurn={true}
          currentUserUid="user_1"
        />
      );

      // Verify Sell to Bank button is completely absent
      expect(screen.queryByRole('button', { name: /sell to bank/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/sell to bank/i)).not.toBeInTheDocument();
    });

    it('rejects voluntary MORTGAGE when actor is not current turn player in engine', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.currentPlayerUid = 'user_1';
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: 'user_2',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
      };

      // user_2 tries to voluntarily mortgage during user_1's turn
      expect(() => {
        applyGameCommand(state, {
          commandId: 'cmd_voluntary_out_of_turn',
          roomId: 'room_1',
          gameId: 'game_1',
          expectedVersion: state.version,
          type: 'MORTGAGE',
          payload: { spaceIndex: 1 },
        }, 'user_2');
      }).toThrowError(/You can only mortgage properties during your turn/);
    });

    it('allows debtor to sell properties to bank out of turn during debt obligation resolution', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.currentPlayerUid = 'user_1';
      state.phase = 'ACTION_REQUIRED';
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: 'user_2',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
      };
      state.pendingFinancialObligation = {
        obligationId: 'ob_debt',
        debtorUid: 'user_2',
        creditorUid: 'user_1',
        amountDue: 1000,
        remainingAmountDue: 1000,
        paymentType: 'RENT',
        expiresAt: Date.now() + 60000,
        status: 'PENDING',
        createdAt: Date.now(),
        idempotencyKey: 'idemp_debt',
      };

      // user_2 is resolving an active debt obligation, so MORTGAGE is permitted even if not normal turn
      const res = applyGameCommand(state, {
        commandId: 'cmd_debt_mortgage',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'MORTGAGE',
        payload: { spaceIndex: 1 },
      }, 'user_2');

      expect(res.nextState.properties[1].ownershipState).toBe('UNOWNED');
      expect(res.nextState.properties[1].soldToBankPayout).toBe(632);
    });

    it('server GameManager rejects voluntary MORTGAGE when actor is not current turn player', async () => {
      const gm = new GameManager();
      const room: ServerRoom = {
        roomId: 'room_svr_test',
        inviteCode: 'SVR01',
        inviteCodeHash: 'hash_svr',
        hostUid: 'user_1',
        status: 'LOBBY',
        maxPlayers: 2,
        turnTimerSeconds: 30,
        gameMode: 'STANDARD',
        memberUids: ['user_1', 'user_2'],
        members: mockMembers,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const startRes = gm.startGame(room, 'user_1', { forcedPlayerOrder: ['user_1', 'user_2'] });
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      state.currentPlayerUid = 'user_1';
      state.properties[3].ownerUid = 'user_2';
      state.properties[3].ownershipState = 'OWNED';

      await expect(gm.processCommand(gameId, {
        commandId: 'cmd_svr_out_of_turn',
        roomId: 'room_svr_test',
        gameId,
        expectedVersion: state.version,
        type: 'MORTGAGE',
        payload: { spaceIndex: 3 },
      }, 'user_2')).rejects.toThrow(/Selling properties to the bank voluntarily is only permitted during your active turn/);
    });
  });

  describe('5. Game Rules Guide Documentation Verification', () => {
    it('documents P + 80% tariff bank sale and P + 50% tariff reacquisition', () => {
      const sec8 = GAME_RULES_SECTIONS.find((s) => s.id === 'sell-to-bank');
      expect(sec8).toBeDefined();
      const text = sec8!.items.flatMap((i) => i.points).join(' ');
      expect(text).toContain('80% of Current Tariff');
      expect(text).toContain('50% of Current Tariff');
      expect(text).toContain('100% of the original deed purchase price');
      expect(text).toContain('ONLY during the active owner\'s turn');
    });

    it('documents dynamic construction cost equal to resulting tariff', () => {
      const points = BUILDINGS_RULE_SECTION.items.flatMap((i) => i.points).join(' ');
      expect(points).toContain('Dynamic Construction Cost Equals Resulting Tariff');
      expect(points).toContain('1st house = one-house tariff');
      expect(points).toContain('Commercial Tower = tower tariff');
    });

    it('documents central jail notification centered over dice', () => {
      const sec7 = GAME_RULES_SECTIONS.find((s) => s.id === 'taxes-special-tiles');
      expect(sec7).toBeDefined();
      const text = sec7!.items.flatMap((i) => i.points).join(' ');
      expect(text).toContain('geometric center of the game board, directly covering both dice');
    });
  });

  describe('6. Give Up Authorization & Active Turn Restrictions', () => {
    it('allows active player to give up during their own turn', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.currentPlayerUid = 'user_1';
      const res = applyGameCommand(state, {
        commandId: 'cmd_giveup_valid',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'GIVE_UP',
        payload: {},
      }, 'user_1');

      expect(res.nextState.players[0].isBankrupt).toBe(true);
      expect(res.nextState.players[0].isDisqualified).toBe(true);
    });

    it('rejects GIVE_UP command with NOT_YOUR_TURN when actor is not current turn player in engine', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.currentPlayerUid = 'user_1';
      expect(() => applyGameCommand(state, {
        commandId: 'cmd_giveup_invalid',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: state.version,
        type: 'GIVE_UP',
        payload: {},
      }, 'user_2')).toThrow(/You can only give up during your own turn/);
    });

    it('server GameManager rejects GIVE_UP when actor is not current turn player', async () => {
      const gm = new GameManager();
      const room: ServerRoom = {
        roomId: 'room_svr_giveup',
        inviteCode: 'GIV01',
        inviteCodeHash: 'hash_giveup',
        hostUid: 'user_1',
        status: 'LOBBY',
        maxPlayers: 2,
        turnTimerSeconds: 30,
        gameMode: 'STANDARD',
        memberUids: ['user_1', 'user_2'],
        members: mockMembers,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      const startRes = gm.startGame(room, 'user_1', { forcedPlayerOrder: ['user_1', 'user_2'] });
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;
      state.currentPlayerUid = 'user_1';

      await expect(gm.processCommand(gameId, {
        commandId: 'cmd_svr_giveup_out_of_turn',
        roomId: 'room_svr_giveup',
        gameId,
        expectedVersion: state.version,
        type: 'GIVE_UP',
        payload: {},
      }, 'user_2')).rejects.toThrow(/You can only give up during your active turn/);
    });

    it('PlayerStrip only displays Give Up button when viewer is the active human player', () => {
      const state = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_1');
      state.currentPlayerUid = 'user_1';

      // Viewer is user_1 (active player) -> button rendered
      const { rerender } = render(
        <PlayerStrip
          players={state.players}
          currentPlayerUid="user_1"
          properties={state.properties}
          userUid="user_1"
          onGiveUp={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /give up/i })).toBeInTheDocument();

      // Viewer is user_2 (inactive player) -> button hidden
      rerender(
        <PlayerStrip
          players={state.players}
          currentPlayerUid="user_1"
          properties={state.properties}
          userUid="user_2"
          onGiveUp={vi.fn()}
        />
      );
      expect(screen.queryByRole('button', { name: /give up/i })).not.toBeInTheDocument();

      // Active player is CPU -> button hidden for all human viewers
      const cpuPlayers = state.players.map((p) => (p.uid === 'user_1' ? { ...p, isCpu: true, playerType: 'COMPUTER' as const } : p));
      rerender(
        <PlayerStrip
          players={cpuPlayers}
          currentPlayerUid="user_1"
          properties={state.properties}
          userUid="user_2"
          onGiveUp={vi.fn()}
        />
      );
      expect(screen.queryByRole('button', { name: /give up/i })).not.toBeInTheDocument();
    });
  });
});
