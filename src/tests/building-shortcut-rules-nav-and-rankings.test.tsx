import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameBoard } from '@/components/board/GameBoard';
import { PlayerStrip } from '@/components/player/PlayerStrip';
import { RulesModal } from '@/components/rules/RulesModal';
import { GameState, PlayerState } from '@/domain/game-types';
import { DEFAULT_HOST_RULES } from '@/domain/ruleset';
import {
  GAME_RULES_SECTIONS,
  RULES_CATEGORIES,
} from '@/domain/game-rules-guide';
import { RoomManager } from '../../server/rooms/room-manager';
import { createInitialGame } from '@/domain/game-engine/create-initial-game';

describe('1. Spacebar Shortcut for Build House/Tower', () => {
  const createBaseGameState = (overrides?: Partial<GameState>): GameState => ({
    gameId: 'game_build_test',
    roomId: 'room_build_test',
    status: 'IN_PROGRESS',
    phase: 'MANAGEMENT',
    turnNumber: 2,
    currentPlayerUid: 'user_human',
    playerOrder: ['user_human', 'user_cpu'],
    pendingAction: null,
    dice: { first: 3, second: 4, isDouble: false, consecutiveDoubles: 0, rolledAt: 1000 },
    auction: null,
    activeTrade: null,
    winnerUid: null,
    players: [
      {
        uid: 'user_human',
        displayName: 'Aarav (Human)',
        colorToken: '#dc2626',
        cash: 25000,
        netWorth: 35000,
        position: 6, // Connaught Place (Group 2: spaceIndex 6, 8, 9)
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isBankrupt: false,
        isCpu: false,
        playerType: 'HUMAN',
        photoURL: null,
        turnTimeoutCount: 0,
        roomJoinSequence: 1,
      },
      {
        uid: 'user_cpu',
        displayName: 'CPU 1',
        colorToken: '#2563eb',
        cash: 15000,
        netWorth: 15000,
        position: 0,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isBankrupt: false,
        isCpu: true,
        playerType: 'COMPUTER',
        photoURL: null,
        turnTimeoutCount: 0,
        roomJoinSequence: 2,
      },
    ],
    // Human owns full Group 2 Monopoly (spaces 6, 8, 9)
    properties: {
      6: {
        spaceIndex: 6,
        propertyId: 'prop_6',
        ownerUid: 'user_human',
        ownershipState: 'OWNED',
        isMortgaged: false,
        buildings: 0,
        mortgagePayout: 0,
        soldToBankPayout: 0,
      },
      8: {
        spaceIndex: 8,
        propertyId: 'prop_8',
        ownerUid: 'user_human',
        ownershipState: 'OWNED',
        isMortgaged: false,
        buildings: 0,
        mortgagePayout: 0,
        soldToBankPayout: 0,
      },
      9: {
        spaceIndex: 9,
        propertyId: 'prop_9',
        ownerUid: 'user_human',
        ownershipState: 'OWNED',
        isMortgaged: false,
        buildings: 0,
        mortgagePayout: 0,
        soldToBankPayout: 0,
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

  it('Spacebar invokes BUILD action when building interface is actively available', () => {
    const onDispatch = vi.fn();
    const gameState = createBaseGameState();

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

    // Verify build interface is visible
    expect(screen.getByText('🔨 Build Development?')).toBeInTheDocument();
    expect(screen.getByText('Build House')).toBeInTheDocument();

    // Press Spacebar
    fireEvent.keyDown(window, { code: 'Space' });

    // Dispatches BUILD with spaceIndex 6
    expect(onDispatch).toHaveBeenCalledTimes(1);
    expect(onDispatch).toHaveBeenCalledWith('BUILD', { spaceIndex: 6 });
  });

  it('Spacebar does not accidentally end the turn while build prompt is active', () => {
    const onDispatch = vi.fn();
    const gameState = createBaseGameState();

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

    // Should NOT call END_TURN
    expect(onDispatch).not.toHaveBeenCalledWith('END_TURN');
    expect(onDispatch).toHaveBeenCalledWith('BUILD', { spaceIndex: 6 });
  });

  it('Spacebar ends turn when building is NOT eligible during MANAGEMENT phase', () => {
    const onDispatch = vi.fn();
    // Maximum buildings (Tower) already reached on space 6, so building is ineligible
    const gameState = createBaseGameState({
      properties: {
        6: {
          spaceIndex: 6,
          propertyId: 'prop_6',
          ownerUid: 'user_human',
          ownershipState: 'OWNED',
          isMortgaged: false,
          buildings: 5, // Maximum development reached
          mortgagePayout: 0,
          soldToBankPayout: 0,
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

    // Build prompt not available
    expect(screen.queryByText('🔨 Build Development?')).toBeNull();

    fireEvent.keyDown(window, { code: 'Space' });

    // Falls through to End Turn
    expect(onDispatch).toHaveBeenCalledTimes(1);
    expect(onDispatch).toHaveBeenCalledWith('END_TURN');
  });

  it('Spacebar still rolls dice in AWAIT_ROLL phase', () => {
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

  it('Spacebar still tries double in JAIL_DECISION phase', () => {
    const onDispatch = vi.fn();
    const gameState = createBaseGameState({
      phase: 'JAIL_DECISION',
      players: [
        { ...createBaseGameState().players[0], inJail: true, jailTurns: 1 },
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

  it('Shortcuts are suppressed inside input fields and editable elements', () => {
    const onDispatch = vi.fn();
    const gameState = createBaseGameState();

    render(
      <div>
        <input data-testid="test-input" type="text" />
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

    const input = screen.getByTestId('test-input');
    input.focus();
    fireEvent.keyDown(input, { code: 'Space' });

    expect(onDispatch).not.toHaveBeenCalled();
  });

  it('CPU players never receive local Spacebar actions', () => {
    const onDispatch = vi.fn();
    const gameState = createBaseGameState({ currentPlayerUid: 'user_cpu' });

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

    fireEvent.keyDown(window, { code: 'Space' });
    expect(onDispatch).not.toHaveBeenCalled();
  });
});

describe('2. Rules Navigation & Structure (Requirement 3)', () => {
  it('defines 9 categories in RULES_CATEGORIES', () => {
    expect(RULES_CATEGORIES).toHaveLength(9);
    const catIds = RULES_CATEGORIES.map((c) => c.id);
    expect(catIds).toContain('overview');
    expect(catIds).toContain('setup-players');
    expect(catIds).toContain('turns-actions');
    expect(catIds).toContain('properties-rent');
    expect(catIds).toContain('buildings');
    expect(catIds).toContain('cards-special-tiles');
    expect(catIds).toContain('finance-debt');
    expect(catIds).toContain('winning-rankings');
    expect(catIds).toContain('keyboard-shortcuts');
  });

  it('RulesModal displays desktop navigation with all 9 categories', () => {
    const handleClose = vi.fn();
    render(<RulesModal isOpen={true} onClose={handleClose} />);

    const nav = screen.getByTestId('rules-desktop-navigation');
    expect(nav).toBeInTheDocument();

    expect(screen.getByTestId('nav-cat-overview')).toBeInTheDocument();
    expect(screen.getByTestId('nav-cat-setup-players')).toBeInTheDocument();
    expect(screen.getByTestId('nav-cat-turns-actions')).toBeInTheDocument();
    expect(screen.getByTestId('nav-cat-properties-rent')).toBeInTheDocument();
    expect(screen.getByTestId('nav-cat-buildings')).toBeInTheDocument();
    expect(screen.getByTestId('nav-cat-cards-special-tiles')).toBeInTheDocument();
    expect(screen.getByTestId('nav-cat-finance-debt')).toBeInTheDocument();
    expect(screen.getByTestId('nav-cat-winning-rankings')).toBeInTheDocument();
    expect(screen.getByTestId('nav-cat-keyboard-shortcuts')).toBeInTheDocument();
  });

  it('clicking a category navigation item filters content to that category', () => {
    const handleClose = vi.fn();
    render(<RulesModal isOpen={true} onClose={handleClose} />);

    // Click Buildings category
    const buildingsNavBtn = screen.getByTestId('nav-cat-buildings');
    fireEvent.click(buildingsNavBtn);

    // Shows Buildings content
    expect(screen.getAllByText(/Buildings & Developments/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Monopoly & Visiting-City Construction Rule/i).length).toBeGreaterThan(0);

    // Click Keyboard Shortcuts category
    const shortcutsNavBtn = screen.getByTestId('nav-cat-keyboard-shortcuts');
    fireEvent.click(shortcutsNavBtn);

    // Shows Keyboard Shortcuts content
    expect(screen.getAllByText('Keyboard Shortcuts').length).toBeGreaterThan(0);
    expect(screen.getByText(/constructs House\/Tower development/i)).toBeInTheDocument();
  });

  it('Return to Overview button navigates back to Overview', () => {
    const handleClose = vi.fn();
    render(<RulesModal isOpen={true} onClose={handleClose} />);

    // Navigate to Finance & Debt
    fireEvent.click(screen.getByTestId('nav-cat-finance-debt'));
    expect(screen.getAllByText(/Selling Properties to the Bank/i).length).toBeGreaterThan(0);

    // Click Return to Overview
    const returnBtn = screen.getByTestId('return-to-overview-btn');
    fireEvent.click(returnBtn);

    expect(screen.getAllByText(/Objective of the Game/i).length).toBeGreaterThan(0);
  });

  it('Keyboard Shortcuts accurately documents Spacebar Build House/Tower', () => {
    const sec12 = GAME_RULES_SECTIONS.find((s) => s.id === 'keyboard-shortcuts');
    expect(sec12).toBeDefined();
    const mappingPoint = sec12?.items[0]?.points.find((p) => p.startsWith('SPACE:'));
    expect(mappingPoint).toContain('rolls dice during AWAIT_ROLL');
    expect(mappingPoint).toContain('tries doubles while in Central Jail');
    expect(mappingPoint).toContain('constructs House/Tower development');
    expect(mappingPoint).toContain('ends your turn');
  });
});

describe('3. Dynamic NET WORTH Rankings & Room-Join Tie Breaking (Requirement 4)', () => {
  it('assigns unique sequential ranks and breaks equal Net Worth by roomJoinSequence', () => {
    const sixPlayers: PlayerState[] = [
      {
        uid: 'p_a',
        displayName: 'Player A',
        colorToken: '#dc2626',
        cash: 50000,
        netWorth: 50000,
        roomJoinSequence: 1, // 1st
        position: 0,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isBankrupt: false,
        turnTimeoutCount: 0,
        photoURL: null,
      },
      {
        uid: 'p_b',
        displayName: 'Player B',
        colorToken: '#2563eb',
        cash: 45000,
        netWorth: 45000,
        roomJoinSequence: 2, // 2nd (tied with C)
        position: 0,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isBankrupt: false,
        turnTimeoutCount: 0,
        photoURL: null,
      },
      {
        uid: 'p_c',
        displayName: 'Player C',
        colorToken: '#16a34a',
        cash: 45000,
        netWorth: 45000,
        roomJoinSequence: 3, // 3rd (tied with B)
        position: 0,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isBankrupt: false,
        turnTimeoutCount: 0,
        photoURL: null,
      },
      {
        uid: 'p_d',
        displayName: 'Player D',
        colorToken: '#d97706',
        cash: 30000,
        netWorth: 30000,
        roomJoinSequence: 4, // 4th
        position: 0,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isBankrupt: false,
        turnTimeoutCount: 0,
        photoURL: null,
      },
      {
        uid: 'p_e',
        displayName: 'Player E',
        colorToken: '#9333ea',
        cash: 25000,
        netWorth: 25000,
        roomJoinSequence: 5, // 5th (tied with F)
        position: 0,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isBankrupt: false,
        turnTimeoutCount: 0,
        photoURL: null,
      },
      {
        uid: 'p_f',
        displayName: 'Player F',
        colorToken: '#0d9488',
        cash: 25000,
        netWorth: 25000,
        roomJoinSequence: 6, // 6th (tied with E)
        position: 0,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isBankrupt: false,
        turnTimeoutCount: 0,
        photoURL: null,
      },
    ];

    render(
      <PlayerStrip
        players={sixPlayers}
        currentPlayerUid="p_a"
        properties={{}}
        userUid="p_a"
      />
    );

    // Every player receives a unique, sequential rank badge (#1 through #6)
    expect(screen.getByTestId('player-rank-p_a').textContent).toBe('#1');
    expect(screen.getByTestId('player-rank-p_b').textContent).toBe('#2');
    expect(screen.getByTestId('player-rank-p_c').textContent).toBe('#3');
    expect(screen.getByTestId('player-rank-p_d').textContent).toBe('#4');
    expect(screen.getByTestId('player-rank-p_e').textContent).toBe('#5');
    expect(screen.getByTestId('player-rank-p_f').textContent).toBe('#6');
  });

  it('reordering the player array does not alter original roomJoinSequence tie-breaking', () => {
    // Array order: C first, then B, then A
    const reorderedPlayers: PlayerState[] = [
      {
        uid: 'p_c',
        displayName: 'Player C',
        colorToken: '#16a34a',
        cash: 45000,
        netWorth: 45000,
        roomJoinSequence: 2, // joined after B
        position: 0,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isBankrupt: false,
        turnTimeoutCount: 0,
        photoURL: null,
      },
      {
        uid: 'p_b',
        displayName: 'Player B',
        colorToken: '#2563eb',
        cash: 45000,
        netWorth: 45000,
        roomJoinSequence: 1, // joined before C
        position: 0,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        isBankrupt: false,
        turnTimeoutCount: 0,
        photoURL: null,
      },
    ];

    render(
      <PlayerStrip
        players={reorderedPlayers}
        currentPlayerUid="p_c"
        properties={{}}
        userUid="p_c"
      />
    );

    // Player B joined earlier, so B receives #1, C receives #2 despite C being first in array
    expect(screen.getByTestId('player-rank-p_b').textContent).toBe('#1');
    expect(screen.getByTestId('player-rank-p_c').textContent).toBe('#2');
  });

  it('server RoomManager assigns monotonic roomJoinSequence and transfers to game initial state', () => {
    const roomManager = new RoomManager();
    const hostSession = roomManager.registerPlayer('Aarav Host');
    const guestSession = roomManager.registerPlayer('Diya Guest');

    // Host creates room with 1 initial CPU
    const createResult = roomManager.createRoom(hostSession.uid, DEFAULT_HOST_RULES, [{ name: 'CPU 1' }]);
    expect(createResult.ok).toBe(true);
    const room = createResult.room!;

    // Host is sequence 1, CPU 1 is sequence 2
    expect(room.members[hostSession.uid].roomJoinSequence).toBe(1);
    const cpuMember = Object.values(room.members).find((m) => m.isCpu);
    expect(cpuMember?.roomJoinSequence).toBe(2);

    // Diya joins room
    const joinResult = roomManager.joinRoom(room.inviteCode, guestSession.uid);
    expect(joinResult.ok).toBe(true);
    expect(joinResult.room!.members[guestSession.uid].roomJoinSequence).toBe(3);

    // Host adds another CPU
    const addCpuResult = roomManager.addCpu(room.roomId, hostSession.uid, 'CPU 2');
    expect(addCpuResult.ok).toBe(true);
    expect(addCpuResult.cpuMember!.roomJoinSequence).toBe(4);

    // createInitialGame preserves roomJoinSequence onto PlayerState
    const game = createInitialGame(room.roomId, 'test_game', room.members, DEFAULT_HOST_RULES);
    const playerHost = game.players.find((p) => p.uid === hostSession.uid);
    const playerGuest = game.players.find((p) => p.uid === guestSession.uid);
    const playerCpu1 = game.players.find((p) => p.uid === cpuMember!.uid);
    const playerCpu2 = game.players.find((p) => p.uid === addCpuResult.cpuMember!.uid);

    expect(playerHost?.roomJoinSequence).toBe(1);
    expect(playerCpu1?.roomJoinSequence).toBe(2);
    expect(playerGuest?.roomJoinSequence).toBe(3);
    expect(playerCpu2?.roomJoinSequence).toBe(4);
  });
});
