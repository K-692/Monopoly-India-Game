import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameManager } from '../../server/game/game-manager';
import { ServerRoom } from '../../server/types/server-types';
import { GameBoard } from '../components/board/GameBoard';
import { PlayerStrip } from '../components/player/PlayerStrip';
import { RulesModal } from '../components/rules/RulesModal';
import { GAME_RULES_SECTIONS, BUILDINGS_RULE_SECTION } from '../domain/game-rules-guide';
import { getSortedEligibleSellToBankProperties } from '../domain/ruleset';
import { applyGameCommand, GameEngineError } from '../domain/game-engine/engine';
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import { GameState, PlayerState, PropertyState, RoomMember } from '../domain/game-types';

describe('Feature: Human Timeout Auto-Resolution & Build Shortcut Refinement', () => {
  const createTestRoom = (
    roomId: string,
    hostUid: string,
    members: Record<string, RoomMember>
  ): ServerRoom => ({
    roomId,
    inviteCode: 'TEST01',
    inviteCodeHash: 'hash_test',
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

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. AUTOMATIC RESOLUTION OF HUMAN PROPERTY / CITY DECISIONS ON TIMEOUT
  // =========================================================================
  describe('1. Human Property Decision Timeout Auto-Resolution', () => {
    it('automatically purchases unowned property when human has sufficient cash and advances turn', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        h1: { uid: 'h1', displayName: 'Human 1', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
        h2: { uid: 'h2', displayName: 'Human 2', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
      };
      const room = createTestRoom('room_p1', 'h1', members);
      const startRes = gm.startGame(room, 'h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      // Set human player on unowned property (Space 1: Jaipur, cost ₹1,000)
      state.currentPlayerUid = 'h1';
      state.players[0].position = 1;
      state.players[0].cash = 5000;
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: null,
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'UNOWNED',
      };
      state.phase = 'PROPERTY_DECISION';
      state.turnTimeRemaining = 0;

      await gm.handleTimeout(state);

      const afterState = gm.getGame(gameId)!;
      // Property purchased
      expect(afterState.properties[1].ownerUid).toBe('h1');
      expect(afterState.properties[1].ownershipState).toBe('OWNED');
      expect(afterState.players[0].cash).toBe(4400); // 5000 - 600 (Jaipur authoritative price)
      // Turn automatically advanced to h2 without requiring another human click
      expect(afterState.currentPlayerUid).toBe('h2');
      expect(afterState.phase).toBe('AWAIT_ROLL');
    });

    it('automatically declines unowned property when human has insufficient cash and advances turn', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        h1: { uid: 'h1', displayName: 'Human 1', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
        h2: { uid: 'h2', displayName: 'Human 2', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
      };
      const room = createTestRoom('room_p2', 'h1', members);
      const startRes = gm.startGame(room, 'h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      // Set human player with ₹500 on Space 1 (cost ₹1,000)
      state.currentPlayerUid = 'h1';
      state.players[0].position = 1;
      state.players[0].cash = 500;
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: null,
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'UNOWNED',
      };
      state.phase = 'PROPERTY_DECISION';

      await gm.handleTimeout(state);

      const afterState = gm.getGame(gameId)!;
      // Property remained unowned
      expect(afterState.properties[1].ownerUid).toBeNull();
      expect(afterState.players[0].cash).toBe(500);
      // Turn advanced to next player
      expect(afterState.currentPlayerUid).toBe('h2');
    });

    it('uses soldToBankPayout when property was previously sold to bank', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        h1: { uid: 'h1', displayName: 'Human 1', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
        h2: { uid: 'h2', displayName: 'Human 2', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
      };
      const room = createTestRoom('room_p3', 'h1', members);
      const startRes = gm.startGame(room, 'h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      // Space 1 previously sold to bank for ₹750 payout
      state.currentPlayerUid = 'h1';
      state.players[0].position = 1;
      state.players[0].cash = 800; // Can afford ₹750, but cannot afford normal deed price ₹1,000
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: null,
        isMortgaged: false,
        buildings: 1,
        ownershipState: 'UNOWNED',
        soldToBankPayout: 750,
      };
      state.phase = 'PROPERTY_DECISION';

      await gm.handleTimeout(state);

      const afterState = gm.getGame(gameId)!;
      expect(afterState.properties[1].ownerUid).toBe('h1');
      expect(afterState.properties[1].buildings).toBe(1); // Preserves existing building
      expect(afterState.players[0].cash).toBe(50); // 800 - 750
      expect(afterState.currentPlayerUid).toBe('h2');
    });

    it('automatically reacquires pending mortgaged property when human has sufficient cash', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        h1: { uid: 'h1', displayName: 'Human 1', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
        h2: { uid: 'h2', displayName: 'Human 2', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
      };
      const room = createTestRoom('room_p4', 'h1', members);
      const startRes = gm.startGame(room, 'h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      state.currentPlayerUid = 'h1';
      state.players[0].position = 1;
      state.players[0].cash = 3000;
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: 'h1',
        isMortgaged: true,
        mortgagePayout: 500,
        buildings: 0,
        ownershipState: 'MORTGAGED',
      };
      state.reacquisitionOpportunity = {
        landingId: 'land_reacquire_1',
        spaceIndex: 1,
        playerUid: 'h1',
        cost: 500,
        status: 'PENDING',
        turnNumber: 1,
      };
      state.phase = 'PROPERTY_DECISION';

      await gm.handleTimeout(state);

      const afterState = gm.getGame(gameId)!;
      expect(afterState.properties[1].isMortgaged).toBe(false);
      expect(afterState.properties[1].ownershipState).toBe('OWNED');
      expect(afterState.players[0].cash).toBe(2500); // 3000 - 500
      expect(afterState.reacquisitionOpportunity).toBeNull();
      expect(afterState.currentPlayerUid).toBe('h2');
    });

    it('automatically declines reacquisition when human has insufficient cash', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        h1: { uid: 'h1', displayName: 'Human 1', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
        h2: { uid: 'h2', displayName: 'Human 2', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
      };
      const room = createTestRoom('room_p5', 'h1', members);
      const startRes = gm.startGame(room, 'h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      state.currentPlayerUid = 'h1';
      state.players[0].position = 1;
      state.players[0].cash = 200; // Needs ₹500
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: 'h1',
        isMortgaged: true,
        mortgagePayout: 500,
        buildings: 0,
        ownershipState: 'MORTGAGED',
      };
      state.reacquisitionOpportunity = {
        landingId: 'land_reacquire_2',
        spaceIndex: 1,
        playerUid: 'h1',
        cost: 500,
        status: 'PENDING',
        turnNumber: 1,
      };
      state.phase = 'PROPERTY_DECISION';

      await gm.handleTimeout(state);

      const afterState = gm.getGame(gameId)!;
      expect(afterState.properties[1].isMortgaged).toBe(true);
      expect(afterState.properties[1].ownershipState).toBe('MORTGAGED');
      expect(afterState.players[0].cash).toBe(200);
      expect(afterState.currentPlayerUid).toBe('h2');
    });

    it('preserves CPU decision path and does not route computer players through human timeout', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        h1: { uid: 'h1', displayName: 'Human 1', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
        cpu1: { uid: 'cpu1', displayName: 'CPU1', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2, isCpu: true, playerType: 'COMPUTER' },
      };
      const room = createTestRoom('room_cpu', 'h1', members);
      const startRes = gm.startGame(room, 'h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      state.currentPlayerUid = 'cpu1';
      state.players[1].position = 1;
      state.players[1].cash = 10000;
      state.phase = 'PROPERTY_DECISION';

      // Timeout for CPU dispatches standard DECLINE_PROPERTY fallback without auto-purchase
      await gm.handleTimeout(state);

      const afterState = gm.getGame(gameId)!;
      expect(afterState.properties[1]?.ownerUid ?? null).toBeNull();
    });
  });

  // =========================================================================
  // 2. AUTOMATIC SELL-TO-BANK LIQUIDATION ON FINANCIAL TIMEOUT
  // =========================================================================
  describe('2. Human Financial Liquidation Timeout', () => {
    it('directly settles obligation if debtor already has sufficient liquid cash at timeout', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        h1: { uid: 'h1', displayName: 'Debtor', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
        h2: { uid: 'h2', displayName: 'Creditor', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
      };
      const room = createTestRoom('room_fin1', 'h1', members);
      const startRes = gm.startGame(room, 'h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      state.currentPlayerUid = 'h1';
      state.players[0].cash = 2500;
      state.players[1].cash = 5000;
      state.phase = 'ACTION_REQUIRED';
      state.pendingFinancialObligation = {
        obligationId: 'ob_1',
        debtorUid: 'h1',
        creditorUid: 'h2',
        amountDue: 1500,
        paymentType: 'RENT',
        expiresAt: Date.now() - 1000, // Expired
        status: 'PENDING',
        createdAt: Date.now() - 5000,
        idempotencyKey: 'idemp_1',
      };

      await gm.handleTimeout(state);

      const afterState = gm.getGame(gameId)!;
      expect(afterState.pendingFinancialObligation).toBeNull();
      expect(afterState.players[0].cash).toBe(1000); // 2500 - 1500
      expect(afterState.players[1].cash).toBe(6500); // 5000 + 1500
      // Auto advanced turn
      expect(afterState.currentPlayerUid).toBe('h2');
    });

    it('liquidates assets in exact UI sorted order (lowest max-tariff first) and stops as soon as debt is covered', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        h1: { uid: 'h1', displayName: 'Debtor', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
        h2: { uid: 'h2', displayName: 'Creditor', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
      };
      const room = createTestRoom('room_fin2', 'h1', members);
      const startRes = gm.startGame(room, 'h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      // Debtor owes ₹2,000, has ₹500 cash
      // Owns 4 properties:
      // Space 1 (Jaipur): base deed ₹1,000, mortgage payout ₹500, max tariff = 100
      // Space 3 (Delhi South): base deed ₹1,200, mortgage payout ₹600, max tariff = 200
      // Space 15 (Howrah Station): transit ₹2,000, mortgage payout ₹1,000, max tariff = 500
      // Space 39 (Marine Drive): city ₹4,000, mortgage payout ₹2,000, max tariff = 2,000
      state.currentPlayerUid = 'h1';
      state.players[0].cash = 500;
      state.players[1].cash = 10000;

      state.properties[1] = { spaceIndex: 1, propertyId: 'p1', ownerUid: 'h1', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };
      state.properties[3] = { spaceIndex: 3, propertyId: 'p3', ownerUid: 'h1', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };
      state.properties[15] = { spaceIndex: 15, propertyId: 'p15', ownerUid: 'h1', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };
      state.properties[39] = { spaceIndex: 39, propertyId: 'p39', ownerUid: 'h1', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };

      // Verify domain utility ordering
      const sorted = getSortedEligibleSellToBankProperties('h1', state.properties);
      expect(sorted.map((p) => p.spaceIndex)).toEqual([1, 3, 15, 39]);

      state.phase = 'ACTION_REQUIRED';
      state.pendingFinancialObligation = {
        obligationId: 'ob_2',
        debtorUid: 'h1',
        creditorUid: 'h2',
        amountDue: 2000,
        paymentType: 'RENT',
        expiresAt: Date.now() - 1000,
        status: 'PENDING',
        createdAt: Date.now() - 5000,
        idempotencyKey: 'idemp_2',
      };

      await gm.handleTimeout(state);

      const afterState = gm.getGame(gameId)!;
      // Sale 1: Space 1 -> +300 (total cash = 800 < 2000)
      // Sale 2: Space 3 -> +300 (total cash = 1100 < 2000)
      // Sale 3: Space 15 -> +1000 (total cash = 2100 >= 2000)
      // Settled ₹2,000! Remaining cash = 100.
      // Space 39 must NOT be sold!
      expect(afterState.properties[1].ownershipState).toBe('UNOWNED');
      expect(afterState.properties[3].ownershipState).toBe('UNOWNED');
      expect(afterState.properties[15].ownershipState).toBe('UNOWNED');
      expect(afterState.properties[39].ownershipState).toBe('OWNED'); // Untouched!
      expect(afterState.properties[39].ownerUid).toBe('h1');

      expect(afterState.players[0].cash).toBe(100); // 2100 - 2000
      expect(afterState.players[1].cash).toBe(12000);
      expect(afterState.pendingFinancialObligation).toBeNull();
      expect(afterState.players[0].isDisqualified).toBeFalsy();
      expect(afterState.players[0].isBankrupt).toBeFalsy();
      expect(afterState.currentPlayerUid).toBe('h2');
    });

    it('surrenders debtor only after all eligible properties have been exhausted and cash is still insufficient', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        h1: { uid: 'h1', displayName: 'Debtor', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
        h2: { uid: 'h2', displayName: 'Creditor', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
      };
      const room = createTestRoom('room_fin3', 'h1', members);
      const startRes = gm.startGame(room, 'h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      // Debtor owes ₹5,000, has ₹200 cash, only owns 1 property (Space 1 yielding ₹300)
      state.currentPlayerUid = 'h1';
      state.players[0].cash = 200;
      state.players[1].cash = 1000;
      state.properties[1] = { spaceIndex: 1, propertyId: 'p1', ownerUid: 'h1', isMortgaged: false, buildings: 0, ownershipState: 'OWNED' };

      state.phase = 'ACTION_REQUIRED';
      state.pendingFinancialObligation = {
        obligationId: 'ob_3',
        debtorUid: 'h1',
        creditorUid: 'h2',
        amountDue: 5000,
        paymentType: 'RENT',
        expiresAt: Date.now() - 1000,
        status: 'PENDING',
        createdAt: Date.now() - 5000,
        idempotencyKey: 'idemp_3',
      };

      await gm.handleTimeout(state);

      const afterState = gm.getGame(gameId)!;
      // Property 1 was sold (unowned in bank)
      expect(afterState.properties[1].ownershipState).toBe('UNOWNED');
      // All properties exhausted and cash (500) < 5000 -> Surrendered
      expect(afterState.players[0].isBankrupt).toBe(true);
      expect(afterState.players[0].isDisqualified).toBe(true);
      // Creditor received remaining cash (₹500: 200 initial + 300 sale)
      expect(afterState.players[0].cash).toBe(0);
      expect(afterState.players[1].cash).toBe(1500);
      expect(afterState.status).toBe('COMPLETED');
      expect(afterState.winnerUid).toBe('h2');
    });

    it('rejects ordinary manual client MORTGAGE after 120s deadline but server-only timeout executes safely', () => {
      const state = createInitialGame('r1', 'g1', {
        h1: { uid: 'h1', displayName: 'H1', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
        h2: { uid: 'h2', displayName: 'H2', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
      });

      state.phase = 'ACTION_REQUIRED';
      state.properties[1].ownerUid = 'h1';
      state.properties[1].ownershipState = 'OWNED';
      state.pendingFinancialObligation = {
        obligationId: 'ob_exp',
        debtorUid: 'h1',
        creditorUid: 'h2',
        amountDue: 2000,
        paymentType: 'RENT',
        expiresAt: Date.now() - 5000, // Expired 5 seconds ago
        status: 'PENDING',
        createdAt: Date.now() - 10000,
        idempotencyKey: 'idemp_exp',
      };

      // Ordinary client mortgage call throws OBLIGATION_EXPIRED
      expect(() => {
        applyGameCommand(
          state,
          {
            commandId: 'client_mortgage',
            roomId: 'r1',
            gameId: 'g1',
            expectedVersion: state.version,
            type: 'MORTGAGE',
            payload: { spaceIndex: 1 },
          },
          'h1'
        );
      }).toThrowError(GameEngineError);

      // Server timeout path executes safely
      const serverResult = applyGameCommand(
        state,
        {
          commandId: 'server_mortgage',
          roomId: 'r1',
          gameId: 'g1',
          expectedVersion: state.version,
          type: 'MORTGAGE',
          payload: { spaceIndex: 1 },
        },
        'h1',
        undefined,
        { isServerTimeout: true }
      );
      expect(serverResult.nextState.properties[1].ownershipState).toBe('UNOWNED');
    });
  });

  // =========================================================================
  // 3. KEYBOARD SHORTCUT N (BUILD HOUSE/TOWER DONE) & DOCUMENTATION
  // =========================================================================
  describe('3. Keyboard Shortcut N for Done / Building & Documentation', () => {
    const mockHuman: PlayerState = {
      uid: 'user_human',
      displayName: 'Priya',
      colorToken: '#EF4444',
      cash: 25000,
      netWorth: 35000,
      position: 1, // Jaipur (PROPERTY)
      isBankrupt: false,
      isDisqualified: false,
      inJail: false,
      jailTurns: 0,
      jailFreeCards: 0,
      isCpu: false,
      playerType: 'HUMAN',
      photoURL: '',
      turnTimeoutCount: 0,
    };

    const mockCpu: PlayerState = {
      uid: 'user_cpu',
      displayName: 'CPU1',
      colorToken: '#3B82F6',
      cash: 18000,
      netWorth: 22000,
      position: 8,
      isBankrupt: false,
      isDisqualified: false,
      inJail: false,
      jailTurns: 0,
      jailFreeCards: 0,
      isCpu: true,
      playerType: 'COMPUTER',
      photoURL: '',
      turnTimeoutCount: 0,
    };

    const mockProperties: Record<number, PropertyState> = {
      1: {
        spaceIndex: 1,
        propertyId: 'jaipur',
        ownerUid: 'user_human',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
      },
      3: {
        spaceIndex: 3,
        propertyId: 'bhubaneswar',
        ownerUid: 'user_human',
        isMortgaged: false,
        buildings: 0,
        ownershipState: 'OWNED',
      },
    };

    const createGameState = (): GameState => ({
      gameId: 'g1',
      roomId: 'r1',
      rulesetVersion: '1.0.0',
      version: 1,
      status: 'IN_PROGRESS',
      playerOrder: ['user_human', 'user_cpu'],
      players: [mockHuman, mockCpu],
      currentPlayerUid: 'user_human',
      turnNumber: 2,
      phase: 'MANAGEMENT',
      turnTimeRemaining: 30,
      turnTimeLimit: 30,
      properties: mockProperties,
      pendingAction: null,
      dice: null,
      auction: null,
      activeTrade: null,
      winnerUid: null,
      startedAt: 1000,
      updatedAt: 1000,
      completedAt: null,
    });

    it('pressing N dispatches END_TURN when Build House/Tower prompt is active', () => {
      const onDispatch = vi.fn();
      const gameState = createGameState();

      render(
        <GameBoard
          gameState={gameState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          onDispatch={onDispatch}
          isMyTurn={true}
          userUid="user_human"
        />
      );

      // Verify prompt is visible
      expect(screen.getByText('🔨 Build Development?')).toBeInTheDocument();

      // Press N
      fireEvent.keyDown(window, { key: 'n' });

      expect(onDispatch).toHaveBeenCalledTimes(1);
      expect(onDispatch).toHaveBeenCalledWith('END_TURN');
      expect(onDispatch).not.toHaveBeenCalledWith('BUILD', expect.anything());
    });

    it('clicking Done button dispatches the exact same END_TURN action', () => {
      const onDispatch = vi.fn();
      const gameState = createGameState();

      render(
        <GameBoard
          gameState={gameState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          onDispatch={onDispatch}
          isMyTurn={true}
          userUid="user_human"
        />
      );

      const doneBtn = screen.getByTestId('build-done-btn');
      expect(doneBtn).toBeInTheDocument();
      fireEvent.click(doneBtn);

      expect(onDispatch).toHaveBeenCalledTimes(1);
      expect(onDispatch).toHaveBeenCalledWith('END_TURN');
    });

    it('ignores N key presses during CPU turns or when not player turn', () => {
      const onDispatch = vi.fn();
      const gameState = createGameState();
      gameState.currentPlayerUid = 'user_cpu';

      render(
        <GameBoard
          gameState={gameState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          onDispatch={onDispatch}
          isMyTurn={false}
          userUid="user_human"
        />
      );

      fireEvent.keyDown(window, { key: 'n' });
      expect(onDispatch).not.toHaveBeenCalled();
    });

    it('suppresses N key presses when focused inside an input element', () => {
      const onDispatch = vi.fn();
      const gameState = createGameState();

      render(
        <div>
          <input data-testid="search-input" />
          <GameBoard
            gameState={gameState}
            selectedSpaceIndex={null}
            onSelectSpace={vi.fn()}
            isRolling={false}
            onDispatch={onDispatch}
            isMyTurn={true}
            userUid="user_human"
          />
        </div>
      );

      const input = screen.getByTestId('search-input');
      input.focus();
      fireEvent.keyDown(input, { key: 'n' });
      expect(onDispatch).not.toHaveBeenCalled();
    });

    it('displays updated "N — Decline / Done" label in left player panel', () => {
      render(
        <PlayerStrip
          players={[mockHuman, mockCpu]}
          currentPlayerUid="user_human"
          properties={mockProperties}
        />
      );

      const ref = screen.getByTestId('keyboard-shortcuts-reference');
      expect(ref).toBeInTheDocument();
      expect(screen.getByText('N')).toBeInTheDocument();
      expect(screen.getByText('Decline / Done')).toBeInTheDocument();
    });

    it('documents N decline and skip building in RulesModal and game rules guide', () => {
      const sec12 = GAME_RULES_SECTIONS.find((s) => s.id === 'keyboard-shortcuts');
      expect(sec12).toBeDefined();
      const contextItem = sec12?.items.find((i) => i.subtitle.includes('Context-Sensitive'));
      const nPoint = contextItem?.points.find((p) => p.startsWith('N:'));
      expect(nPoint).toContain('Done');
      expect(nPoint).toContain('declines property purchases');
      expect(nPoint).toContain('declines reacquisition');

      const buildSection = BUILDINGS_RULE_SECTION;
      const controlsItem = buildSection.items.find((i) => i.subtitle.includes('Keyboard Controls'));
      const nBuildPoint = controlsItem?.points.find((p) => p.startsWith('N:'));
      expect(nBuildPoint).toContain('Press N or click Done to skip building and end the current turn.');

      // Render RulesModal and verify text exists
      render(<RulesModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getAllByText(/All 12 Sections/i)[0]).toBeInTheDocument();
    });
  });
});
