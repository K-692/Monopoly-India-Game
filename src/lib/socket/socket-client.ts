/**
 * Indian Monopoly - Network Client
 *
 * Two strictly separated multiplayer modes share one socket-like interface:
 * 1. LAN mode: Socket.IO to the Node host on the local Wi-Fi (no internet needed).
 * 2. Online mode (GitHub Pages): the room creator's browser runs the authoritative engine and
 *    other players connect to it through Supabase Realtime. No server to deploy or wake up.
 */

import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../../server/types/server-types';
import { OnlineSocket } from '../online/online-socket';

export type MonopolySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type NetworkMode = 'lan' | 'dev' | 'online';

export interface ServerConfig {
  /** Socket.IO URL for LAN/dev modes; null in online mode. */
  url: string | null;
  mode: NetworkMode;
}

export interface ConnectionStoreState {
  status: ConnectionStatus;
  serverUrl: string | null;
  mode: NetworkMode;
  /** True when playing online through Supabase (GitHub Pages build). */
  isPublicHosting: boolean;
  error: string | null;
  reconnectAttempts: number;
  retryConnection: () => void;
}

/**
 * Validates whether a hostname belongs to a local development machine or a private LAN network.
 */
export function isPrivateNetworkHost(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local')
  ) {
    return true;
  }

  // 10.0.0.0 - 10.255.255.255
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  // 192.168.0.0 - 192.168.255.255
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  // 172.16.0.0 - 172.31.255.255
  const match172 = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const secondOctet = parseInt(match172[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  return false;
}

/**
 * Picks the network mode for this page:
 * - `VITE_NETWORK_MODE=online|lan` forces a mode (used for local testing).
 * - Public hostnames (e.g. GitHub Pages) use online mode via Supabase.
 * - Vite dev server (port 5173) talks to the LAN Node host on port 4173.
 * - Otherwise the page is served by the LAN Node host itself (same origin).
 */
export function resolveServerConfig(
  forcedMode: string | undefined = import.meta.env.VITE_NETWORK_MODE,
  location?: { protocol: string; hostname: string; port: string; origin: string }
): ServerConfig {
  const forced = (forcedMode || '').trim().toLowerCase();
  if (forced === 'online') return { url: null, mode: 'online' };

  // SSR / testing environment fallback
  if (typeof window === 'undefined' && !location) {
    return { url: 'http://localhost:4173', mode: 'lan' };
  }

  const loc = location || window.location;

  if (forced !== 'lan' && !isPrivateNetworkHost(loc.hostname)) {
    return { url: null, mode: 'online' };
  }

  if (loc.port === '5173') {
    return { url: `${loc.protocol}//${loc.hostname}:4173`, mode: 'dev' };
  }

  return { url: loc.origin, mode: 'lan' };
}

/**
 * Helper to retrieve the active LAN server URL string or fallback.
 */
export function getServerUrl(): string {
  return resolveServerConfig().url || 'http://localhost:4173';
}

/**
 * True when playing online (GitHub Pages + Supabase) rather than on a LAN host.
 */
export function isPublicHostingMode(): boolean {
  return resolveServerConfig().mode === 'online';
}

// Global socket singleton
let socketInstance: MonopolySocket | null = null;

export const useConnectionStore = create<ConnectionStoreState>((set) => ({
  status: 'idle',
  serverUrl: null,
  mode: 'lan',
  isPublicHosting: false,
  error: null,
  reconnectAttempts: 0,

  retryConnection: () => {
    const currentSocket = getSocket();
    set({ status: 'connecting', error: null, reconnectAttempts: 0 });
    if (!currentSocket.connected) {
      currentSocket.connect();
    }
  },
}));

/**
 * Initializes or returns the singleton socket (Socket.IO for LAN, Supabase-backed for online).
 */
export function getSocket(): MonopolySocket {
  if (socketInstance) {
    return socketInstance;
  }

  const config = resolveServerConfig();
  const isOnline = config.mode === 'online';

  useConnectionStore.setState({
    status: 'connecting',
    serverUrl: config.url,
    mode: config.mode,
    isPublicHosting: isOnline,
    error: null,
  });

  // Helper to retrieve saved token for handshake authentication
  const getStoredToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('monopoly_reconnect_token') || undefined;
    }
    return undefined;
  };

  socketInstance = isOnline
    ? (new OnlineSocket(true) as unknown as MonopolySocket)
    : (io(config.url || 'http://localhost:4173', {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        auth: (cb) => {
          cb({ token: getStoredToken() });
        },
      }) as MonopolySocket);

  const socket = socketInstance;

  socket.on('connect', () => {
    useConnectionStore.setState({ status: 'connected', error: null, reconnectAttempts: 0 });
  });

  socket.on('disconnect', () => {
    useConnectionStore.setState({ status: 'disconnected' });
  });

  socket.on('connect_error', (err: Error) => {
    const newAttempts = useConnectionStore.getState().reconnectAttempts + 1;
    useConnectionStore.setState({
      reconnectAttempts: newAttempts,
      status: newAttempts > 5 ? 'error' : 'connecting',
      error: isOnline
        ? err?.message || 'Connecting to the online game network…'
        : 'Connecting to local LAN server...',
    });
  });

  socket.io.on('reconnect_failed', () => {
    useConnectionStore.setState({
      status: 'error',
      error: 'Unable to reach the LAN game server. Make sure the host is running, then click Retry.',
    });
  });

  return socket;
}

