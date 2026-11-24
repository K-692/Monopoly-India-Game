/**
 * Multiple concurrent rooms must never interfere, and a player's previous room/game is flushed
 * whenever they create or join another room. Runs the real socket handlers on the in-browser
 * virtual Socket.IO server (the same engine the online host and the LAN server use).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Server } from 'socket.io';
import { GameManager } from '../../server/game/game-manager';
import { MemoryStore } from '../../server/persistence/memory-store';
import { RoomManager } from '../../server/rooms/room-manager';
import { setupSocketHandlers } from '../../server/socket/socket-handlers';
import { VirtualIo, VirtualServerSocket } from '../lib/online/virtual-io';
import { sanitizeHostSnapshot, type HostSnapshot } from '../lib/online/online-host';
import type { GameState, RoomState } from '../domain/game-types';

type Received = { event: string; args: unknown[] };

let store: MemoryStore;
let roomManager: RoomManager;
let gameManager: GameManager;
let io: VirtualIo;
let counter = 0;

async function connect(name: string) {
  const token = `${name.toLowerCase()}`.padEnd(64, 'a').replace(/[^a-f0-9]/g, 'a');
  const uid = `usr_${name.toLowerCase().padEnd(10, 'x')}`;
  roomManager.registerPlayer(name, '#C2410C', token, undefined, uid);
  const received: Received[] = [];
  const socket = new VirtualServerSocket(io, `s${++counter}`, { token }, 'test', (event, args) => received.push({ event, args }), null);
  await io.connect(socket);
  const emit = <T>(event: string, ...args: unknown[]) =>
    new Promise<T>((resolve) => socket.dispatch(event, args, (res: unknown) => resolve(res as T)));
  await emit('player:resume', { token });
  return { uid, socket, received, emit };
}

const gameIdsSeen = (received: Received[]) =>
  new Set(
    received
      .filter((r) => r.event === 'game:state')
      .map((r) => (r.args[0] as GameState).gameId)
  );

async function startRoomWithCpu(player: Awaited<ReturnType<typeof connect>>) {
  const created = await player.emit<{ ok: boolean; room: RoomState }>('room:create', {});
  expect(created.ok).toBe(true);
  await player.emit('room:add-cpu', {});
  await player.emit('room:set-ready', { isReady: true });
  const started = await player.emit<{ ok: boolean; gameId: string }>('room:start');
  expect(started.ok).toBe(true);
  return { roomId: created.room.roomId, inviteCode: created.room.inviteCode, gameId: started.gameId };
}

beforeEach(async () => {
  store = new MemoryStore();
  await store.init();
  roomManager = new RoomManager(store);
  gameManager = new GameManager(store);
  io = new VirtualIo();
  setupSocketHandlers(io as unknown as Server, roomManager, gameManager, () => true);
});

afterEach(() => {
  for (const g of gameManager.listGames()) gameManager.purgeGame(g.gameId);
});

describe('Concurrent rooms are isolated', () => {
  it('two games running at once never deliver state to each other’s players', async () => {
    const alice = await connect('Alice');
    const bob = await connect('Bob');
    const a = await startRoomWithCpu(alice);
    const b = await startRoomWithCpu(bob);
    expect(a.roomId).not.toBe(b.roomId);
    expect(a.inviteCode).not.toBe(b.inviteCode);

    // Play a command in each game
    for (const [p, g] of [[alice, a], [bob, b]] as const) {
      const state = gameManager.getGame(g.gameId)!;
      await gameManager.processCommand(
        g.gameId,
        { commandId: `c_${g.gameId}`, roomId: g.roomId, gameId: g.gameId, expectedVersion: state.version, type: 'ROLL_DICE', payload: {} },
        state.currentPlayerUid
      ).catch(() => undefined);
      void p;
    }
    await new Promise((r) => setTimeout(r, 50));

    expect([...gameIdsSeen(alice.received)]).toEqual([a.gameId]);
    expect([...gameIdsSeen(bob.received)]).toEqual([b.gameId]);

    // Timer and event broadcasts are stamped with their gameId
    const stamped = [...alice.received, ...bob.received].filter((r) => r.event === 'game:timer' || r.event === 'game:event');
    for (const r of stamped) expect((r.args[0] as { gameId?: string }).gameId).toBeTruthy();
  });
});

describe('Previous room/game is flushed when a player moves on', () => {
  it('creating a new room deletes the old CPU-only game and stops its broadcasts', async () => {
    const alice = await connect('Alice');
    const first = await startRoomWithCpu(alice);
    expect(gameManager.getGame(first.gameId)).not.toBeNull();

    const created = await alice.emit<{ ok: boolean; room: RoomState }>('room:create', {});
    expect(created.ok).toBe(true);

    expect(gameManager.getGame(first.gameId)).toBeNull();
    expect(roomManager.getRoom(first.roomId)).toBeNull();
    expect(roomManager.getRoomByCode(first.inviteCode)).toBeNull();
    expect([...alice.socket.rooms]).not.toContain(`game:${first.gameId}`);
    expect([...alice.socket.rooms]).toContain(`room:${created.room.roomId}`);
  });

  it('joining another room leaves the old one; the remaining human keeps playing with a bot seat', async () => {
    const alice = await connect('Alice');
    const bob = await connect('Bob');
    const carol = await connect('Carol');

    const room1 = await alice.emit<{ ok: boolean; room: RoomState }>('room:create', {});
    await bob.emit('room:join', { inviteCode: room1.room.inviteCode });
    await alice.emit('room:set-ready', { isReady: true });
    await bob.emit('room:set-ready', { isReady: true });
    const started = await alice.emit<{ ok: boolean; gameId: string }>('room:start');
    expect(started.ok).toBe(true);

    const room2 = await carol.emit<{ ok: boolean; room: RoomState }>('room:create', {});
    const joined = await bob.emit<{ ok: boolean }>('room:join', { inviteCode: room2.room.inviteCode });
    expect(joined.ok).toBe(true);

    // Bob is gone from room 1 and his seat in game 1 is bot-controlled; Alice's game continues
    const game1 = gameManager.getGame(started.gameId)!;
    expect(game1).not.toBeNull();
    expect(game1.players.find((p) => p.uid === bob.uid)?.isBotControlled).toBe(true);
    expect(roomManager.getRoom(room1.room.roomId)?.members[bob.uid]).toBeUndefined();
    expect([...bob.socket.rooms]).not.toContain(`game:${started.gameId}`);

    // Game 1 updates no longer reach Bob
    const before = bob.received.length;
    gameManager['emitBroadcast'](started.gameId, room1.room.roomId, 'game:state', game1);
    expect(bob.received.slice(before).some((r) => r.event === 'game:state')).toBe(false);
  });

  it('room:leave of the last human deletes the room and its game', async () => {
    const alice = await connect('Alice');
    const g = await startRoomWithCpu(alice);
    await alice.emit('room:leave');
    expect(gameManager.getGame(g.gameId)).toBeNull();
    expect(roomManager.getRoom(g.roomId)).toBeNull();
  });
});

describe('Invite codes', () => {
  it('regenerates a fresh unique code for a room', async () => {
    const alice = await connect('Alice');
    const created = await alice.emit<{ ok: boolean; room: RoomState }>('room:create', {});
    const oldCode = created.room.inviteCode;
    const fresh = roomManager.regenerateInviteCode(created.room.roomId)!;
    expect(fresh).toMatch(/^[A-Z0-9]{6}$/);
    expect(fresh).not.toBe(oldCode);
    expect(roomManager.getRoomByCode(fresh)?.roomId).toBe(created.room.roomId);
    expect(roomManager.getRoomByCode(oldCode)).toBeNull();
  });
});

describe('Host snapshot restore only keeps playable data', () => {
  it('drops finished, orphaned and CPU-only rooms and games', () => {
    const human = { uid: 'u1', displayName: 'A', isCpu: false };
    const cpu = { uid: 'c1', displayName: 'CPU', isCpu: true };
    const snap = {
      version: 1,
      savedAt: Date.now(),
      sessions: [{ uid: 'u1', roomId: 'r_lobby' }, { uid: 'u2', roomId: 'r_ok' }, { uid: 'u3', roomId: 'r_cpu_only' }],
      rooms: [
        { roomId: 'r_ok', status: 'IN_PROGRESS', gameId: 'g_ok', members: { u2: { uid: 'u2', displayName: 'B' } } },
        { roomId: 'r_cpu_only', status: 'IN_PROGRESS', gameId: 'g_cpu', members: { c1: cpu } },
        { roomId: 'r_done', status: 'COMPLETED', gameId: 'g_done', members: { u1: human } },
        { roomId: 'r_missing_game', status: 'IN_PROGRESS', gameId: 'g_missing', members: { u1: human } },
        { roomId: 'r_lobby', status: 'LOBBY', members: { u1: human } },
      ],
      games: [
        { gameId: 'g_ok', roomId: 'r_ok', status: 'IN_PROGRESS' },
        { gameId: 'g_cpu', roomId: 'r_cpu_only', status: 'IN_PROGRESS' },
        { gameId: 'g_stale', roomId: 'r_ok', status: 'IN_PROGRESS' },
      ],
      publishedRoomIds: ['r_ok', 'r_cpu_only', 'r_lobby'],
    } as unknown as HostSnapshot;

    const clean = sanitizeHostSnapshot(snap);
    expect(clean.rooms.map((r) => r.roomId).sort()).toEqual(['r_lobby', 'r_ok']);
    expect(clean.games.map((g) => g.gameId)).toEqual(['g_ok']);
    expect(clean.publishedRoomIds.sort()).toEqual(['r_lobby', 'r_ok']);
    expect(clean.sessions.find((s) => s.uid === 'u1')?.roomId).toBe('r_lobby');
    expect(clean.sessions.find((s) => s.uid === 'u3')?.roomId).toBeNull();
  });

  it('keeps only the room a player currently belongs to when they appear in two running games', () => {
    const tester = { uid: 'u1', displayName: 'Tester' };
    const cpu = { uid: 'c1', displayName: 'CPU1', isCpu: true };
    const snap = {
      version: 1,
      savedAt: Date.now(),
      sessions: [{ uid: 'u1', roomId: 'r_new' }],
      rooms: [
        { roomId: 'r_old', status: 'IN_PROGRESS', gameId: 'g_old', members: { u1: tester, c1: cpu } },
        { roomId: 'r_new', status: 'IN_PROGRESS', gameId: 'g_new', members: { u1: tester, c1: cpu } },
      ],
      games: [
        { gameId: 'g_old', roomId: 'r_old', status: 'IN_PROGRESS' },
        { gameId: 'g_new', roomId: 'r_new', status: 'IN_PROGRESS' },
      ],
      publishedRoomIds: ['r_old', 'r_new'],
    } as unknown as HostSnapshot;
    const clean = sanitizeHostSnapshot(snap);
    expect(clean.rooms.map((r) => r.roomId)).toEqual(['r_new']);
    expect(clean.games.map((g) => g.gameId)).toEqual(['g_new']);
  });
});
