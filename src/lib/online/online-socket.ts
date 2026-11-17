/**
 * Indian Monopoly - Online Client Socket (GitHub Pages mode)
 *
 * Presents the same surface the UI already uses from socket.io-client
 * (`on/off/once/emit/connected/connect`), but routes traffic to either:
 *  - this browser's own OnlineHost (when you created the room), or
 *  - another player's OnlineHost over a Supabase Realtime channel (when you joined by code).
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { randomHex } from '../../../server/lib/isomorphic-crypto';
import {
  C2H_EVENT,
  ClientToHostMessage,
  H2C_EVENT,
  HEARTBEAT_MS,
  HostToClientMessage,
  PEER_TIMEOUT_MS,
} from './protocol';
import { getSupabase, lookupOnlineRoom } from './supabase-client';
import type { VirtualServerSocket } from './virtual-io';

type Listener = (...args: unknown[]) => void;
type Ack = (...args: unknown[]) => void;

type Target =
  | { kind: 'local' }
  | { kind: 'remote'; inviteCode: string; channel: string; roomId: string };

const TARGET_STORAGE = 'monopoly_online_target';
const HELLO_RETRY_MS = 3000;

function clone<T>(value: T): T {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/** Stable per-browser identity, shared with the auth store's localStorage keys. */
export function getOnlineIdentity(): { uid: string; token: string; displayName: string; avatarColor: string } {
  let uid = safeGet('monopoly_player_uid') || '';
  let token = safeGet('monopoly_reconnect_token') || '';
  if (!/^usr_[a-z0-9]{8,32}$/.test(uid) || !/^[a-f0-9]{32,128}$/.test(token)) {
    uid = 'usr_' + randomHex(6);
    token = randomHex(32);
    safeSet('monopoly_player_uid', uid);
    safeSet('monopoly_reconnect_token', token);
  }
  return {
    uid,
    token,
    displayName: safeGet('monopoly_player_name') || 'Player',
    avatarColor: safeGet('monopoly_player_color') || '#C2410C',
  };
}

function loadTarget(): Target {
  try {
    const raw = safeGet(TARGET_STORAGE);
    if (raw) {
      const t = JSON.parse(raw) as Target;
      if (t.kind === 'remote' && t.channel && t.inviteCode && t.roomId) return t;
    }
  } catch {
    // ignore
  }
  return { kind: 'local' };
}

export class OnlineSocket {
  public connected = false;
  public id: string | undefined;
  public readonly io = {
    on: (event: string, fn: Listener) => this.addListener(this.ioListeners, event, fn),
    off: (event: string, fn?: Listener) => this.removeListener(this.ioListeners, event, fn),
  };

  private listeners = new Map<string, Set<Listener>>();
  private ioListeners = new Map<string, Set<Listener>>();
  private queue: Array<{ ev: string; args: unknown[]; ack?: Ack }> = [];
  private target: Target = loadTarget();
  private connecting: Promise<void> | null = null;
  private stopped = false;

  // local
  private localSocket: VirtualServerSocket | null = null;

  // remote
  private channel: RealtimeChannel | null = null;
  private sid = '';
  private ackSeq = 0;
  private pendingAcks = new Map<number, Ack>();
  private lastHostMsgAt = 0;
  private hbTimer: ReturnType<typeof setInterval> | null = null;
  private helloTimer: ReturnType<typeof setTimeout> | null = null;
  private helloAttempts = 0;

  constructor(autoConnect = true) {
    if (autoConnect) void this.connect();
  }

  // ==========================================
  // EVENT EMITTER SURFACE
  // ==========================================

  on(event: string, fn: Listener): this {
    this.addListener(this.listeners, event, fn);
    return this;
  }

  once(event: string, fn: Listener): this {
    const wrapper: Listener = (...args) => {
      this.off(event, wrapper);
      fn(...args);
    };
    return this.on(event, wrapper);
  }

  off(event: string, fn?: Listener): this {
    this.removeListener(this.listeners, event, fn);
    return this;
  }

  removeAllListeners(): this {
    this.listeners.clear();
    this.ioListeners.clear();
    return this;
  }

  private addListener(map: Map<string, Set<Listener>>, event: string, fn: Listener): void {
    const set = map.get(event) || new Set<Listener>();
    set.add(fn);
    map.set(event, set);
  }

  private removeListener(map: Map<string, Set<Listener>>, event: string, fn?: Listener): void {
    if (!fn) map.delete(event);
    else map.get(event)?.delete(fn);
  }

  private fire(event: string, ...args: unknown[]): void {
    for (const fn of [...(this.listeners.get(event) || [])]) {
      try {
        fn(...args);
      } catch (err) {
        console.error(`[OnlineSocket] listener for "${event}" threw:`, err);
      }
    }
  }

  // ==========================================
  // CONNECTION LIFECYCLE
  // ==========================================

  connect(): this {
    this.stopped = false;
    if (!this.connected && !this.connecting) {
      this.connecting = (this.target.kind === 'remote' ? this.connectRemote(this.target) : this.connectLocal()).finally(() => {
        this.connecting = null;
      });
    }
    return this;
  }

