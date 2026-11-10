import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerStrip } from '@/components/player/PlayerStrip';
import { RulesModal } from '@/components/rules/RulesModal';
import { GAME_RULES_SECTIONS } from '@/domain/game-rules-guide';
import { calculateNetWorth } from '@/domain/ruleset';
import { PlayerState, PropertyState, PendingFinancialObligation } from '@/domain/game-types';

describe('Player Cards: Separate Balance, Gold Net Worth & Active Turn Timer', () => {
  const mockPlayers: PlayerState[] = [
    {
      uid: 'player_human',
      displayName: 'Aarav (Host)',
      colorToken: '#dc2626',
      cash: 18500,
      netWorth: 24500,
      position: 5,
      isBankrupt: false,
      isDisqualified: false,
      inJail: false,
      jailTurns: 0,
      jailFreeCards: 0,
      isCpu: false,
      playerType: 'HUMAN',
      photoURL: '',
      turnTimeoutCount: 0,
    },
    {
      uid: 'player_cpu1',
      displayName: 'Vikram (CPU)',
      colorToken: '#2563eb',
      cash: 12000,
      netWorth: 19000,
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
    },
  ];

  const mockProperties: Record<number, PropertyState> = {
    // Player 1 owns Panaji (index 6, price ₹2,000) with 2 houses (buildingCost ₹1,000 each = ₹2,000) -> total asset ₹4,000
    6: {
      spaceIndex: 6,
      propertyId: 'prop_6',
      ownerUid: 'player_human',
      isMortgaged: false,
      mortgagePayout: 1000,
      buildings: 2,
      ownershipState: 'OWNED',
    },
    // Player 2 owns Urja Power Grid (index 17, price ₹1,500) -> total asset ₹1,500
    17: {
      spaceIndex: 17,
      propertyId: 'prop_17',
      ownerUid: 'player_cpu1',
      isMortgaged: false,
      mortgagePayout: 750,
      buildings: 0,
      ownershipState: 'OWNED',
    },
  };

  it('Requirement 1.A: displays Balance and NET WORTH separately on player cards', () => {
    render(
      <PlayerStrip
        players={mockPlayers}
        currentPlayerUid="player_human"
        properties={mockProperties}
        turnTimeRemaining={24}
        turnTimeLimit={30}
      />
    );

    // Player 1 Balance: prominent liquid cash
    const p1Balance = screen.getByTestId('player-balance-player_human');
    expect(p1Balance).toBeInTheDocument();
    expect(p1Balance.textContent).toContain('18,500');

    // Player 1 Net Worth: separate gold element with NET WORTH label
    const p1NetWorth = screen.getByTestId('player-networth-player_human');
    expect(p1NetWorth).toBeInTheDocument();
    expect(p1NetWorth.textContent).toContain('NET WORTH');
    // Cash 18,500 + Agra Price 1,000 + 2 Houses (2 * 500 = 1,000) = 20,500
    expect(p1NetWorth.textContent).toContain('20,500');

    // Player 2 Balance
    const p2Balance = screen.getByTestId('player-balance-player_cpu1');
    expect(p2Balance.textContent).toContain('12,000');

    // Player 2 Net Worth
    const p2NetWorth = screen.getByTestId('player-networth-player_cpu1');
    expect(p2NetWorth.textContent).toContain('NET WORTH');
    // Cash 12,000 + Utility (1,500) = 13,500
    expect(p2NetWorth.textContent).toContain('13,500');
  });

  it('Requirement 1.B: uses authoritative net-worth calculation deducting outstanding obligations', () => {
    const pendingObligation: PendingFinancialObligation = {
      obligationId: 'obl_test_1',
      paymentType: 'TAX',
      createdAt: Date.now(),
      idempotencyKey: 'idem_obl_test_1',
      debtorUid: 'player_human',
      creditorUid: 'BANK',
      amountDue: 5000,
      remainingAmountDue: 3500,
      reason: 'TAX',
      expiresAt: Date.now() + 120000,
      status: 'RESOLVING',
    };

    // Calculate net worth directly with the centralized function
    const directNW = calculateNetWorth('player_human', 18500, mockProperties, pendingObligation);
    // 18,500 + 2,000 asset - 3,500 liability = 17,000
    expect(directNW).toBe(17000);

    render(
      <PlayerStrip
        players={mockPlayers}
        currentPlayerUid="player_human"
        properties={mockProperties}
        pendingFinancialObligation={pendingObligation}
        turnTimeRemaining={15}
        turnTimeLimit={30}
      />
    );

    const p1NetWorth = screen.getByTestId('player-networth-player_human');
    expect(p1NetWorth.textContent).toContain('17,000');
  });

  it('Requirement 2: displays turn countdown timer ONLY on the active player card and moves on turn change', () => {
    const { rerender } = render(
      <PlayerStrip
        players={mockPlayers}
        currentPlayerUid="player_human"
        properties={mockProperties}
        turnTimeRemaining={22}
        turnTimeLimit={30}
      />
    );

    // Active player (player_human) has timer
    const activeTimer = screen.getByTestId('active-timer-player_human');
    expect(activeTimer).toBeInTheDocument();
    expect(activeTimer.textContent).toContain('22s');

    // Inactive player (player_cpu1) MUST NOT have a timer
    expect(screen.queryByTestId('active-timer-player_cpu1')).toBeNull();

    // Now turn changes to player_cpu1
    rerender(
      <PlayerStrip
        players={mockPlayers}
        currentPlayerUid="player_cpu1"
        properties={mockProperties}
        turnTimeRemaining={30}
        turnTimeLimit={30}
      />
    );

    // Player 1 timer is gone
    expect(screen.queryByTestId('active-timer-player_human')).toBeNull();

    // Player 2 timer is now active
    const newActiveTimer = screen.getByTestId('active-timer-player_cpu1');
    expect(newActiveTimer).toBeInTheDocument();
    expect(newActiveTimer.textContent).toContain('30s');
  });

  it('Requirement 2: reflects PAUSED state on active player timer during token movement animation', () => {
    render(
      <PlayerStrip
        players={mockPlayers}
        currentPlayerUid="player_human"
        properties={mockProperties}
        turnTimeRemaining={18}
        turnTimeLimit={30}
        isTimerPaused={true}
      />
    );

    const activeTimer = screen.getByTestId('active-timer-player_human');
    expect(activeTimer.textContent).toContain('PAUSED');
  });
});

