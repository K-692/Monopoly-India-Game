import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameBoard } from '@/components/board/GameBoard';
import { FinancialResolutionModal } from '@/components/board/FinancialResolutionModal';
import { PlayerStrip } from '@/components/player/PlayerStrip';
import { sound } from '@/lib/audio/sound-engine';
import { GameState, PlayerState, PropertyState } from '@/domain/game-types';

describe('Refinements: Net Worth Typography, Board Preview, Alert Sounds & Keyboard Shortcuts', () => {
  const mockHumanPlayer: PlayerState = {
    uid: 'user_human',
    displayName: 'Priya (Human)',
    colorToken: '#dc2626',
    cash: 25000,
    netWorth: 35000,
    position: 6, // Agra
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

  const mockCpuPlayer: PlayerState = {
    uid: 'user_cpu',
    displayName: 'Rohan (CPU)',
    colorToken: '#2563eb',
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
    6: {
      spaceIndex: 6,
      propertyId: 'prop_6',
      ownerUid: null,
      isMortgaged: false,
      mortgagePayout: 500,
      buildings: 0,
      ownershipState: 'UNOWNED',
    },
  };

  const createBaseGameState = (overrides?: Partial<GameState>): GameState => ({
    gameId: 'game_test_1',
    roomId: 'room_test_1',
    rulesetVersion: '1.0.0',
    version: 1,
    status: 'IN_PROGRESS',
    playerOrder: ['user_human', 'user_cpu'],
    players: [mockHumanPlayer, mockCpuPlayer],
    currentPlayerUid: 'user_human',
    turnNumber: 1,
    phase: 'AWAIT_ROLL',
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
    movement: {
      playerId: 'user_human',
      startPos: 0,
      targetPos: 6,
      steps: 6,
      startedAt: 1000,
      endsAt: 2000,
      durationMs: 1000,
      isComplete: true,
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Net Worth Typography & Visual Hierarchy
  // =========================================================================
  describe('1. Net Worth Amount Font Size & Hierarchy', () => {
    it('renders net worth amount noticeably larger than before while remaining smaller than cash balance', () => {
      render(
        <PlayerStrip
          players={[mockHumanPlayer, mockCpuPlayer]}
          currentPlayerUid="user_human"
          properties={mockProperties}
        />
      );

      const balanceEl = screen.getByTestId('player-balance-user_human');
      const netWorthEl = screen.getByTestId('player-networth-user_human');
      const netWorthAmountEl = screen.getByTestId('player-networth-amount-user_human');

      // Cash balance: largest tier (text-[11px] sm:text-[12px] font-black)
      expect(balanceEl.className).toContain('font-black');
      expect(balanceEl.className).toMatch(/text-\[11px\]|text-\[12px\]/);

      // Net worth amount: medium tier (text-[9px] sm:text-[10px] font-bold font-mono)
      expect(netWorthAmountEl.className).toMatch(/text-\[9px\]|text-\[10px\]/);
      expect(netWorthAmountEl.className).toContain('font-bold');
      expect(netWorthAmountEl.className).toContain('font-mono');

      // Gold styling preserved
      expect(netWorthEl.className).toContain('text-amber-600');

      // Separation maintained
      expect(balanceEl.textContent).toContain('25,000');
      expect(netWorthEl.textContent).toContain('NET WORTH');
      expect(netWorthAmountEl.textContent).toContain('25,000');
    });
  });

  // =========================================================================
  // 2. Return to Sell to Bank Control Position
  // =========================================================================
  describe('2. Repositioned Return-to-Sell-to-Bank Control', () => {
    it('positions the Return to Sell to Bank control at the bottom-left corner of the board area', () => {
      const handleInspectionChange = vi.fn();
      const mockObligation = {
        obligationId: 'obl_1',
        paymentType: 'TAX' as const,
        createdAt: Date.now(),
        idempotencyKey: 'idem_1',
        debtorUid: 'user_human',
        creditorUid: 'BANK',
        amountDue: 4000,
        remainingAmountDue: 4000,
        reason: 'Statutory GST Assessment',
        expiresAt: Date.now() + 120000,
        status: 'PENDING' as const,
      };

      render(
        <FinancialResolutionModal
          obligation={mockObligation}
          players={[mockHumanPlayer]}
          properties={mockProperties}
          currentUserUid="user_human"
          turnTimeRemaining={115}
          onInspectionModeChange={handleInspectionChange}
        />
      );

      // Enter Board Inspection mode
      const viewBoardBtn = screen.getByRole('button', { name: /View Board/i });
      fireEvent.click(viewBoardBtn);
      expect(handleInspectionChange).toHaveBeenCalledWith(true);

      // Verify the return control is rendered
      const returnBtn = screen.getByTestId('return-to-sell-to-bank');
      expect(returnBtn).toBeInTheDocument();
      expect(returnBtn.textContent).toContain('Return to Sell to Bank');

      // Verify bottom-left positioning classes
      const container = returnBtn.closest('.fixed');
      expect(container).toBeDefined();
      expect(container?.className).toContain('bottom-3');
      expect(container?.className).toContain('left-3');

      // Clicking returns to the sell-to-bank dialog without cancelling the debt
      fireEvent.click(returnBtn);
      expect(handleInspectionChange).toHaveBeenCalledWith(false);
    });
  });

  // =========================================================================
  // 3. Alert Sounds for Purchase Prompt & Decline Actions
  // =========================================================================
  describe('3. Alert Sounds for Property Decision and Decline', () => {
    it('plays PURCHASE_PROMPT tone once when purchase prompt genuinely appears for human player', () => {
      const playSpy = vi.spyOn(sound, 'play');

      const gameState = createBaseGameState({
        phase: 'PROPERTY_DECISION',
        currentPlayerUid: 'user_human',
      });

      const { rerender } = render(
        <GameBoard
          gameState={gameState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          isMyTurn={true}
          userUid="user_human"
        />
      );

      // Verifies audio sound played once
      expect(playSpy).toHaveBeenCalledWith('PURCHASE_PROMPT');
      const callCount = playSpy.mock.calls.filter((c) => c[0] === 'PURCHASE_PROMPT').length;
      expect(callCount).toBe(1);

      // Re-renders with the same state MUST NOT duplicate the sound
      rerender(
        <GameBoard
          gameState={{ ...gameState }}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          isMyTurn={true}
          userUid="user_human"
        />
      );

      const secondCallCount = playSpy.mock.calls.filter((c) => c[0] === 'PURCHASE_PROMPT').length;
      expect(secondCallCount).toBe(1);
    });

    it('does NOT play PURCHASE_PROMPT tone on CPU turns or for other non-turn human players', () => {
      const playSpy = vi.spyOn(sound, 'play');

      // CPU turn
      const cpuGameState = createBaseGameState({
        phase: 'PROPERTY_DECISION',
        currentPlayerUid: 'user_cpu',
      });

      render(
        <GameBoard
          gameState={cpuGameState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          isMyTurn={false}
          userUid="user_human"
        />
      );

      const purchaseCalls = playSpy.mock.calls.filter((c) => c[0] === 'PURCHASE_PROMPT');
      expect(purchaseCalls).toHaveLength(0);
    });

    it('plays DECLINE_ACTION alert sound immediately when human player clicks Decline button', () => {
      const playSpy = vi.spyOn(sound, 'play');
      const onDispatch = vi.fn();

      const gameState = createBaseGameState({
        phase: 'PROPERTY_DECISION',
        currentPlayerUid: 'user_human',
      });

      render(
        <GameBoard
          gameState={gameState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          isMyTurn={true}
          userUid="user_human"
          onDispatch={onDispatch}
        />
      );

      const declineBtn = screen.getByTestId('decline-property-btn');
      fireEvent.click(declineBtn);

      expect(playSpy).toHaveBeenCalledWith('DECLINE_ACTION');
      expect(onDispatch).toHaveBeenCalledWith('DECLINE_PROPERTY');
    });
  });

  // =========================================================================
  // 4. Keyboard Shortcuts: Space, Enter, N
  // =========================================================================
  describe('4. Keyboard Shortcuts (Space, Enter, N)', () => {
    it('Space rolls dice for active human player in AWAIT_ROLL phase', () => {
      const onRollDice = vi.fn();

      const gameState = createBaseGameState({
        phase: 'AWAIT_ROLL',
        currentPlayerUid: 'user_human',
      });

      render(
        <GameBoard
          gameState={gameState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          onRollDice={onRollDice}
          isMyTurn={true}
          userUid="user_human"
        />
      );

      fireEvent.keyDown(window, { code: 'Space', key: ' ' });
      expect(onRollDice).toHaveBeenCalledTimes(1);
    });

    it('Space is ignored when not human turn or during CPU turn', () => {
      const onRollDice = vi.fn();

      const gameState = createBaseGameState({
        phase: 'AWAIT_ROLL',
        currentPlayerUid: 'user_cpu',
      });

      render(
        <GameBoard
          gameState={gameState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          onRollDice={onRollDice}
          isMyTurn={false}
          userUid="user_human"
        />
      );

      fireEvent.keyDown(window, { code: 'Space', key: ' ' });
      expect(onRollDice).not.toHaveBeenCalled();
    });

    it('Space does not trigger rolls when user is focused inside an input element', () => {
      const onRollDice = vi.fn();

      const gameState = createBaseGameState({
        phase: 'AWAIT_ROLL',
        currentPlayerUid: 'user_human',
      });

      render(
        <div>
          <input data-testid="test-input" type="text" />
          <GameBoard
            gameState={gameState}
            selectedSpaceIndex={null}
            onSelectSpace={vi.fn()}
            isRolling={false}
            onRollDice={onRollDice}
            isMyTurn={true}
            userUid="user_human"
          />
        </div>
      );

      const input = screen.getByTestId('test-input');
      input.focus();
      fireEvent.keyDown(input, { code: 'Space', key: ' ' });

      expect(onRollDice).not.toHaveBeenCalled();
    });

    it('Enter activates BUY_PROPERTY when property decision prompt is visible', () => {
      const onDispatch = vi.fn();

      const gameState = createBaseGameState({
        phase: 'PROPERTY_DECISION',
        currentPlayerUid: 'user_human',
      });

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

      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onDispatch).toHaveBeenCalledWith('BUY_PROPERTY', { spaceIndex: 6 });
    });

    it('Enter activates END_TURN when player is in MANAGEMENT phase', () => {
      const onDispatch = vi.fn();

      const gameState = createBaseGameState({
        phase: 'MANAGEMENT',
        currentPlayerUid: 'user_human',
      });

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

      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onDispatch).toHaveBeenCalledWith('END_TURN');
    });

    it('N activates DECLINE_PROPERTY and plays decline tone when purchase prompt is visible', () => {
      const onDispatch = vi.fn();
      const playSpy = vi.spyOn(sound, 'play');

      const gameState = createBaseGameState({
        phase: 'PROPERTY_DECISION',
        currentPlayerUid: 'user_human',
      });

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

      fireEvent.keyDown(window, { key: 'n' });
      expect(onDispatch).toHaveBeenCalledWith('DECLINE_PROPERTY');
      expect(playSpy).toHaveBeenCalledWith('DECLINE_ACTION');
    });

    it('Key repeat (holding key down) is ignored to prevent duplicate commands', () => {
      const onRollDice = vi.fn();

      const gameState = createBaseGameState({
        phase: 'AWAIT_ROLL',
        currentPlayerUid: 'user_human',
      });

      render(
        <GameBoard
          gameState={gameState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          onRollDice={onRollDice}
          isMyTurn={true}
          userUid="user_human"
        />
      );

      // Repeat event
      fireEvent.keyDown(window, { code: 'Space', key: ' ', repeat: true });
      expect(onRollDice).not.toHaveBeenCalled();
    });
  });
});