  disconnect(): this {
    this.stopped = true;
    this.teardownRemote(true);
    this.localSocket?.disconnect(false, 'client namespace disconnect');
    this.localSocket = null;
    if (this.connected) {
      this.connected = false;
      this.fire('disconnect', 'io client disconnect');
    }
    return this;
  }

  /** Where this socket currently sends commands. */
  getTarget(): Target {
    return this.target;
  }

  isHost(): boolean {
    return this.target.kind === 'local';
  }

  private setTarget(t: Target): void {
    this.target = t;
    safeSet(TARGET_STORAGE, JSON.stringify(t));
  }

  private markConnected(): void {
    this.connected = true;
    this.fire('connect');
    const pending = this.queue.splice(0);
    for (const item of pending) this.forward(item.ev, item.args, item.ack);
  }

  private async connectLocal(): Promise<void> {
    const { OnlineHost } = await import('./online-host');
    const host = OnlineHost.get();
    try {
      this.localSocket = await host.connectLocal(
        getOnlineIdentity(),
        (event, args) => this.fire(event, ...clone(args)),
        (reason) => {
          this.localSocket = null;
          if (this.connected) {
            this.connected = false;
            this.fire('disconnect', reason);
          }
        }
      );
      this.id = this.localSocket.id;
      this.markConnected();
    } catch (err) {
      this.fire('connect_error', err instanceof Error ? err : new Error(String(err)));
    }
  }

