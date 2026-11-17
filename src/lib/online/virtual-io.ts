/**
 * Indian Monopoly - In-Browser Virtual Socket.IO Server
 *
 * Implements the small subset of the Socket.IO `Server` / server `Socket` API that
 * `server/socket/socket-handlers.ts` uses, so the exact same authoritative handlers
 * that run on the LAN Node server can run inside the online host's browser.
 *
 * Sockets are either:
 *  - local:  the host's own UI, delivered by direct function call (zero latency), or
 *  - remote: a player on another device, delivered over a Supabase Realtime channel.
 */

export type DeliverFn = (event: string, args: unknown[]) => void;

export interface RemoteTransport {
  /** Channel key the remote peer is reachable on. */
  channelKey: string;
  /** Sends one message addressed to several socket ids on the same channel. */
  sendBatch: (socketIds: string[], event: string, args: unknown[]) => void;
}

type Handler = (...args: unknown[]) => unknown;
type Middleware = (socket: VirtualServerSocket, next: (err?: Error) => void) => unknown;

export class VirtualServerSocket {
  public readonly id: string;
  public data: Record<string, unknown> = {};
  public connected = true;
  public readonly handshake: { address: string; auth: Record<string, unknown> };
  public lastSeenAt = Date.now();

  private handlers = new Map<string, Handler[]>();
  private joined = new Set<string>();

  constructor(
    private readonly io: VirtualIo,
    id: string,
    auth: Record<string, unknown>,
    address: string,
    public readonly local: DeliverFn | null,
    public readonly remote: RemoteTransport | null,
    private readonly onServerDisconnect?: (reason: string) => void
  ) {
    this.id = id;
    this.handshake = { address, auth };
  }

  on(event: string, handler: Handler): this {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    if (!this.connected) return false;
    this.io.deliver([this], event, args);
    return true;
  }

  join(room: string | string[]): void {
    for (const r of Array.isArray(room) ? room : [room]) {
      this.joined.add(r);
      this.io.addToRoom(r, this.id);
    }
  }

  leave(room: string): void {
    this.joined.delete(room);
    this.io.removeFromRoom(room, this.id);
  }

  get rooms(): Set<string> {
    return new Set(this.joined);
  }

  /** Invokes registered handlers for an event coming from the client. */
  dispatch(event: string, args: unknown[], ack?: (...ackArgs: unknown[]) => void): void {
    this.lastSeenAt = Date.now();
    const list = this.handlers.get(event);
    if (!list || list.length === 0) {
      if (ack) ack({ ok: false, error: `Unknown event: ${event}` });
      return;
    }
    const callArgs = ack ? [...args, ack] : args;
    for (const h of list) {
      try {
        const res = h(...callArgs);
        if (res && typeof (res as Promise<unknown>).catch === 'function') {
          (res as Promise<unknown>).catch((err) => console.warn(`[VirtualIo] Handler "${event}" failed:`, err));
        }
      } catch (err) {
        console.warn(`[VirtualIo] Handler "${event}" threw:`, err);
      }
    }
  }

  /** Server-initiated or transport-detected disconnect. */
  disconnect(_close?: boolean, reason = 'server namespace disconnect'): this {
    if (!this.connected) return this;
    this.connected = false;
    for (const r of this.joined) this.io.removeFromRoom(r, this.id);
    this.joined.clear();
    this.io.removeSocket(this.id);
    const list = this.handlers.get('disconnect') || [];
    for (const h of list) {
      try {
        h(reason);
      } catch (err) {
        console.warn('[VirtualIo] disconnect handler threw:', err);
      }
    }
    this.onServerDisconnect?.(reason);
    return this;
  }
}

export class VirtualIo {
  public readonly sockets: { sockets: Map<string, VirtualServerSocket> } = { sockets: new Map() };
  private rooms = new Map<string, Set<string>>();
  private middlewares: Middleware[] = [];
  private connectionHandlers: Array<(socket: VirtualServerSocket) => void> = [];
  /** Observers notified of every outbound emit (used to schedule host snapshots). */
  public onEmit: ((event: string) => void) | null = null;

  use(fn: Middleware): this {
    this.middlewares.push(fn);
    return this;
  }

  on(event: string, handler: (socket: VirtualServerSocket) => void): this {
    if (event === 'connection' || event === 'connect') this.connectionHandlers.push(handler);
    return this;
  }

  to(target: string | string[]) {
    const targets = Array.isArray(target) ? target : [target];
    return {
      emit: (event: string, ...args: unknown[]) => {
        const ids = new Set<string>();
        for (const t of targets) {
          for (const id of this.rooms.get(t) || []) ids.add(id);
        }
        const sockets = [...ids].map((id) => this.sockets.sockets.get(id)).filter(Boolean) as VirtualServerSocket[];
        this.deliver(sockets, event, args);
        return true;
      },
    };
  }

  in(room: string) {
    return {
      socketsJoin: (target: string | string[]) => {
        for (const id of this.rooms.get(room) || []) {
          this.sockets.sockets.get(id)?.join(target);
        }
      },
    };
  }

  /** Registers a new connection, runs middleware, then fires `connection` handlers. */
  async connect(socket: VirtualServerSocket): Promise<void> {
    this.sockets.sockets.set(socket.id, socket);
    for (const mw of this.middlewares) {
      const err = await new Promise<Error | undefined>((resolve) => {
        try {
          const r = mw(socket, (e?: Error) => resolve(e));
          if (r && typeof (r as Promise<unknown>).catch === 'function') {
            (r as Promise<unknown>).catch((e) => resolve(e instanceof Error ? e : new Error(String(e))));
          }
        } catch (e) {
          resolve(e instanceof Error ? e : new Error(String(e)));
        }
      });
      if (err) {
        this.sockets.sockets.delete(socket.id);
        throw err;
      }
    }
    for (const h of this.connectionHandlers) h(socket);
  }

  /** Delivers one event to a set of sockets, batching remote ones per channel. */
  deliver(sockets: VirtualServerSocket[], event: string, args: unknown[]): void {
    this.onEmit?.(event);
    const remoteGroups = new Map<string, { transport: RemoteTransport; ids: string[] }>();
    for (const s of sockets) {
      if (!s.connected) continue;
      if (s.local) {
        s.local(event, args);
      } else if (s.remote) {
        const g = remoteGroups.get(s.remote.channelKey) || { transport: s.remote, ids: [] };
        g.ids.push(s.id);
        remoteGroups.set(s.remote.channelKey, g);
      }
    }
    for (const g of remoteGroups.values()) g.transport.sendBatch(g.ids, event, args);
  }

  addToRoom(room: string, id: string): void {
    const set = this.rooms.get(room) || new Set<string>();
    set.add(id);
    this.rooms.set(room, set);
  }

  removeFromRoom(room: string, id: string): void {
    const set = this.rooms.get(room);
    if (!set) return;
    set.delete(id);
    if (set.size === 0) this.rooms.delete(room);
  }

  removeSocket(id: string): void {
    this.sockets.sockets.delete(id);
  }
}
