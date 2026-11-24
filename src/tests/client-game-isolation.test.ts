/**
 * The game screen only ever shows the game it opened: broadcasts for other games, older versions and
 * leftovers from a previous game are ignored or flushed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import type { GameState, RoomMember } from '../domain/game-types';

const members: Record<string, RoomMember> = {
  u1: { uid: 'u1', displayName: 'One', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
  u2: { uid: 'u2', displayName: 'Two', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
};

const game = (gameId: string, version: number, cash = 20000): GameState => {
  const g = createInitialGame('room_x', gameId, members, undefined, 'u1');
  g.version = version;
  g.players[0].cash = cash;
  return g;
};

describe('Client game isolation', () => {
  beforeEach(() => {
    handlers.clear();
    useGameStore.getState().closeFinishedGame('reset');
  });

  it('ignores state, timer and events from another game', () => {
    const cleanup = useGameStore.getState().initializeGameFromRoom('room_b', 'game_b', members);
    useGameStore.getState().setLiveGameState(game('game_b', 3, 15000));

    fire('game:state', game('game_a', 99, 1));
    fire('game:timer', { gameId: 'game_a', remaining: 1, activeUid: 'u1' });
    fire('game:event', { gameId: 'game_a', sequence: 9, commandId: 'x', actorUid: 'u1', type: 'X', summary: 'other', payload: {}, createdAt: 0, versionAfter: 99 });

    const s = useGameStore.getState();
    expect(s.gameState?.gameId).toBe('game_b');
    expect(s.gameState?.players[0].cash).toBe(15000);
    expect(s.gameState?.turnTimeRemaining).not.toBe(1);
    expect(s.events.some((e) => e.summary === 'other')).toBe(false);
    cleanup();
  });

  it('never steps back to an older version of the same game', () => {
    const cleanup = useGameStore.getState().initializeGameFromRoom('room_b', 'game_b', members);
    useGameStore.getState().setLiveGameState(game('game_b', 10, 12000));
    fire('game:state', game('game_b', 7, 99999));
    expect(useGameStore.getState().gameState?.version).toBe(10);
    fire('game:state', game('game_b', 11, 11000));
    expect(useGameStore.getState().gameState?.version).toBe(11);
    cleanup();
  });

  it('switching to a new game starts from a clean slate', () => {
    let cleanup = useGameStore.getState().initializeGameFromRoom('room_a', 'game_a', members);
    useGameStore.getState().setLiveGameState(game('game_a', 5));
    cleanup();
    cleanup = useGameStore.getState().initializeGameFromRoom('room_b', 'game_b', members);
    const s = useGameStore.getState();
    expect(s.gameState?.gameId).toBe('game_b');
    expect(s.walkingAnimation).toBeNull();
    expect(s.pendingCommandType).toBeNull();
    // A late reply for the old game cannot hijack the screen once listeners are scoped
    fire('game:state', game('game_a', 50));
    expect(useGameStore.getState().gameState?.gameId).toBe('game_b');
    cleanup();
  });
});
