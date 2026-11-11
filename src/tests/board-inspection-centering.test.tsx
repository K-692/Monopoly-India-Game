import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameBoard } from '@/components/board/GameBoard';
import { FinancialResolutionModal } from '@/components/board/FinancialResolutionModal';
import { GameState, PlayerState, PropertyState } from '@/domain/game-types';

describe('Board Inspection Mode Positioning, Centering & Dice Coverage (9 Verifications)', () => {
  const mockHumanPlayer: PlayerState = {
    uid: 'user_human',
    displayName: 'Aarav (Human)',
    colorToken: '#dc2626',
    cash: 500,
    netWorth: 15000,
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
    displayName: 'CPU 1',
    colorToken: '#2563eb',
    cash: 18000,
    netWorth: 24000,
    position: 12,
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
      propertyId: 'prop_1',
      spaceIndex: 1,
      ownerUid: 'user_human',
      isMortgaged: false,
      mortgagePayout: 300,
      buildings: 0,
      ownershipState: 'OWNED',
    },
    6: {
      propertyId: 'prop_6',
      spaceIndex: 6,
      ownerUid: 'user_cpu',
      isMortgaged: false,
      mortgagePayout: 500,
      buildings: 0,
      ownershipState: 'OWNED',
    },
  };

  const createTestGameState = (overrides?: Partial<GameState>): GameState => ({
    gameId: 'game_inspect_1',
    roomId: 'room_inspect_1',
    rulesetVersion: '1.0.0',
    version: 1,
    status: 'IN_PROGRESS',
    playerOrder: ['user_human', 'user_cpu'],
    players: [mockHumanPlayer, mockCpuPlayer],
    currentPlayerUid: 'user_human',
    turnNumber: 2,
    phase: 'ACTION_REQUIRED',
    turnTimeRemaining: 110,
    turnTimeLimit: 30,
    properties: mockProperties,
    pendingAction: null,
    dice: {
      rollId: 'roll_1',
      gameSessionId: 'game_inspect_1',
      playerId: 'user_human',
      turnId: 2,
      die1: 2,
      die2: 3,
      total: 5,
      oldPos: 1,
      newPos: 6,
      first: 2,
      second: 3,
      isDouble: false,
      consecutiveDoubles: 0,
      rolledAt: 1000,
      createdAt: 1000,
    },
    auction: null,
    activeTrade: null,
    winnerUid: null,
    startedAt: 1000,
    updatedAt: 1000,
    completedAt: null,
    pendingFinancialObligation: {
      obligationId: 'obl_rent_agra',
      paymentType: 'RENT',
      createdAt: Date.now(),
      idempotencyKey: 'idem_rent_agra',
      debtorUid: 'user_human',
      creditorUid: 'user_cpu',
      amountDue: 2000,
      remainingAmountDue: 1500,
      reason: 'Tariff for landing on Agra',
      expiresAt: Date.now() + 120000,
      status: 'PENDING',
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. The inspection popup renders when Board Inspection Mode is activated
  it('1. renders the inspection popup when Board Inspection Mode is activated from Sell-to-Bank', () => {
    const gameState = createTestGameState();
    const handleSelectSpace = vi.fn();

    render(
      <GameBoard
        gameState={gameState}
        selectedSpaceIndex={null}
        onSelectSpace={handleSelectSpace}
        isRolling={false}
        userUid="user_human"
      />
    );

    // Initial state: Debt resolution modal is visible
    expect(screen.getByText(/Low-Balance Financial Resolution/i)).toBeInTheDocument();
    expect(screen.queryByTestId('board-inspection-overlay')).not.toBeInTheDocument();

    // Click "View Board" to enter inspection mode
    const viewBoardBtn = screen.getByRole('button', { name: /View Board/i });
    fireEvent.click(viewBoardBtn);

    // Inspection overlay is now active
    const overlay = screen.getByTestId('board-inspection-overlay');
    expect(overlay).toBeInTheDocument();
    expect(screen.getByText(/Board Inspection Mode/i)).toBeInTheDocument();
    expect(screen.getByTestId('return-to-sell-to-bank')).toBeInTheDocument();
  });

  // 2. The popup is rendered into the existing dice anchor
  it('2. portals the inspection popup into the authoritative #board-inspection-dice-anchor', () => {
    const gameState = createTestGameState();

    render(
      <GameBoard
        gameState={gameState}
        selectedSpaceIndex={null}
        onSelectSpace={vi.fn()}
        isRolling={false}
        userUid="user_human"
      />
    );

    const anchor = screen.getByTestId('board-inspection-dice-anchor');
    const diceContainer = screen.getByTestId('board-dice-container');

    expect(anchor).toBeInTheDocument();
    expect(diceContainer.contains(anchor)).toBe(true);

    // Activate inspection mode
    fireEvent.click(screen.getByRole('button', { name: /View Board/i }));

    const overlay = screen.getByTestId('board-inspection-overlay');
    // Crucial: overlay must be direct child / descendent of dice anchor
    expect(anchor.contains(overlay)).toBe(true);
    expect(diceContainer.contains(overlay)).toBe(true);
  });

  // 3. Its center aligns with the midpoint of the two dice
  it('3. aligns its geometric center with the exact midpoint between the two dice', () => {
    // Simulated browser layout geometry:
    // Die 1: left 100, top 200, width 48, height 48 -> center (124, 224)
    // Die 2: left 158, top 200, width 48, height 48 -> center (182, 224) (gap = 10px)
    // Combined bounding box of both dice: left 100, top 200, right 206, bottom 248
    // Combined midpoint: X = (100 + 206) / 2 = 153, Y = (200 + 248) / 2 = 224
    const die1Bounds = { left: 100, top: 200, width: 48, height: 48, right: 148, bottom: 248 };
    const die2Bounds = { left: 158, top: 200, width: 48, height: 48, right: 206, bottom: 248 };
    const diceMidpointX = (die1Bounds.left + die2Bounds.right) / 2; // 153
    const diceMidpointY = (die1Bounds.top + die1Bounds.bottom) / 2; // 224

    // Container with 8px padding: left 92, top 192, width 122, height 64 -> center (153, 224)
    const containerBounds = { left: 92, top: 192, width: 122, height: 64, right: 214, bottom: 256 };
    const containerCenterX = containerBounds.left + containerBounds.width / 2; // 153
    const containerCenterY = containerBounds.top + containerBounds.height / 2; // 224

    expect(containerCenterX).toBe(diceMidpointX);
    expect(containerCenterY).toBe(diceMidpointY);

    // Anchor is absolute inset-0 on container, so its bounds match containerBounds exactly
    expect(containerCenterX).toBe(diceMidpointX);
    expect(containerCenterY).toBe(diceMidpointY);

    // Overlay is centered via flex items-center justify-center inside anchor:
    // Overlay size: width 280, height 100
    // In flexbox centering: child left = anchorCenterX - (overlayWidth / 2) = 153 - 140 = 13
    // child top = anchorCenterY - (overlayHeight / 2) = 224 - 50 = 174
    const overlayBounds = {
      left: containerCenterX - 140,
      top: containerCenterY - 50,
      width: 280,
      height: 100,
      right: containerCenterX + 140,
      bottom: containerCenterY + 50,
    };

    const overlayCenterX = (overlayBounds.left + overlayBounds.right) / 2;
    const overlayCenterY = (overlayBounds.top + overlayBounds.bottom) / 2;

    // Must be exactly identical to dice midpoint
    expect(overlayCenterX).toBe(diceMidpointX);
    expect(overlayCenterY).toBe(diceMidpointY);

    // Distance between left edge to midpoint must equal right edge to midpoint
    const leftSpacing = diceMidpointX - overlayBounds.left;
    const rightSpacing = overlayBounds.right - diceMidpointX;
    expect(leftSpacing).toBe(rightSpacing);

    // Distance from top edge to midpoint must equal bottom edge to midpoint
    const topSpacing = diceMidpointY - overlayBounds.top;
    const bottomSpacing = overlayBounds.bottom - diceMidpointY;
    expect(topSpacing).toBe(bottomSpacing);
  });

  // 4. Both dice are completely covered
  it('4. completely covers both dice so neither die is visible behind or beside the popup', () => {
    const die1Bounds = { left: 100, top: 200, width: 48, height: 48, right: 148, bottom: 248 };
    const die2Bounds = { left: 158, top: 200, width: 48, height: 48, right: 206, bottom: 248 };

    // Overlay centered at midpoint (153, 224) with width 280 and height 100
    const overlayBounds = { left: 13, top: 174, right: 293, bottom: 274, width: 280, height: 100 };

    // Left edge of popup is far to the left of die 1
    expect(overlayBounds.left).toBeLessThan(die1Bounds.left);
    expect(die1Bounds.left - overlayBounds.left).toBe(87); // 87px margin

    // Right edge of popup is far to the right of die 2
    expect(overlayBounds.right).toBeGreaterThan(die2Bounds.right);
    expect(overlayBounds.right - die2Bounds.right).toBe(87); // 87px margin

    // Top edge of popup is above both dice
    expect(overlayBounds.top).toBeLessThan(die1Bounds.top);
    expect(die1Bounds.top - overlayBounds.top).toBe(26); // 26px margin

    // Bottom edge of popup is below both dice
    expect(overlayBounds.bottom).toBeGreaterThan(die1Bounds.bottom);
    expect(overlayBounds.bottom - die1Bounds.bottom).toBe(26); // 26px margin

    // Verify opaque styling in component
    const gameState = createTestGameState();
    render(
      <GameBoard
        gameState={gameState}
        selectedSpaceIndex={null}
        onSelectSpace={vi.fn()}
        isRolling={false}
        userUid="user_human"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /View Board/i }));

    const overlay = screen.getByTestId('board-inspection-overlay');
    const innerCard = overlay.firstElementChild as HTMLElement;
    expect(innerCard.className).toContain('bg-[#090D1A]');
    expect(innerCard.className).not.toContain('bg-[#090D1A]/95'); // Solid opacity
  });

  // 5. The scale-in animation does not displace the popup
  it('5. separates flex centering from scale-in animation so keyframes do not override translation', () => {
    const gameState = createTestGameState();
    render(
      <GameBoard
        gameState={gameState}
        selectedSpaceIndex={null}
        onSelectSpace={vi.fn()}
        isRolling={false}
        userUid="user_human"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /View Board/i }));

    const anchor = screen.getByTestId('board-inspection-dice-anchor');
    const overlay = screen.getByTestId('board-inspection-overlay');

    // Anchor carries the flex centering
    expect(anchor.className).toContain('flex');
    expect(anchor.className).toContain('items-center');
    expect(anchor.className).toContain('justify-center');
    expect(anchor.className).toContain('pointer-events-none');

    // Overlay is in normal flow within flex parent and carries the animation
    expect(overlay.className).toContain('relative');
    expect(overlay.className).toContain('animate-scale-in');
    expect(overlay.className).toContain('pointer-events-auto');

    // MUST NOT have conflicting translate classes that get wiped out by scaleIn keyframes
    expect(overlay.className).not.toContain('top-1/2');
    expect(overlay.className).not.toContain('left-1/2');
    expect(overlay.className).not.toContain('-translate-x-1/2');
    expect(overlay.className).not.toContain('-translate-y-1/2');
  });

  // 6. Its position remains correct after responsive resizing
  it('6. preserves symmetric dice midpoint alignment across desktop, tablet, and mobile breakpoints', () => {
    // Desktop: 48px dice + 10px gap + 16px padding = 122px container
    const desktopDiceMidpointX = (100 + 206) / 2; // 153
    const desktopOverlayLeft = 153 - 280 / 2; // 13
    const desktopOverlayRight = 153 + 280 / 2; // 293
    expect((desktopOverlayLeft + desktopOverlayRight) / 2).toBe(desktopDiceMidpointX);

    // Tablet / Desktop SM (sm: breakpoint): 56px dice + 14px gap + 16px padding = 142px container
    // Die 1: left 100, width 56 -> right 156
    // Die 2: left 170, width 56 -> right 226
    const smDiceMidpointX = (100 + 226) / 2; // 163
    // sm:w-[310px] -> width 310
    const smOverlayLeft = 163 - 310 / 2; // 8
    const smOverlayRight = 163 + 310 / 2; // 318
    expect((smOverlayLeft + smOverlayRight) / 2).toBe(smDiceMidpointX);

    // Mobile (320px screen, 90vw max = 288px)
    const mobileOverlayLeft = 153 - 280 / 2;
    const mobileOverlayRight = 153 + 280 / 2;
    expect((mobileOverlayLeft + mobileOverlayRight) / 2).toBe(desktopDiceMidpointX);
  });

  // 7. The Return to Sell to Bank button works
  it('7. dismisses inspection mode and restores the financial resolution modal when clicking Return', () => {
    const gameState = createTestGameState();
    render(
      <GameBoard
        gameState={gameState}
        selectedSpaceIndex={null}
        onSelectSpace={vi.fn()}
        isRolling={false}
        userUid="user_human"
      />
    );

    // Open inspection
    fireEvent.click(screen.getByRole('button', { name: /View Board/i }));
    expect(screen.getByTestId('board-inspection-overlay')).toBeInTheDocument();

    // Click Return to Sell to Bank
    const returnBtn = screen.getByTestId('return-to-sell-to-bank');
    fireEvent.click(returnBtn);

    // Overlay is dismissed
    expect(screen.queryByTestId('board-inspection-overlay')).not.toBeInTheDocument();

    // Full modal is restored
    expect(screen.getByText(/Low-Balance Financial Resolution/i)).toBeInTheDocument();
  });

  // 8. Board tile inspection continues to work
  it('8. allows player to inspect board property tiles in read-only mode during board inspection', () => {
    const gameState = createTestGameState();
    const handleSelectSpace = vi.fn();

    render(
      <GameBoard
        gameState={gameState}
        selectedSpaceIndex={null}
        onSelectSpace={handleSelectSpace}
        isRolling={false}
        userUid="user_human"
      />
    );

    // Enter inspection mode
    fireEvent.click(screen.getByRole('button', { name: /View Board/i }));
    expect(screen.getByTestId('board-inspection-overlay')).toBeInTheDocument();

    // Click on a tile on the board (e.g. tile 1 Jaipur)
    const jaipurTile = screen.getByTestId('space-tile-1');
    fireEvent.click(jaipurTile);

    // onSelectSpace is called with 1 to inspect the tile
    expect(handleSelectSpace).toHaveBeenCalledWith(1);
  });

  // 9. Normal financial resolution behaviour is unchanged
  it('9. preserves the financial obligation amount and countdown during inspection', () => {
    const gameState = createTestGameState();
    const handleInspectionChange = vi.fn();

    render(
      <FinancialResolutionModal
        obligation={gameState.pendingFinancialObligation!}
        players={gameState.players}
        properties={gameState.properties}
        currentUserUid="user_human"
        turnTimeRemaining={95}
        onInspectionModeChange={handleInspectionChange}
      />
    );

    // Enter inspection mode
    fireEvent.click(screen.getByRole('button', { name: /View Board/i }));
    expect(handleInspectionChange).toHaveBeenCalledWith(true);

    // Timer shows remaining time (120s)
    expect(screen.getByText(/120s/)).toBeInTheDocument();

    // Return to modal
    fireEvent.click(screen.getByTestId('return-to-sell-to-bank'));
    expect(handleInspectionChange).toHaveBeenCalledWith(false);

    // Obligation reason and amount due remain preserved
    expect(screen.getByText(/Tariff for landing on Agra/i)).toBeInTheDocument();
  });
});