describe('In-Game Rules Guide & RulesModal (?) Requirements', () => {
  it('Requirement 3.B: contains all 11 authoritative sections with complete fidelity', () => {
    expect(GAME_RULES_SECTIONS).toHaveLength(11);

    const expectedSections = [
      { num: 1, title: 'Objective of the Game' },
      { num: 2, title: 'Game Setup' },
      { num: 3, title: 'Turn Sequence' },
      { num: 4, title: 'START and Salary' },
      { num: 5, title: 'Properties and Ownership' },
      { num: 6, title: 'Market Buzz and Special Cards' },
      { num: 7, title: 'Taxes, Fees and Special Tiles' },
      { num: 8, title: 'Selling Properties to the Bank' },
      { num: 9, title: 'Debt and Bankruptcy' },
      { num: 10, title: 'Winning the Game' },
      { num: 11, title: 'Multiplayer and CPU Rules' },
    ];

    expectedSections.forEach(({ num, title }) => {
      const sec = GAME_RULES_SECTIONS.find((s) => s.number === num);
      expect(sec).toBeDefined();
      expect(sec?.title).toBe(title);
      expect(sec?.items.length).toBeGreaterThan(0);
    });
  });

  it('Requirement 3.A & 3.D: accurately documents Net Worth victory and tie-breaker rules', () => {
    const objectiveSec = GAME_RULES_SECTIONS.find((s) => s.id === 'objective');
    const winningSec = GAME_RULES_SECTIONS.find((s) => s.id === 'winning');

    expect(objectiveSec?.summary).toContain('highest authoritative Net Worth');
    expect(winningSec?.items.some((item) =>
      item.points.some((p) => p.includes('Tie-Breaker 1: Highest remaining Cash Balance'))
    )).toBe(true);
    expect(winningSec?.items.some((item) =>
      item.points.some((p) => p.includes('Tie-Breaker 2: Lowest Player UID'))
    )).toBe(true);
  });

  it('Requirement 3.A & 3.D: accurately documents Festival Travel Market Buzz card instruction', () => {
    const startSec = GAME_RULES_SECTIONS.find((s) => s.id === 'start-salary');
    const festItem = startSec?.items.find((item) => item.subtitle.includes('Festival Travel'));
    expect(festItem).toBeDefined();
    expect(festItem?.points.some((p) => p.includes('"Go to START and collect the starting money."'))).toBe(true);
  });

  it('Requirement 3.A & 3.D: accurately documents Sell to Bank and 120-second emergency window', () => {
    const sellSec = GAME_RULES_SECTIONS.find((s) => s.id === 'sell-to-bank');
    expect(sellSec?.items.some((item) =>
      item.points.some((p) => p.includes('50% of the property deed purchase price + 50% of all constructed house/tower expenditures'))
    )).toBe(true);
    expect(sellSec?.items.some((item) =>
      item.points.some((p) => p.includes('remain preserved on the deed'))
    )).toBe(true);

    const debtSec = GAME_RULES_SECTIONS.find((s) => s.id === 'debt-bankruptcy');
    expect(debtSec?.items.some((item) =>
      item.points.some((p) => p.includes('120-second countdown timer'))
    )).toBe(true);
    expect(debtSec?.items.some((item) =>
      item.points.some((p) => p.includes('Return to Sell to Bank'))
    )).toBe(true);
  });

  it('Requirement 3.C: RulesModal opens, filters sections, and closes cleanly without side effects', () => {
    const handleClose = vi.fn();
    const { rerender } = render(<RulesModal isOpen={true} onClose={handleClose} />);

    // Rules dialog is visible
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Official Rulebook & Strategy Reference')).toBeInTheDocument();

    // Section 1 is visible
    expect(screen.getAllByText('Objective of the Game').length).toBeGreaterThan(0);

    // Section 11 is visible
    expect(screen.getAllByText('Multiplayer and CPU Rules').length).toBeGreaterThan(0);

    // Search input filters content
    const searchInput = screen.getByPlaceholderText('Search rules...');
    fireEvent.change(searchInput, { target: { value: 'Festival Travel' } });
    expect(screen.getAllByText('START and Salary').length).toBeGreaterThan(0);

    // Click close button
    const closeBtns = screen.getAllByRole('button', { name: 'Close Rules' });
    expect(closeBtns.length).toBeGreaterThan(0);
    fireEvent.click(closeBtns[0]);
    expect(handleClose).toHaveBeenCalled();

    // Closed state
    rerender(<RulesModal isOpen={false} onClose={handleClose} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
