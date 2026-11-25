/**
 * Lobby features: emoji avatars & profile edits, host kick, same-slot rejoin (even after a name change),
 * and taking a seat back mid-game. Runs the real socket handlers on the in-browser virtual server.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Server } from 'socket.io';
import { GameManager } from '../../server/game/game-manager';
import { MemoryStore } from '../../server/persistence/memory-store';
import { RoomManager } from '../../server/rooms/room-manager';
import { setupSocketHandlers } from '../../server/socket/socket-handlers';
import { VirtualIo, VirtualServerSocket } from '../lib/online/virtual-io';
import type { RoomState } from '../domain/game-types';
import { sanitizeAvatarEmoji, avatarLabel } from '../domain/avatar';

let store: MemoryStore;
let roomManager: RoomManager;
let gameManager: GameManager;
let io: VirtualIo;
let n = 0;

async function connect(name: string, emoji?: string) {
  const token = (name.toLowerCase().replace(/[^a-f0-9]/g, 'a') + 'b'.repeat(64)).slice(0, 64);
  const uid = `usr_${name.toLowerCase().padEnd(10, 'x')}`;
  const received: Array<{ event: string; args: unknown[] }> = [];
  roomManager.registerPlayer(name, '#C2410C', token, undefined, uid, emoji ?? null);
  const socket = new VirtualServerSocket(io, `s${++n}`, { token }, 'test', (event, args) => received.push({ event, args }), null);
  await io.connect(socket);
  const emit = <T>(event: string, ...args: unknown[]) =>
    new Promise<T>((resolve) => socket.dispatch(event, args, (res: unknown) => resolve(res as T)));
  await emit('player:resume', { token });
  return { uid, socket, received, emit };
}

const slotOf = (room: RoomState | null | undefined, uid: string) => room?.members[uid]?.slotIndex;

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

describe('Emoji avatars', () => {
  it('accepts any emoji and rejects non-emoji text', () => {
    expect(sanitizeAvatarEmoji('🐯')).toBe('🐯');
    expect(sanitizeAvatarEmoji('🇮🇳')).toBe('🇮🇳');
    expect(sanitizeAvatarEmoji('👩🏽‍🚀 extra')).toBe('👩🏽‍🚀');
    expect(sanitizeAvatarEmoji('A')).toBeNull();
    expect(sanitizeAvatarEmoji('')).toBeNull();
    expect(avatarLabel({ displayName: 'priya', avatarEmoji: null })).toBe('P');
    expect(avatarLabel({ displayName: 'priya', avatarEmoji: '🦚' })).toBe('🦚');
  });

  it('carries the avatar from the session into the room and the game', async () => {
    const alice = await connect('Alice', '🐯');
    const room = await alice.emit<{ ok: boolean; room: RoomState }>('room:create', {});
    expect(room.room.members[alice.uid].avatarEmoji).toBe('🐯');
    await alice.emit('room:add-cpu', {});
    await alice.emit('room:set-ready', { isReady: true });
    const started = await alice.emit<{ ok: boolean; gameId: string }>('room:start');
    expect(gameManager.getGame(started.gameId)!.players.find((p) => p.uid === alice.uid)?.avatarEmoji).toBe('🐯');
  });
});

describe('Profile edits in the lobby', () => {
  it('updates name and avatar for everyone and rejects a duplicate name', async () => {
    const alice = await connect('Alice');
    const bob = await connect('Bob');
    const room = await alice.emit<{ ok: boolean; room: RoomState }>('room:create', {});
    await bob.emit('room:join', { inviteCode: room.room.inviteCode });

    const ok = await bob.emit<{ ok: boolean }>('player:update-profile', { displayName: 'Bobby', avatarEmoji: '🦁' });
    expect(ok.ok).toBe(true);
    const r = roomManager.getRoom(room.room.roomId)!;
    expect(r.members[bob.uid].displayName).toBe('Bobby');
    expect(r.members[bob.uid].avatarEmoji).toBe('🦁');
    const aliceSaw = alice.received.filter((e) => e.event === 'room:state').pop()?.args[0] as RoomState;
    expect(aliceSaw.members[bob.uid].displayName).toBe('Bobby');

    const clash = await bob.emit<{ ok: boolean; error?: string }>('player:update-profile', { displayName: 'alice' });
    expect(clash.ok).toBe(false);
    expect(clash.error).toMatch(/already in this room/);
  });
});

describe('Host kick', () => {
  it('removes the player, tells them, and blocks rejoining; only the host can kick', async () => {
    const alice = await connect('Alice');
    const bob = await connect('Bob');
    const carol = await connect('Carol');
    const room = await alice.emit<{ ok: boolean; room: RoomState }>('room:create', {});
    await bob.emit('room:join', { inviteCode: room.room.inviteCode });
    await carol.emit('room:join', { inviteCode: room.room.inviteCode });

    const notHost = await carol.emit<{ ok: boolean }>('room:kick', { uid: bob.uid });
    expect(notHost.ok).toBe(false);

    const kicked = await alice.emit<{ ok: boolean }>('room:kick', { uid: bob.uid });
    expect(kicked.ok).toBe(true);
    expect(roomManager.getRoom(room.room.roomId)!.members[bob.uid]).toBeUndefined();
    const notice = bob.received.find((e) => e.event === 'room:kicked');
    expect((notice?.args[0] as { message: string }).message).toBe('You have been kicked out from the room.');
    expect([...bob.socket.rooms]).not.toContain(`room:${room.room.roomId}`);

    const back = await bob.emit<{ ok: boolean; error?: string }>('room:join', { inviteCode: room.room.inviteCode });
    expect(back.ok).toBe(false);
  });
});

describe('Rejoin in the same slot', () => {
  it('a player who leaves the lobby gets their slot back even after changing their name', async () => {
    const alice = await connect('Alice');
    const bob = await connect('Bob');
    const carol = await connect('Carol');
    const dave = await connect('Dave');
    const room = await alice.emit<{ ok: boolean; room: RoomState }>('room:create', {});
    await bob.emit('room:join', { inviteCode: room.room.inviteCode });
    await carol.emit('room:join', { inviteCode: room.room.inviteCode });
    const bobSlot = slotOf(roomManager.getRoom(room.room.roomId), bob.uid);
    expect(bobSlot).toBe(2);

    await bob.emit('room:leave');
    // Someone new joins meanwhile: they must not take Bob's held slot
    await dave.emit('room:join', { inviteCode: room.room.inviteCode });
    expect(slotOf(roomManager.getRoom(room.room.roomId), dave.uid)).toBe(4);

    await bob.emit('player:update-profile', { displayName: 'Robert', avatarEmoji: '🐼' });
    const back = await bob.emit<{ ok: boolean; room: RoomState }>('room:join', { inviteCode: room.room.inviteCode });
    expect(back.ok).toBe(true);
    const r = roomManager.getRoom(room.room.roomId)!;
    expect(r.members[bob.uid].slotIndex).toBe(2);
    expect(r.members[bob.uid].displayName).toBe('Robert');
    expect(r.members[bob.uid].avatarEmoji).toBe('🐼');
  });

  it('a player who leaves mid-game can rejoin and take their seat back from the bot', async () => {
    const alice = await connect('Alice');
    const bob = await connect('Bob');
    const room = await alice.emit<{ ok: boolean; room: RoomState }>('room:create', {});
    await bob.emit('room:join', { inviteCode: room.room.inviteCode });
    await alice.emit('room:set-ready', { isReady: true });
    await bob.emit('room:set-ready', { isReady: true });
    const started = await alice.emit<{ ok: boolean; gameId: string }>('room:start');

    await bob.emit('room:leave');
    expect(gameManager.getGame(started.gameId)!.players.find((p) => p.uid === bob.uid)?.isBotControlled).toBe(true);

    const back = await bob.emit<{ ok: boolean; room: RoomState }>('room:join', { inviteCode: room.room.inviteCode });
    expect(back.ok).toBe(true);
    expect(back.room.members[bob.uid]).toBeTruthy();
    expect(gameManager.getGame(started.gameId)!.players.find((p) => p.uid === bob.uid)?.isBotControlled).toBe(false);
    expect([...bob.socket.rooms]).toContain(`game:${started.gameId}`);
  });
});