  private async connectRemote(t: Extract<Target, { kind: 'remote' }>): Promise<void> {
    this.teardownRemote(false);
    const supabase = getSupabase();
    this.sid = 'peer_' + randomHex(8);
    this.id = this.sid;
    const channel = supabase.channel(t.channel, { config: { broadcast: { self: false, ack: false } } });
    this.channel = channel;
    channel.on('broadcast', { event: H2C_EVENT }, ({ payload }) => this.onHostMessage(payload as HostToClientMessage));

    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.fire('connect_error', new Error(`Realtime ${status}`));
          resolve();
        }
      });
    });

    this.helloAttempts = 0;
    this.sendHello();
    if (this.hbTimer) clearInterval(this.hbTimer);
    this.hbTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
  }

  private sendHello(): void {
    if (!this.channel || this.stopped) return;
    this.helloAttempts++;
    this.send({ k: 'hello', sid: this.sid, auth: getOnlineIdentity() });
    if (this.helloTimer) clearTimeout(this.helloTimer);
    this.helloTimer = setTimeout(() => void this.onHelloTimeout(), HELLO_RETRY_MS);
  }

  private async onHelloTimeout(): Promise<void> {
    if (this.connected || this.stopped || this.target.kind !== 'remote') return;
    this.fire('connect_error', new Error('Waiting for the room host to respond…'));
    // After a few unanswered attempts, check the room still exists; otherwise go back home.
    if (this.helloAttempts % 4 === 0) {
      try {
        const room = await lookupOnlineRoom(this.target.inviteCode);
        if (!room) {
          this.teardownRemote(true);
          this.setTarget({ kind: 'local' });
          await this.connectLocal();
          return;
        }
      } catch {
        // network trouble: keep retrying
      }
    }
    this.sendHello();
  }

  private heartbeat(): void {
    if (!this.channel) return;
    if (this.connected) {
      this.send({ k: 'hb', sid: this.sid });
      if (Date.now() - this.lastHostMsgAt > PEER_TIMEOUT_MS) {
        this.connected = false;
        this.fire('disconnect', 'ping timeout');
        this.sendHello();
      }
    }
  }

  private teardownRemote(sayBye: boolean): void {
    if (this.hbTimer) clearInterval(this.hbTimer);
    if (this.helloTimer) clearTimeout(this.helloTimer);
    this.hbTimer = null;
    this.helloTimer = null;
    if (this.channel) {
      if (sayBye && this.sid) this.send({ k: 'bye', sid: this.sid });
      const ch = this.channel;
      this.channel = null;
      void getSupabase().removeChannel(ch);
    }
    this.pendingAcks.clear();
  }

  private send(msg: ClientToHostMessage): void {
    void this.channel?.send({ type: 'broadcast', event: C2H_EVENT, payload: msg });
  }

  private onHostMessage(msg: HostToClientMessage): void {
    if (!msg || !Array.isArray(msg.to) || !msg.to.includes(this.sid)) return;
    this.lastHostMsgAt = Date.now();
    switch (msg.k) {
      case 'welcome':
        if (this.helloTimer) clearTimeout(this.helloTimer);
        if (!this.connected) this.markConnected();
        return;
      case 'emit':
        this.fire(msg.ev, ...(msg.args || []));
        return;
      case 'ack': {
        const fn = this.pendingAcks.get(msg.ack);
        if (fn) {
          this.pendingAcks.delete(msg.ack);
          fn(...(msg.args || []));
        }
        return;
      }
      case 'reset':
        // Host restarted and no longer knows this connection: re-introduce ourselves.
        if (this.connected) {
          this.connected = false;
          this.fire('disconnect', 'transport close');
        }
        this.sendHello();
        return;
      case 'kick':
        this.stopped = true;
        this.teardownRemote(false);
        if (this.connected) {
          this.connected = false;
          this.fire('disconnect', 'io server disconnect');
        }
        return;
    }
  }

  // ==========================================
  // EMIT & ROUTING
  // ==========================================

  emit(event: string, ...rawArgs: unknown[]): this {
    let ack: Ack | undefined;
    if (rawArgs.length > 0 && typeof rawArgs[rawArgs.length - 1] === 'function') {
      ack = rawArgs.pop() as Ack;
    }
    const args = rawArgs;

    switch (event) {
      case 'room:create':
        void this.handleCreate(args, ack);
        return this;
      case 'room:join':
        void this.handleJoin(args, ack);
        return this;
      case 'room:leave':
        this.forward(event, args, ack);
        if (this.target.kind === 'remote') {
          setTimeout(() => void this.switchToLocal(), 300);
        }
        return this;
      case 'player:register':
      case 'player:resume': {
        const identity = getOnlineIdentity();
        const data = { ...((args[0] as Record<string, unknown>) || {}), token: identity.token };
        this.forward(event, [data], ack);
        return this;
      }
      case 'ping':
        if (this.target.kind === 'local') {
          void this.localPing(ack);
          return this;
        }
        this.forward(event, args, ack);
        return this;
      default:
        this.forward(event, args, ack);
        return this;
    }
  }

  private forward(event: string, args: unknown[], ack?: Ack): void {
    if (!this.connected) {
      this.queue.push({ ev: event, args, ack });
      this.connect();
      return;
    }
    if (this.target.kind === 'local') {
      const local = this.localSocket;
      if (!local) {
        this.queue.push({ ev: event, args, ack });
        return;
      }
      const wrappedAck = ack ? (...a: unknown[]) => ack(...clone(a)) : undefined;
      const cloned = clone(args);
      queueMicrotask(() => local.dispatch(event, cloned, wrappedAck));
      return;
    }
    let ackId: number | undefined;
    if (ack) {
      ackId = ++this.ackSeq;
      this.pendingAcks.set(ackId, ack);
    }
    this.send({ k: 'emit', sid: this.sid, ev: event, args, ack: ackId });
  }

  /** The host's latency is its round trip to Supabase, which is what remote players add on top. */
  private async localPing(ack?: Ack): Promise<void> {
    const { OnlineHost } = await import('./online-host');
    await OnlineHost.get().measureRelayLatency();
    ack?.();
  }

  private async switchToLocal(): Promise<void> {
    if (this.target.kind === 'local' && this.localSocket) return;
    this.teardownRemote(true);
    this.connected = false;
    this.setTarget({ kind: 'local' });
    await this.connectLocal();
  }

  private async switchToRemote(t: Extract<Target, { kind: 'remote' }>): Promise<void> {
    this.localSocket?.disconnect(false, 'client namespace disconnect');
    this.localSocket = null;
    this.connected = false;
    this.setTarget(t);
    const connected = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        this.off('connect', onConnect);
        resolve(false);
      }, 15000);
      const onConnect = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      this.once('connect', onConnect);
    });
    await this.connectRemote(t);
    const ok = await connected;
    if (!ok) {
      this.teardownRemote(true);
      this.setTarget({ kind: 'local' });
      await this.connectLocal();
      throw new Error('The room host did not respond. Ask them to keep the game open and try again.');
    }
  }

  private async handleCreate(args: unknown[], ack?: Ack): Promise<void> {
    if (this.target.kind === 'remote') await this.switchToLocal();
    this.forward('room:create', args, async (...res: unknown[]) => {
      const response = res[0] as { ok?: boolean; room?: { roomId: string; inviteCode: string } } | undefined;
      if (response?.ok && response.room) {
        try {
          const { OnlineHost } = await import('./online-host');
          await OnlineHost.get().publishRoom(response.room);
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Could not publish the room online' });
          return;
        }
      }
      ack?.(...res);
    });
  }

  private async handleJoin(args: unknown[], ack?: Ack): Promise<void> {
    const inviteCode = String((args[0] as { inviteCode?: string } | undefined)?.inviteCode || '')
      .trim()
      .toUpperCase();
    try {
      const { OnlineHost } = await import('./online-host');
      if (this.target.kind === 'local' && OnlineHost.get().hasRoomWithCode(inviteCode)) {
        this.forward('room:join', args, ack);
        return;
      }
      if (this.target.kind === 'remote' && this.target.inviteCode === inviteCode && this.connected) {
        this.forward('room:join', args, ack);
        return;
      }
      const room = await lookupOnlineRoom(inviteCode);
      if (!room) {
        ack?.({ ok: false, error: 'Room not found. Check the code, and make sure the host still has the game open.' });
        return;
      }
      await this.switchToRemote({ kind: 'remote', inviteCode, channel: room.channel, roomId: room.room_id });
      this.forward('room:join', args, ack);
    } catch (err) {
      ack?.({ ok: false, error: err instanceof Error ? err.message : 'Could not join the room' });
    }
  }
}
