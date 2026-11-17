/**
 * Indian Monopoly - Browser Room Host (online mode)
 *
 * Runs the same authoritative RoomManager + GameManager + socket handlers that the LAN
 * Node server runs, but inside the browser of the player who creates a room.
 *
 * - Remote players talk to it over a Supabase Realtime broadcast channel per room.
 * - The host's own UI talks to it through a zero-latency local loopback socket.
 * - State is snapshotted to Supabase Postgres so the host can refresh and resume.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Server } from 'socket.io';
import { GameManager } from '../../../server/game/game-manager';
import { randomHex } from '../../../server/lib/isomorphic-crypto';
import { MemoryStore } from '../../../server/persistence/memory-store';
import { RoomManager } from '../../../server/rooms/room-manager';
import { setupSocketHandlers } from '../../../server/socket/socket-handlers';
import type { PlayerSession, ServerRoom } from '../../../server/types/server-types';
import type { GameState } from '@/domain/game-types';
import {
  C2H_EVENT,
  ClientToHostMessage,
  H2C_EVENT,
  HostToClientMessage,
  PEER_TIMEOUT_MS,
} from './protocol';
import { channelForRoom, getSupabase } from './supabase-client';
import { DeliverFn, VirtualIo, VirtualServerSocket } from './virtual-io';

const HOST_KEY_STORAGE = 'monopoly_online_host_key';
const SNAPSHOT_INTERVAL_MS = 3000;
const REGISTER_REFRESH_MS = 10 * 60 * 1000;

interface HostSnapshot {
  version: 1;
  savedAt: number;
  sessions: PlayerSession[];
  rooms: ServerRoom[];
  games: GameState[];
  publishedRoomIds: string[];
}

interface HostedChannel {
  roomId: string;
  inviteCode: string;
  channel: RealtimeChannel;
  subscribed: Promise<void>;
  refreshTimer: ReturnType<typeof setInterval>;
}

function getHostKey(): string {
  try {
    let key = localStorage.getItem(HOST_KEY_STORAGE);
    if (!key || !/^[a-f0-9]{64}$/.test(key)) {
      key = randomHex(32);
      localStorage.setItem(HOST_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return randomHex(32);
  }
}

export class OnlineHost {
  private static instance: OnlineHost | null = null;

  static get(): OnlineHost {
    if (!OnlineHost.instance) OnlineHost.instance = new OnlineHost();
    return OnlineHost.instance;
  }

  readonly store = new MemoryStore();
  readonly roomManager = new RoomManager(this.store);
  readonly gameManager = new GameManager(this.store);
  readonly io = new VirtualIo();
  readonly ready: Promise<void>;

  private readonly hostKey = getHostKey();
  private isReady = false;
  private channels = new Map<string, HostedChannel>();
  private dirty = false;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private socketCounter = 0;

  private constructor() {
    setupSocketHandlers(
      this.io as unknown as Server,
      this.roomManager,
      this.gameManager,
      () => this.isReady
    );
    this.io.onEmit = (event) => {
      if (event === 'game:state' || event === 'room:state' || event === 'game:started' || event === 'room:created') {
        this.dirty = true;
      }
    };
    this.ready = this.restore().finally(() => {
      this.isReady = true;
      this.snapshotTimer = setInterval(() => void this.flushSnapshot(), SNAPSHOT_INTERVAL_MS);
      this.sweepTimer = setInterval(() => this.sweepRemotePeers(), 2000);
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => void this.flushSnapshot(true));
    }
  }

  /** Stops timers and leaves all channels (used by tests). */
  async dispose(): Promise<void> {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    for (const hosted of this.channels.values()) {
      clearInterval(hosted.refreshTimer);
      await getSupabase().removeChannel(hosted.channel);
    }
    this.channels.clear();
    if (OnlineHost.instance === this) OnlineHost.instance = null;
  }

  // ==========================================
  // LOCAL LOOPBACK (host's own UI)
  // ==========================================

  /** Connects the host's own UI as a zero-latency socket. */
  async connectLocal(auth: { uid: string; token: string; displayName: string; avatarColor: string }, sink: DeliverFn, onKick: (reason: string) => void): Promise<VirtualServerSocket> {
    await this.ready;
    this.ensureSession(auth);
    const socket = new VirtualServerSocket(
      this.io,
      `local_${++this.socketCounter}_${randomHex(4)}`,
      { token: auth.token },
      'online-host-local',
      sink,
      null,
      (reason) => onKick(reason)
    );
    await this.io.connect(socket);
    return socket;
  }

  private ensureSession(auth: { uid: string; token: string; displayName: string; avatarColor: string }): void {
    this.roomManager.registerPlayer(auth.displayName || 'Player', auth.avatarColor, auth.token, undefined, auth.uid);
  }

  // ==========================================
  // PUBLISHING ROOMS OVER SUPABASE REALTIME
  // ==========================================

  hasRoomWithCode(inviteCode: string): boolean {
    return Boolean(this.roomManager.getRoomByCode(inviteCode.toUpperCase()));
  }

  /** Makes a room reachable by invite code for players on other devices. */
  async publishRoom(room: { roomId: string; inviteCode: string }): Promise<void> {
    if (this.channels.has(room.roomId)) return;
    const supabase = getSupabase();
    const channelName = channelForRoom(room.roomId);

    const { data: registered, error } = await supabase.rpc('online_register_room', {
      p_invite_code: room.inviteCode,
      p_channel: channelName,
      p_room_id: room.roomId,
      p_host_key: this.hostKey,
    });
    if (error) throw new Error(`Could not publish room online: ${error.message}`);
    if (registered === false) throw new Error('This invite code is already used by another host.');

    const channel = supabase.channel(channelName, { config: { broadcast: { self: false, ack: false } } });
    channel.on('broadcast', { event: C2H_EVENT }, ({ payload }) => this.onClientMessage(room.roomId, payload as ClientToHostMessage));

    const subscribed = new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`Realtime channel ${status}`));
      });
    });

    const refreshTimer = setInterval(() => {
      void supabase.rpc('online_register_room', {
        p_invite_code: room.inviteCode,
        p_channel: channelName,
        p_room_id: room.roomId,
        p_host_key: this.hostKey,
      });
    }, REGISTER_REFRESH_MS);

    this.channels.set(room.roomId, { roomId: room.roomId, inviteCode: room.inviteCode, channel, subscribed, refreshTimer });
    this.dirty = true;
    await subscribed;
  }

  private send(roomId: string, msg: HostToClientMessage): void {
    const hosted = this.channels.get(roomId);
    if (!hosted) return;
    void hosted.channel.send({ type: 'broadcast', event: H2C_EVENT, payload: msg });
  }

  /** Measures host -> Supabase -> host latency using a broadcast acknowledgement. */
  async measureRelayLatency(): Promise<number | null> {
    const hosted = [...this.channels.values()][0];
    if (!hosted) return null;
    const t0 = performance.now();
    try {
      await hosted.channel.httpSend?.('hb', { t: Date.now() });
      return Math.round(performance.now() - t0);
    } catch {
      return null;
    }
  }

  private onClientMessage(roomId: string, msg: ClientToHostMessage): void {
    if (!msg || typeof msg !== 'object' || typeof msg.sid !== 'string') return;
    const existing = this.io.sockets.sockets.get(msg.sid);

    switch (msg.k) {
      case 'hello': {
        void this.acceptRemote(roomId, msg);
        return;
      }
      case 'emit': {
        if (!existing || existing.local) {
          this.send(roomId, { k: 'reset', to: [msg.sid] });
          return;
        }
        const ackId = msg.ack;
        const ack =
          typeof ackId === 'number'
            ? (...args: unknown[]) => this.send(roomId, { k: 'ack', to: [msg.sid], ack: ackId, args })
            : undefined;
        existing.dispatch(msg.ev, Array.isArray(msg.args) ? msg.args : [], ack);
        return;
      }
      case 'hb': {
        if (existing) {
          existing.lastSeenAt = Date.now();
          this.send(roomId, { k: 'ack', to: [msg.sid], ack: -1, args: [] });
        } else {
          this.send(roomId, { k: 'reset', to: [msg.sid] });
        }
        return;
      }
      case 'bye': {
        existing?.disconnect(false, 'client namespace disconnect');
        return;
      }
    }
  }

  private async acceptRemote(roomId: string, msg: Extract<ClientToHostMessage, { k: 'hello' }>): Promise<void> {
    await this.ready;
    const { auth, sid } = msg;
    if (!auth || typeof auth.token !== 'string' || typeof auth.uid !== 'string') return;

    // Re-hello on an existing socket id: just re-confirm.
    const prior = this.io.sockets.sockets.get(sid);
    if (prior && prior.connected) {
      prior.lastSeenAt = Date.now();
      this.send(roomId, { k: 'welcome', to: [sid] });
      return;
    }

    this.ensureSession(auth);
    const hosted = this.channels.get(roomId);
    if (!hosted) return;

    const socket = new VirtualServerSocket(
      this.io,
      sid,
      { token: auth.token },
      `online:${sid}`,
      null,
      {
        channelKey: roomId,
        sendBatch: (ids, event, args) => this.send(roomId, { k: 'emit', to: ids, ev: event, args }),
      },
      (reason) => {
        if (reason === 'server namespace disconnect') this.send(roomId, { k: 'kick', to: [sid], reason });
      }
    );

    try {
      await this.io.connect(socket);
      this.send(roomId, { k: 'welcome', to: [sid] });
    } catch (err) {
      console.warn('[OnlineHost] Rejected remote connection:', err);
    }
  }

  /** Disconnects remote peers that stopped sending heartbeats (closed tab, lost network). */
  private sweepRemotePeers(): void {
    const now = Date.now();
    for (const socket of [...this.io.sockets.sockets.values()]) {
      if (socket.remote && now - socket.lastSeenAt > PEER_TIMEOUT_MS) {
        socket.disconnect(false, 'ping timeout');
      }
    }
  }

  // ==========================================
  // SNAPSHOT PERSISTENCE (Supabase Postgres)
  // ==========================================

  private buildSnapshot(): HostSnapshot {
    const { sessions, rooms } = this.roomManager.exportState();
    return {
      version: 1,
      savedAt: Date.now(),
      sessions: sessions.map((s) => ({ ...s, socketId: null, connected: false })),
      rooms,
      games: this.gameManager.listGames().filter((g) => g.status !== 'COMPLETED'),
      publishedRoomIds: [...this.channels.keys()],
    };
  }

  private async flushSnapshot(force = false): Promise<void> {
    if (!this.isReady || (!this.dirty && !force) || this.channels.size === 0) return;
    this.dirty = false;
    const snapshot = this.buildSnapshot();
    try {
      localStorage.setItem('monopoly_online_host_snapshot', JSON.stringify(snapshot));
    } catch {
      // storage full or unavailable — Supabase copy is the source of truth
    }
    const { error } = await getSupabase().rpc('online_save_snapshot', { p_host_key: this.hostKey, p_snapshot: snapshot });
    if (error) {
      this.dirty = true;
      console.warn('[OnlineHost] Snapshot save failed:', error.message);
    }
  }

  private async restore(): Promise<void> {
    let snapshot: HostSnapshot | null = null;
    try {
      const res = await Promise.race([
        getSupabase().rpc('online_load_snapshot', { p_host_key: this.hostKey }),
        new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 5000)
        ),
      ]);
      if (!res.error && res.data) snapshot = res.data as HostSnapshot;
    } catch {
      // offline: fall through to local copy
    }
    if (!snapshot) {
      try {
        const raw = localStorage.getItem('monopoly_online_host_snapshot');
        if (raw) snapshot = JSON.parse(raw) as HostSnapshot;
      } catch {
        snapshot = null;
      }
    }
    if (!snapshot || snapshot.version !== 1) return;

    this.roomManager.importState({ sessions: snapshot.sessions, rooms: snapshot.rooms });
    for (const game of snapshot.games || []) {
      await this.store.createGame(game);
    }
    await this.gameManager.recoverActiveGames();

    for (const roomId of snapshot.publishedRoomIds || []) {
      const room = this.roomManager.getRoom(roomId);
      if (!room || room.status === 'COMPLETED' || room.status === 'ARCHIVED') continue;
      this.publishRoom({ roomId: room.roomId, inviteCode: room.inviteCode }).catch((err) =>
        console.warn('[OnlineHost] Could not republish room after restore:', err)
      );
    }
  }
}