/**
 * Resets socket singleton instance (used in automated unit testing).
 */
export function resetSocketForTesting(): void {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  pingListenersAttached = false;
  pingInFlight = false;
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }
  useConnectionStore.setState({
    status: 'idle',
    serverUrl: null,
    mode: 'lan',
    isPublicHosting: false,
    error: null,
    reconnectAttempts: 0,
  });
}

// ==========================================
// LIVE LATENCY (PING) MEASUREMENT
// ==========================================

export interface LatencyStoreState {
  /** Most recent measured round-trip time in ms (null until first sample). */
  latencyMs: number | null;
  /** Exponentially smoothed round-trip time in ms, used for the on-screen indicator. */
  smoothedMs: number | null;
  lastSampleAt: number | null;
  /** True when the last ping did not get an answer within the timeout. */
  isTimedOut: boolean;
}

export const useLatencyStore = create<LatencyStoreState>(() => ({
  latencyMs: null,
  smoothedMs: null,
  lastSampleAt: null,
  isTimedOut: false,
}));

const PING_INTERVAL_MS = 2000;
const PING_TIMEOUT_MS = 5000;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let pingInFlight = false;
let pingListenersAttached = false;

/** Sends one ping and records the round-trip time. Resolves with the RTT, or null on timeout. */
export function measureLatency(socket: MonopolySocket = getSocket()): Promise<number | null> {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve(null);
      return;
    }
    const sentAt = performance.now();
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      useLatencyStore.setState({ isTimedOut: true });
      resolve(null);
    }, PING_TIMEOUT_MS);

    socket.emit('ping', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const rtt = Math.round(performance.now() - sentAt);
      const prev = useLatencyStore.getState().smoothedMs;
      const smoothed = prev === null ? rtt : Math.round(prev * 0.6 + rtt * 0.4);
      useLatencyStore.setState({
        latencyMs: rtt,
        smoothedMs: smoothed,
        lastSampleAt: Date.now(),
        isTimedOut: false,
      });
      resolve(rtt);
    });
  });
}

/** Starts the periodic latency monitor (idempotent). Returns a stop function. */
export function startLatencyMonitor(): () => void {
  if (!pingTimer) {
    const socket = getSocket();
    const tick = () => {
      if (pingInFlight || !socket.connected) return;
      pingInFlight = true;
      void measureLatency(socket).finally(() => {
        pingInFlight = false;
      });
    };
    if (!pingListenersAttached) {
      pingListenersAttached = true;
      socket.on('connect', tick);
      socket.on('disconnect', () => {
        useLatencyStore.setState({ latencyMs: null, smoothedMs: null, isTimedOut: false });
      });
    }
    tick();
    pingTimer = setInterval(tick, PING_INTERVAL_MS);
  }
  return () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  };
}
