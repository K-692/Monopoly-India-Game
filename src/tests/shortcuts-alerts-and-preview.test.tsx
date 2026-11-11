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
    it('positions the Return to Sell to Bank control at the center of the board on top of the dices', () => {
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

      // Set up anchor in DOM matching GameBoard's dice anchor
      const anchor = document.createElement('div');
      anchor.id = 'board-inspection-dice-anchor';
      anchor.className = 'absolute inset-0 flex items-center justify-center pointer-events-none z-[130]';
      document.body.appendChild(anchor);

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

      // The overlay is rendered as a centered child inside the dice anchor without conflicting translate
      const overlay = screen.getByTestId('board-inspection-overlay');
      expect(anchor.contains(overlay)).toBe(true);
      expect(overlay.className).toContain('pointer-events-auto');
      expect(overlay.className).toContain('animate-scale-in');
      expect(overlay.className).not.toContain('-translate-x-1/2');
      expect(overlay.className).not.toContain('top-1/2');

      // Clicking returns to the sell-to-bank dialog without cancelling the debt
      fireEvent.click(returnBtn);
      expect(handleInspectionChange).toHaveBeenCalledWith(false);

      document.body.removeChild(anchor);
    });

    it('displays "120s Window" in the spectator Low-Balance Resolution pop-up', () => {
      const mockObligation = {
        obligationId: 'obl_spec',
        paymentType: 'TAX' as const,
        createdAt: Date.now(),
        idempotencyKey: 'idem_spec',
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
          players={[mockHumanPlayer, mockCpuPlayer]}
          properties={mockProperties}
          currentUserUid="user_cpu" // spectator
          turnTimeRemaining={115}
        />
      );

      expect(screen.getByText('120s Window')).toBeInTheDocument();
      expect(screen.getByText(/remaining/i)).toBeInTheDocument();
    });

    it('anchors the inspection overlay into board-inspection-dice-anchor when available', () => {
      // Create anchor element in DOM matching GameBoard's dice anchor
      const anchor = document.createElement('div');
      anchor.id = 'board-inspection-dice-anchor';
      document.body.appendChild(anchor);

      const mockObligation = {
        obligationId: 'obl_anchor',
        paymentType: 'TAX' as const,
        createdAt: Date.now(),
        idempotencyKey: 'idem_anchor',
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
          onInspectionModeChange={vi.fn()}
        />
      );

      // Enter inspection mode
      fireEvent.click(screen.getByRole('button', { name: /View Board/i }));

      // The overlay is portaled into the anchor element
      const overlay = screen.getByTestId('board-inspection-overlay');
      expect(anchor.contains(overlay)).toBe(true);

      // Cleanup
      document.body.removeChild(anchor);
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

    it('Spacebar activates END_TURN when player is in MANAGEMENT phase', () => {
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

      fireEvent.keyDown(window, { code: 'Space' });
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

  // =========================================================================
  // 5. Reacquisition Pop-up Content (Reacquire City vs Reacquire Property)
  // =========================================================================
  describe('5. Reacquisition Pop-up Content & Terminology', () => {
    it('displays "Reacquire City" prompt when active player lands on their mortgaged city', () => {
      const mortgagedCityState: PropertyState = {
        spaceIndex: 39, // Marine Drive (City / PROPERTY)
        propertyId: 'prop_39',
        ownerUid: 'user_human',
        isMortgaged: true,
        mortgagePayout: 2000,
        buildings: 0,
        ownershipState: 'MORTGAGED',
      };

      const gameState = createBaseGameState({
        phase: 'PROPERTY_DECISION',
        currentPlayerUid: 'user_human',
        players: [{ ...mockHumanPlayer, position: 39, cash: 10000 }],
        properties: { ...mockProperties, 39: mortgagedCityState },
        reacquisitionOpportunity: {
          landingId: 'reacquire_city_test',
          spaceIndex: 39,
          playerUid: 'user_human',
          cost: 2000,
          status: 'PENDING',
          turnNumber: 1,
        },
      });

      render(
        <GameBoard
          gameState={gameState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          isMyTurn={true}
          userUid="user_human"
        />
      );

      expect(screen.getByText('Reacquire City from Bank?')).toBeInTheDocument();
      expect(
        screen.getByText((_, element) =>
          element?.tagName.toLowerCase() === 'p' &&
          /Reacquire .* from the bank for ₹2,000/i.test(element.textContent || '')
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reacquire City/i })).toBeInTheDocument();
    });

    it('displays "Reacquire Property" prompt when active player lands on their mortgaged transit or utility', () => {
      const mortgagedTransitState: PropertyState = {
        spaceIndex: 5, // Howrah Railway (TRANSIT / Property)
        propertyId: 'prop_5',
        ownerUid: 'user_human',
        isMortgaged: true,
        mortgagePayout: 1000,
        buildings: 0,
        ownershipState: 'MORTGAGED',
      };

      const gameState = createBaseGameState({
        phase: 'PROPERTY_DECISION',
        currentPlayerUid: 'user_human',
        players: [{ ...mockHumanPlayer, position: 5, cash: 10000 }],
        properties: { ...mockProperties, 5: mortgagedTransitState },
        reacquisitionOpportunity: {
          landingId: 'reacquire_prop_test',
          spaceIndex: 5,
          playerUid: 'user_human',
          cost: 1000,
          status: 'PENDING',
          turnNumber: 1,
        },
      });

      render(
        <GameBoard
          gameState={gameState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          isMyTurn={true}
          userUid="user_human"
        />
      );

      expect(screen.getByText('Reacquire Property from Bank?')).toBeInTheDocument();
      expect(
        screen.getByText((_, element) =>
          element?.tagName.toLowerCase() === 'p' &&
          /Reacquire .* from the bank for ₹1,000/i.test(element.textContent || '')
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reacquire Property/i })).toBeInTheDocument();
    });
  });
});
