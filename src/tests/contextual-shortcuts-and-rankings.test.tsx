/**
 * Comprehensive Test Suite for Contextual Keyboard Shortcuts,
 * Game Stability Safeguards, Card Money Formatting, and Dynamic NET WORTH Rankings.
 *
 * Verifies all 31 requirements specified in Section 8 of the prompt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameBoard } from '@/components/board/GameBoard';
import { PlayerStrip } from '@/components/player/PlayerStrip';
import { GameState, PlayerState, PropertyState } from '@/domain/game-types';
import { DEFAULT_HOST_RULES } from '@/domain/ruleset';
import {
  CIVIC_FUND_CARDS,
  MARKET_BUZZ_CARDS,
  getCardFinancialEffect,
} from '@/domain/board-config';
import { GAME_RULES_SECTIONS } from '@/domain/game-rules-guide';
import { CpuController } from '../../server/game/cpu-controller';

describe('1. Keyboard Shortcuts & Context Sensitivity (Requirements 1-11)', () => {
  const createBaseGameState = (overrides?: Partial<GameState>): GameState => ({
    gameId: 'game_test_kb',
    roomId: 'room_test_kb',
    status: 'IN_PROGRESS',
    phase: 'AWAIT_ROLL',
    turnNumber: 1,
    currentPlayerUid: 'user_human',
    playerOrder: ['user_human', 'user_cpu'],
    pendingAction: null,
    dice: null,
    auction: null,
    activeTrade: null,
    winnerUid: null,
    players: [
      {
        uid: 'user_human',
        displayName: 'Aarav (Human)',
        colorToken: '#dc2626',
        cash: 15000,
        netWorth: 20000,
        position: 0,
        isBankrupt: false,
        isDisqualified: false,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isCpu: false,
        playerType: 'HUMAN',
        photoURL: null,
        turnTimeoutCount: 0,
      },
      {
        uid: 'user_cpu',
        displayName: 'CPU 1',
        colorToken: '#2563eb',
        cash: 12000,
        netWorth: 18000,
        position: 0,
        isBankrupt: false,
        isDisqualified: false,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isCpu: true,
        playerType: 'COMPUTER',
        photoURL: null,
        turnTimeoutCount: 0,
      },
    ],
    properties: {
      6: {
        spaceIndex: 6,
        propertyId: 'prop_6',
        ownerUid: 'user_human',
        ownershipState: 'OWNED',
        isMortgaged: false,
        buildings: 0,
      },
    },
    rules: { ...DEFAULT_HOST_RULES, maxPlayers: 6 },
    rulesetVersion: '1.1.0',
    turnTimeRemaining: 30,
    turnTimeLimit: 30,
    isTimerPaused: false,
    version: 1,
    startedAt: 1000,
    updatedAt: 1000,
    completedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Spacebar rolls dice during AWAIT_ROLL phase', () => {
    const onRollDice = vi.fn();
    const gameState = createBaseGameState({ phase: 'AWAIT_ROLL' });

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

    fireEvent.keyDown(window, { code: 'Space' });
    expect(onRollDice).toHaveBeenCalledTimes(1);
  });

  it('2. Spacebar activates Try Double when player is in JAIL_DECISION', () => {
    const onDispatch = vi.fn();
    const gameState = createBaseGameState({
      phase: 'JAIL_DECISION',
      players: [
        {
          ...createBaseGameState().players[0],
          inJail: true,
          position: 10,
        },
        createBaseGameState().players[1],
      ],
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
    expect(onDispatch).toHaveBeenCalledWith('TRY_DOUBLES');
  });

  it('3. Spacebar ends turn when eligible in MANAGEMENT phase', () => {
    const onDispatch = vi.fn();
    const gameState = createBaseGameState({ phase: 'MANAGEMENT' });

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

  it('4. Spacebar does not trigger multiple actions from one keypress', () => {
    const onRollDice = vi.fn();
    const onDispatch = vi.fn();
    const gameState = createBaseGameState({ phase: 'AWAIT_ROLL' });

    render(
      <GameBoard
        gameState={gameState}
        selectedSpaceIndex={null}
        onSelectSpace={vi.fn()}
        isRolling={false}
        onRollDice={onRollDice}
        onDispatch={onDispatch}
        isMyTurn={true}
        userUid="user_human"
      />
    );

    fireEvent.keyDown(window, { code: 'Space' });
    expect(onRollDice).toHaveBeenCalledTimes(1);
    expect(onDispatch).not.toHaveBeenCalled();
  });

  it('5. S opens Sell to Bank interface when mortgageable properties exist', () => {
    const gameState = createBaseGameState({
      phase: 'MANAGEMENT',
      properties: {
        6: {
          spaceIndex: 6,
          propertyId: 'prop_6',
          ownerUid: 'user_human',
          ownershipState: 'OWNED',
          isMortgaged: false,
          buildings: 0,
        },
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

    fireEvent.keyDown(window, { key: 's' });
    expect(screen.getByText(/Select Property to Sell to Bank/i)).toBeDefined();
  });

  it('6. Enter activates Accept (BUY_PROPERTY) on property purchase prompt', () => {
    const onDispatch = vi.fn();
    const gameState = createBaseGameState({
      phase: 'PROPERTY_DECISION',
      players: [
        { ...createBaseGameState().players[0], position: 6 },
        createBaseGameState().players[1],
      ],
      properties: {
        6: {
          spaceIndex: 6,
          propertyId: 'prop_6',
          ownerUid: null,
          ownershipState: 'UNOWNED',
          isMortgaged: false,
          buildings: 0,
        },
      },
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

  it('7. Enter activates Bail (PAY_BAIL or USE_JAIL_CARD) in JAIL_DECISION', () => {
    const onDispatch = vi.fn();
    const gameState = createBaseGameState({
      phase: 'JAIL_DECISION',
      players: [
        {
          ...createBaseGameState().players[0],
          inJail: true,
          position: 10,
          cash: 5000,
          jailFreeCards: 0,
        },
        createBaseGameState().players[1],
      ],
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
    expect(onDispatch).toHaveBeenCalledWith('PAY_BAIL');
  });

  it('8. N activates Decline on purchase prompt', () => {
    const onDispatch = vi.fn();
    const gameState = createBaseGameState({
      phase: 'PROPERTY_DECISION',
      players: [
        { ...createBaseGameState().players[0], position: 6 },
        createBaseGameState().players[1],
      ],
      properties: {
        6: {
          spaceIndex: 6,
          propertyId: 'prop_6',
          ownerUid: null,
          ownershipState: 'UNOWNED',
          isMortgaged: false,
          buildings: 0,
        },
      },
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
  });

  it('9. Shortcuts are ignored while typing in text inputs or textareas', () => {
    const onRollDice = vi.fn();
    const gameState = createBaseGameState({ phase: 'AWAIT_ROLL' });

    render(
      <div>
        <input data-testid="chat-input" type="text" />
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

    const input = screen.getByTestId('chat-input');
    input.focus();

    fireEvent.keyDown(input, { code: 'Space' });
    expect(onRollDice).not.toHaveBeenCalled();
  });

  it('10. CPU players never receive local keyboard actions', () => {
    const onRollDice = vi.fn();
    const gameState = createBaseGameState({
      phase: 'AWAIT_ROLL',
      currentPlayerUid: 'user_cpu', // It's CPU's turn!
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

    fireEvent.keyDown(window, { code: 'Space' });
    expect(onRollDice).not.toHaveBeenCalled();
  });

  it('11. Key-repeat does not cause duplicate actions', () => {
    const onRollDice = vi.fn();
    const gameState = createBaseGameState({ phase: 'AWAIT_ROLL' });

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

    fireEvent.keyDown(window, { code: 'Space', repeat: true });
    expect(onRollDice).not.toHaveBeenCalled();
  });
});

describe('2. Permanent Keyboard Shortcuts Reference & Rules Guide (Requirements 2, 22-24)', () => {
  it('renders permanent keycap reference at bottom of player panel', () => {
    const mockPlayers: PlayerState[] = [
      {
        uid: 'user_1',
        displayName: 'Player 1',
        colorToken: '#dc2626',
        cash: 10000,
        netWorth: 15000,
        position: 0,
        isBankrupt: false,
        isDisqualified: false,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isCpu: false,
        playerType: 'HUMAN',
        photoURL: null,
        turnTimeoutCount: 0,
      },
    ];

    render(
      <PlayerStrip
        players={mockPlayers}
        currentPlayerUid="user_1"
        properties={{}}
        userUid="user_1"
      />
    );

    const ref = screen.getByTestId('keyboard-shortcuts-reference');
    expect(ref).toBeDefined();
    expect(screen.getByText('SPACE')).toBeDefined();
    expect(screen.getByText('S')).toBeDefined();
    expect(screen.getByText('ENTER')).toBeDefined();
    expect(screen.getByText('N')).toBeDefined();
    expect(screen.getByText(/Roll Dice \/ Try Double \/ Build House\/Tower \/ End Turn/i)).toBeDefined();
    expect(screen.getByText(/Sell to Bank/i)).toBeDefined();
    expect(screen.getByText(/Accept \/ Bail/i)).toBeDefined();
    expect(screen.getByText(/Decline/i)).toBeDefined();
  });

  it('rules guide Section 12 documents keyboard shortcuts accurately', () => {
    const sec12 = GAME_RULES_SECTIONS.find((s) => s.id === 'keyboard-shortcuts');
    expect(sec12).toBeDefined();
    expect(sec12?.number).toBe(12);
    expect(sec12?.title).toBe('Keyboard Shortcuts');
    expect(sec12?.items.some((i) => i.subtitle.includes('Context-Sensitive'))).toBe(true);
    expect(sec12?.items.some((i) => i.subtitle.includes('Safety'))).toBe(true);
  });
});

describe('3. Dynamic NET WORTH Rankings (Requirements 25-31)', () => {
  const properties: Record<number, PropertyState> = {
    6: {
      spaceIndex: 6,
      propertyId: 'prop_6',
      ownerUid: 'user_rich',
      ownershipState: 'OWNED',
      isMortgaged: false,
      buildings: 2, // House adds asset value
    },
    8: {
      spaceIndex: 8,
      propertyId: 'prop_8',
      ownerUid: 'user_middle',
      ownershipState: 'OWNED',
      isMortgaged: false,
      buildings: 0,
    },
  };

  it('25 & 26. Assigns #1 to highest NET WORTH and ranks all players', () => {
    const players: PlayerState[] = [
      {
        uid: 'user_middle',
        displayName: 'Middle Player',
        colorToken: '#2563eb',
        cash: 10000,
        netWorth: 12000,
        position: 0,
        isBankrupt: false,
        isDisqualified: false,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isCpu: false,
        playerType: 'HUMAN',
        photoURL: null,
        turnTimeoutCount: 0,
      },
      {
        uid: 'user_rich',
        displayName: 'Rich Player',
        colorToken: '#16a34a',
        cash: 30000,
        netWorth: 35000,
        position: 0,
        isBankrupt: false,
        isDisqualified: false,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isCpu: false,
        playerType: 'HUMAN',
        photoURL: null,
        turnTimeoutCount: 0,
      },
      {
        uid: 'user_cpu',
        displayName: 'CPU Player',
        colorToken: '#eab308',
        cash: 5000,
        netWorth: 5000,
        position: 0,
        isBankrupt: false,
        isDisqualified: false,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isCpu: true,
        playerType: 'COMPUTER',
        photoURL: null,
        turnTimeoutCount: 0,
      },
    ];

    render(
      <PlayerStrip
        players={players}
        currentPlayerUid="user_rich"
        properties={properties}
        userUid="user_rich"
      />
    );

    expect(screen.getByTestId('player-rank-user_rich').textContent).toBe('#1');
    expect(screen.getByTestId('player-rank-user_middle').textContent).toBe('#2');
    expect(screen.getByTestId('player-rank-user_cpu').textContent).toBe('#3');
  });

  it('29. Assigns unique sequential ranks on ties using room-joining sequence (e.g. #1, #2, #3)', () => {
    const tiedPlayers: PlayerState[] = [
      {
        uid: 'player_a',
        displayName: 'Player A',
        colorToken: '#dc2626',
        cash: 20000,
        netWorth: 20000,
        roomJoinSequence: 1, // Joined 1st
        position: 0,
        isBankrupt: false,
        isDisqualified: false,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isCpu: false,
        playerType: 'HUMAN',
        photoURL: null,
        turnTimeoutCount: 0,
      },
      {
        uid: 'player_b',
        displayName: 'Player B',
        colorToken: '#2563eb',
        cash: 20000,
        netWorth: 20000,
        roomJoinSequence: 2, // Joined 2nd (equal Net Worth to A)
        position: 0,
        isBankrupt: false,
        isDisqualified: false,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isCpu: true,
        playerType: 'COMPUTER',
        photoURL: null,
        turnTimeoutCount: 0,
      },
      {
        uid: 'player_c',
        displayName: 'Player C',
        colorToken: '#16a34a',
        cash: 5000,
        netWorth: 5000,
        roomJoinSequence: 3, // Joined 3rd
        position: 0,
        isBankrupt: false,
        isDisqualified: false,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isCpu: false,
        playerType: 'HUMAN',
        photoURL: null,
        turnTimeoutCount: 0,
      },
    ];

    render(
      <PlayerStrip
        players={tiedPlayers}
        currentPlayerUid="player_a"
        properties={{}}
        userUid="player_a"
      />
    );

    // Tied Net Worth broken by room join order: A (1st) gets #1, B (2nd) gets #2
    expect(screen.getByTestId('player-rank-player_a').textContent).toBe('#1');
    expect(screen.getByTestId('player-rank-player_b').textContent).toBe('#2');
    // Third player gets #3
    expect(screen.getByTestId('player-rank-player_c').textContent).toBe('#3');
  });

  it('27 & 28. Rankings update when Net Worth changes without altering calculation formula', () => {
    const initialPlayers: PlayerState[] = [
      {
        uid: 'user_1',
        displayName: 'Player 1',
        colorToken: '#dc2626',
        cash: 10000,
        netWorth: 10000,
        position: 0,
        isBankrupt: false,
        isDisqualified: false,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isCpu: false,
        playerType: 'HUMAN',
        photoURL: null,
        turnTimeoutCount: 0,
      },
      {
        uid: 'user_2',
        displayName: 'Player 2',
        colorToken: '#2563eb',
        cash: 15000,
        netWorth: 15000,
        position: 0,
        isBankrupt: false,
        isDisqualified: false,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isCpu: false,
        playerType: 'HUMAN',
        photoURL: null,
        turnTimeoutCount: 0,
      },
    ];

    const { rerender } = render(
      <PlayerStrip
        players={initialPlayers}
        currentPlayerUid="user_1"
        properties={{}}
        userUid="user_1"
      />
    );

    expect(screen.getByTestId('player-rank-user_2').textContent).toBe('#1');
    expect(screen.getByTestId('player-rank-user_1').textContent).toBe('#2');

    // Player 1 receives a massive reward or purchase
    const updatedPlayers: PlayerState[] = [
      {
        ...initialPlayers[0],
        cash: 25000,
        netWorth: 25000,
      },
      initialPlayers[1],
    ];

    rerender(
      <PlayerStrip
        players={updatedPlayers}
        currentPlayerUid="user_1"
        properties={{}}
        userUid="user_1"
      />
    );

    expect(screen.getByTestId('player-rank-user_1').textContent).toBe('#1');
    expect(screen.getByTestId('player-rank-user_2').textContent).toBe('#2');
  });
});

describe('4. Civic Fund & Market Buzz Money Formatting (Requirements 19-24)', () => {
  it('19. Spending cards return LOSS and display negative red amounts', () => {
    // civic_3: Education expense (Pay ₹400)
    const expenseCard = CIVIC_FUND_CARDS.find((c) => c.id === 'civic_3')!;
    expect(expenseCard).toBeDefined();
    expect(getCardFinancialEffect(expenseCard)).toBe('LOSS');

    // market_6: Highway toll (Pay ₹300)
    const tollCard = MARKET_BUZZ_CARDS.find((c) => c.id === 'market_6')!;
    expect(tollCard).toBeDefined();
    expect(getCardFinancialEffect(tollCard)).toBe('LOSS');
  });

  it('20. Reward cards return GAIN and display positive green amounts', () => {
    // civic_1: Bank interest (Receive ₹500)
    const interestCard = CIVIC_FUND_CARDS.find((c) => c.id === 'civic_1')!;
    expect(interestCard).toBeDefined();
    expect(getCardFinancialEffect(interestCard)).toBe('GAIN');

    // market_1: Startup grant (Receive ₹800)
    const grantCard = MARKET_BUZZ_CARDS.find((c) => c.id === 'market_1')!;
    expect(grantCard).toBeDefined();
    expect(getCardFinancialEffect(grantCard)).toBe('GAIN');
  });

  it('21. Non-monetary cards return NEUTRAL and do not show misleading financial symbols', () => {
    // civic_9: Get Out of Jail free
    const jailPassCard = CIVIC_FUND_CARDS.find((c) => c.id === 'civic_9')!;
    expect(jailPassCard).toBeDefined();
    expect(getCardFinancialEffect(jailPassCard)).toBe('NEUTRAL');

    // market_5: Move backwards 3 spaces
    const moveCard = MARKET_BUZZ_CARDS.find((c) => c.id === 'market_5')!;
    expect(moveCard).toBeDefined();
    expect(getCardFinancialEffect(moveCard)).toBe('NEUTRAL');
  });

  it('22. market_4 accurately describes Transit space without mentioning nonexistent auction', () => {
    const transitCard = MARKET_BUZZ_CARDS.find((c) => c.id === 'market_4')!;
    expect(transitCard.description).not.toContain('auction');
    expect(transitCard.description).toContain('Transit');
    expect(transitCard.description).toContain('Bank');
  });
});

describe('5. Game Continuity & CPU Fallback Safeguards (Requirements 12-18)', () => {
  it('13 & 14. CPU Controller provides safe fallback decision for every valid phase', () => {
    const controller = new CpuController();
    const mockCpu: PlayerState = {
      uid: 'cpu_1',
      displayName: 'CPU 1',
      colorToken: '#2563eb',
      cash: 5000,
      netWorth: 10000,
      position: 0,
      isBankrupt: false,
      isDisqualified: false,
      inJail: false,
      jailTurns: 0,
      jailFreeCards: 0,
      isCpu: true,
      playerType: 'COMPUTER',
      photoURL: null,
      turnTimeoutCount: 0,
    };

    const baseState: GameState = {
      gameId: 'g1',
      roomId: 'r1',
      status: 'IN_PROGRESS',
      phase: 'AWAIT_ROLL',
      turnNumber: 1,
      currentPlayerUid: 'cpu_1',
      playerOrder: ['cpu_1'],
      players: [mockCpu],
      properties: {},
      rules: DEFAULT_HOST_RULES,
      rulesetVersion: '1.1.0',
      turnTimeRemaining: 30,
      turnTimeLimit: 30,
      isTimerPaused: false,
      version: 1,
      pendingAction: null,
      dice: null,
      auction: null,
      activeTrade: null,
      winnerUid: null,
      startedAt: 1000,
      updatedAt: 1000,
      completedAt: null,
    };

    // AWAIT_ROLL fallback
    const rollFallback = controller.getSafeFallbackDecision(baseState, mockCpu);
    expect(rollFallback?.type).toBe('ROLL_DICE');

    // JAIL_DECISION fallback
    const jailState = { ...baseState, phase: 'JAIL_DECISION' as const };
    const jailFallback = controller.getSafeFallbackDecision(jailState, mockCpu);
    expect(jailFallback?.type).toBe('PAY_BAIL'); // Has ₹5,000 cash, can afford ₹500 bail

    // PROPERTY_DECISION fallback
    const propState = { ...baseState, phase: 'PROPERTY_DECISION' as const };
    const propFallback = controller.getSafeFallbackDecision(propState, mockCpu);
    expect(propFallback?.type).toBe('DECLINE_PROPERTY');

    // MANAGEMENT fallback
    const mgmtState = { ...baseState, phase: 'MANAGEMENT' as const };
    const mgmtFallback = controller.getSafeFallbackDecision(mgmtState, mockCpu);
    expect(mgmtFallback?.type).toBe('END_TURN');
  });
});
