/**
 * Online mode (GitHub Pages + Supabase) transport tests.
 *
 * Runs a real browser-host engine (OnlineHost) and a remote OnlineSocket client against an
 * in-memory fake of Supabase Realtime broadcast + RPC, and plays through:
 * create room -> publish -> remote join by invite code -> ready -> start -> remote command -> ping -> leave.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// ------------------------------------------------------------------
// Fake Supabase (Realtime broadcast bus + RPC functions)
// ------------------------------------------------------------------
type BroadcastHandler = (msg: { payload: unknown }) => void;

const bus = new Map<string, Set<FakeChannel>>();
const roomsByCode = new Map<string, { channel: string; room_id: string; owner: string }>();
const snapshots = new Map<string, unknown>();
let messageBytes = 0;
let maxMessageBytes = 0;

class FakeChannel {
  private handlers = new Map<string, BroadcastHandler[]>();
  constructor(public readonly name: string) {}
  on(_type: 'broadcast', filter: { event: string }, handler: BroadcastHandler) {
    const list = this.handlers.get(filter.event) || [];
    list.push(handler);
    this.handlers.set(filter.event, list);
    return this;
  }
  subscribe(cb: (status: string) => void) {
    const set = bus.get(this.name) || new Set<FakeChannel>();
    set.add(this);
    bus.set(this.name, set);
    setTimeout(() => cb('SUBSCRIBED'), 0);
    return this;
  }
  async send(msg: { event: string; payload: unknown }) {
    const json = JSON.stringify(msg.payload);
    messageBytes += json.length;
    maxMessageBytes = Math.max(maxMessageBytes, json.length);
    for (const peer of bus.get(this.name) || []) {
      if (peer === this) continue; // broadcast self: false
      for (const h of peer.handlers.get(msg.event) || []) {
        setTimeout(() => h({ payload: JSON.parse(json) }), 1);
      }
    }
    return 'ok';
  }
  async httpSend() {
    return { success: true };
  }
  leave() {
    bus.get(this.name)?.delete(this);
  }
}

const fakeSupabase = {
  channel: (name: string) => new FakeChannel(name),
  removeChannel: async (ch: FakeChannel) => ch.leave(),
  rpc: async (fn: string, args: Record<string, string>) => {
    switch (fn) {
      case 'online_register_room': {
        const existing = roomsByCode.get(args.p_invite_code);
        if (existing && existing.owner !== args.p_host_key) return { data: false, error: null };
        roomsByCode.set(args.p_invite_code, { channel: args.p_channel, room_id: args.p_room_id, owner: args.p_host_key });
        return { data: true, error: null };
      }
      case 'online_lookup_room': {
        const r = roomsByCode.get(args.p_invite_code.toUpperCase());
        return { data: r ? [{ channel: r.channel, room_id: r.room_id, updated_at: new Date().toISOString() }] : [], error: null };
      }
      case 'online_save_snapshot':
        snapshots.set(args.p_host_key, args.p_snapshot);
        return { data: null, error: null };
      case 'online_load_snapshot':
        return { data: null, error: null };
      default:
        return { data: null, error: { message: `unknown rpc ${fn}` } };
    }
  },
};

vi.mock('../lib/online/supabase-client', () => ({
  getSupabase: () => fakeSupabase,
  channelForRoom: (roomId: string) => `mono-${roomId}`,
  lookupOnlineRoom: async (code: string) => {
    const res = await fakeSupabase.rpc('online_lookup_room', { p_invite_code: code });
    return (res.data as Array<{ channel: string; room_id: string; updated_at: string }>)[0] || null;
  },
}));

import { OnlineHost } from '../lib/online/online-host';
import { OnlineSocket } from '../lib/online/online-socket';
import type { VirtualServerSocket } from '../lib/online/virtual-io';
import type { GameState, RoomState } from '../domain/game-types';

const HOST_ID = { uid: 'usr_hostaaaaaaaa', token: 'a'.repeat(64), displayName: 'Host', avatarColor: '#C2410C' };
const GUEST_ID = { uid: 'usr_guestbbbbbbb', token: 'b'.repeat(64), displayName: 'Guest', avatarColor: '#1D4ED8' };

function waitFor<T>(check: () => T | undefined | null | false, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const v = check();
      if (v) return resolve(v as T);
      if (Date.now() - started > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 5);
    };
    tick();
  });
}

function hostEmit<T>(socket: VirtualServerSocket, event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve) => socket.dispatch(event, args, (res: unknown) => resolve(res as T)));
}

function clientEmit<T>(socket: OnlineSocket, event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve) => socket.emit(event, ...args, (res: unknown) => resolve(res as T)));
}

describe('Online mode over Supabase Realtime (browser-hosted rooms)', () => {
  let host: OnlineHost;
  let hostSocket: VirtualServerSocket;
  const hostEvents: Array<{ event: string; args: unknown[] }> = [];
  let guest: OnlineSocket;
  const guestStates: GameState[] = [];
  let guestRoom: RoomState | null = null;
  let inviteCode = '';
  let roomId = '';

  beforeAll(async () => {
    localStorage.clear();
    host = OnlineHost.get();
    hostSocket = await host.connectLocal(HOST_ID, (event, args) => hostEvents.push({ event, args }), () => {});
  });

  afterAll(async () => {
    guest?.disconnect();
    await host?.dispose();
    localStorage.clear();
  });

  it('host creates a room and publishes its invite code', async () => {
    const reg = await hostEmit<{ ok: boolean }>(hostSocket, 'player:register', { displayName: 'Host', token: HOST_ID.token });
    expect(reg.ok).toBe(true);

    const res = await hostEmit<{ ok: boolean; room: RoomState }>(hostSocket, 'room:create', { customRules: undefined });
    expect(res.ok).toBe(true);
    inviteCode = res.room.inviteCode;
    roomId = res.room.roomId;

    await host.publishRoom({ roomId, inviteCode });
    expect(roomsByCode.get(inviteCode)?.room_id).toBe(roomId);
  });

  it('a remote player connects through the channel and joins by invite code', async () => {
    localStorage.setItem('monopoly_player_uid', GUEST_ID.uid);
    localStorage.setItem('monopoly_reconnect_token', GUEST_ID.token);
    localStorage.setItem('monopoly_player_name', GUEST_ID.displayName);
    localStorage.setItem(
      'monopoly_online_target',
      JSON.stringify({ kind: 'remote', inviteCode, channel: `mono-${roomId}`, roomId })
    );

    guest = new OnlineSocket(true);
    guest.on('game:state', (s) => guestStates.push(s as GameState));
    guest.on('game:started', (d) => guestStates.push((d as { gameState: GameState }).gameState));
    guest.on('room:state', (r) => {
      guestRoom = r as RoomState;
    });
    await waitFor(() => guest.connected);

    const resumed = await clientEmit<{ ok: boolean; player: { uid: string } }>(guest, 'player:resume', { token: 'ignored' });
    expect(resumed.ok).toBe(true);
    expect(resumed.player.uid).toBe(GUEST_ID.uid);

    const joined = await clientEmit<{ ok: boolean; room: RoomState }>(guest, 'room:join', { inviteCode });
    expect(joined.ok).toBe(true);
    expect(Object.keys(joined.room.members)).toEqual(expect.arrayContaining([HOST_ID.uid, GUEST_ID.uid]));
  });

  it('ready + start propagates the game state to the remote player', async () => {
    await clientEmit(guest, 'room:set-ready', { isReady: true });
    await hostEmit(hostSocket, 'room:set-ready', { isReady: true });
    await waitFor(() => guestRoom && Object.values(guestRoom.members).filter((m) => m.isReady).length >= 1);

    const start = await hostEmit<{ ok: boolean; gameId: string }>(hostSocket, 'room:start');
    expect(start.ok).toBe(true);
    const state = await waitFor(() => guestStates.find((s) => s.gameId === start.gameId));
    expect(state.players.map((p) => p.uid)).toEqual(expect.arrayContaining([HOST_ID.uid, GUEST_ID.uid]));
  });

  it('the remote player can roll the dice on their turn and everyone sees the new state', async () => {
    const game = host.gameManager.listGames()[0];
    const activeUid = game.currentPlayerUid;
    const command = {
      commandId: 'cmd_online_roll_1',
      roomId: game.roomId,
      gameId: game.gameId,
      expectedVersion: game.version,
      type: 'ROLL_DICE' as const,
      payload: {},
    };

    const before = guestStates.length;
    if (activeUid === GUEST_ID.uid) {
      const res = await clientEmit<{ ok: boolean; error?: string }>(guest, 'game:command', command);
      expect(res.ok).toBe(true);
    } else {
      const res = await hostEmit<{ ok: boolean }>(hostSocket, 'game:command', command);
      expect(res.ok).toBe(true);
    }
    const latest = await waitFor(() => guestStates.length > before && guestStates[guestStates.length - 1]);
    expect(latest.version).toBeGreaterThan(game.version);
    // Supabase Realtime broadcast payloads must stay well under the 256 KB limit
    expect(maxMessageBytes).toBeLessThan(200 * 1024);
  });

  it('ping round-trips through the host', async () => {
    const t0 = performance.now();
    await new Promise<void>((resolve) => guest.emit('ping', () => resolve()));
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it('host snapshots state to Supabase for resume after refresh', async () => {
    await new Promise((r) => setTimeout(r, 3200));
    const snap = [...snapshots.values()][0] as { games: GameState[]; rooms: unknown[]; publishedRoomIds: string[] };
    expect(snap).toBeTruthy();
    expect(snap.games.length).toBe(1);
    expect(snap.publishedRoomIds).toContain(roomId);
  }, 6000);

  it('an unknown invite code gives a clear error', async () => {
    const lonely = new OnlineSocket(false);
    const res = await clientEmit<{ ok: boolean; error: string }>(lonely, 'room:join', { inviteCode: 'ZZZZZZ' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Room not found/);
    lonely.disconnect();
  });

  it('host notices when the remote player leaves (bye)', async () => {
    guest.disconnect();
    await waitFor(() => {
      const game = host.gameManager.listGames()[0];
      return game.players.find((p) => p.uid === GUEST_ID.uid)?.disconnectedAt;
    });
  });
});
