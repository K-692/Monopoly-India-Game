/**
 * START salary is credited the moment the pawn crosses START (while still walking); other money waits
 * for the pawn to arrive. The active player sees a big YOUR TURN splash (other players do not).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

type Handler = (...args: unknown[]) => void;
const handlers = new Map<string, Set<Handler>>();
const fakeSocket = {
  connected: true,
  on: (event: string, h: Handler) => {
    const set = handlers.get(event) || new Set<Handler>();
    set.add(h);
    handlers.set(event, set);
    return fakeSocket;
  },
  off: (event: string, h: Handler) => {
    handlers.get(event)?.delete(h);
    return fakeSocket;
  },
  once: () => fakeSocket,
  emit: vi.fn(),
};
const fire = (event: string, ...args: unknown[]) => handlers.get(event)?.forEach((h) => h(...args));

vi.mock('@/lib/socket/socket-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getSocket: () => fakeSocket };
});

import { useGameStore } from '../features/game/use-game-store';
import { useAuthStore } from '../features/auth/use-auth-store';
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import { GameBoard } from '../components/board/GameBoard';
import type { GameState, RoomMember } from '../domain/game-types';

const members: Record<string, RoomMember> = {
  u1: { uid: 'u1', displayName: 'One', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
  u2: { uid: 'u2', displayName: 'Two', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
};

describe('START salary timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    handlers.clear();
    useGameStore.getState().closeFinishedGame('reset');
    useAuthStore.setState({ player: { uid: 'u1', displayName: 'One', avatarColor: '#EF4444' } });
  });
  afterEach(() => vi.useRealTimers());

  it('credits START while walking past it; landing money waits for arrival', () => {
    const base = createInitialGame('room_x', 'game_s', members, undefined, 'u1', { forcedPlayerOrder: ['u1', 'u2'] });
    base.players[0].position = 38;
    base.players[0].cash = 10000;
    base.version = 5;
    base.transactions = [];
    const cleanup = useGameStore.getState().initializeGameFromRoom('room_x', 'game_s', members);
    useGameStore.getState().setLiveGameState(base);

    // Server result: passed START (+3000) and paid ₹500 tax on landing at 2 → 12,500
    const after: GameState = JSON.parse(JSON.stringify(base));
    after.version = 6;
    after.players[0].position = 2;
    after.players[0].cash = 12500;
    after.dice = { rollId: 'r1', first: 1, second: 3, total: 4, isDouble: false, oldPos: 38, newPos: 2 } as GameState['dice'];
    after.transactions = [
      { transactionId: 'tx_start', gameSessionId: 'game_s', playerUid: 'u1', type: 'START_REWARD', direction: 'CREDIT', amount: 3000, balanceBefore: 10000, balanceAfter: 13000, description: 'START', timestamp: 1 } as never,
      { transactionId: 'tx_tax', gameSessionId: 'game_s', playerUid: 'u1', type: 'TAX', direction: 'DEBIT', amount: 500, balanceBefore: 13000, balanceAfter: 12500, description: 'Tax', timestamp: 2 } as never,
    ];
    fire('game:state', after);
    fire('game:event', { gameId: 'game_s', sequence: 6, commandId: 'c', actorUid: 'u1', type: 'ROLL_DICE', summary: 'rolled', payload: { rollId: 'r1', die1: 1, die2: 3, steps: 4, oldPos: 38, newPos: 2 }, createdAt: 0, versionAfter: 6 });

    const cash = () => useGameStore.getState().gameState!.players[0].cash;
    expect(cash()).toBe(10000);
    act(() => { vi.advanceTimersByTime(350 + 280); }); // pos 39
    expect(cash()).toBe(10000);
    act(() => { vi.advanceTimersByTime(280); }); // pos 0 = START
    expect(useGameStore.getState().walkingAnimation?.currentPos).toBe(0);
    expect(cash()).toBe(13000); // salary credited instantly while still walking
    act(() => { vi.advanceTimersByTime(280 * 2 + 200); }); // arrives at 2
    expect(useGameStore.getState().walkingAnimation).toBeNull();
    expect(cash()).toBe(12500); // tax applied on arrival
    cleanup();
  });
});

describe('YOUR TURN banner', () => {
  const board = (uid: string, state: GameState, isRolling = false) => (
    <GameBoard gameState={state} selectedSpaceIndex={null} onSelectSpace={vi.fn()} isRolling={isRolling} onDispatch={vi.fn()} isMyTurn={state.currentPlayerUid === uid} userUid={uid} />
  );

  it('stays on the active player’s screen until the dice are rolled, and never shows for others', () => {
    vi.useFakeTimers();
    const state = createInitialGame('room_x', 'game_t', members, undefined, 'u1', { forcedPlayerOrder: ['u1', 'u2'] });
    const view = render(board('u1', state));
    expect(screen.getByTestId('your-turn-banner')).toHaveTextContent('YOUR TURN');
    act(() => { vi.advanceTimersByTime(20000); });
    expect(screen.getByTestId('your-turn-banner')).toBeInTheDocument(); // no timeout

    // Rolling (player click/Space or the app's auto-roll) removes it
    view.rerender(board('u1', state, true));
    expect(screen.queryByTestId('your-turn-banner')).toBeNull();
    view.rerender(board('u1', { ...state, phase: 'MANAGEMENT' }));
    expect(screen.queryByTestId('your-turn-banner')).toBeNull();
    view.unmount();
    vi.useRealTimers();

    render(board('u2', state));
    expect(screen.queryByTestId('your-turn-banner')).toBeNull();
  });
});
