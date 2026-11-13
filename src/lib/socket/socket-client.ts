/**
 * Indian Monopoly - Production & LAN Socket.IO Client Architecture
 * 
 * Supports two distinct, strictly separated multiplayer operational modes:
 * 1. Existing LAN Mode: Connects to local Wi-Fi host IP/port without requiring internet access.
 * 2. Worldwide Public Hosted Mode: Connects to the Render Free backend via VITE_SERVER_URL.
 * 
 * Includes:
 * - Free-tier spin-up wake-up awareness (~1 minute notice)
 * - Bounded reconnection with exponential backoff (no socket flooding)
 * - Explicit configuration check preventing silent localhost fallback in deployed production builds
 * - Reactive Zustand connection store for rich UI feedback
 */

import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../../server/types/server-types';

export type MonopolySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'unconfigured';

export interface ServerConfig {
  url: string | null;
  mode: 'lan' | 'public' | 'dev';
  isConfigured: boolean;
  error: string | null;
}

export interface ConnectionStoreState {
  status: ConnectionStatus;
  serverUrl: string | null;
  mode: 'lan' | 'public' | 'dev';
  isPublicHosting: boolean;
  isWakingUp: boolean;
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
 * Resolves the server connection configuration based on environment variables and client location.
 * Enforces that public deployments (e.g. GitHub Pages) must have VITE_SERVER_URL configured,
 * preventing silent fallback to localhost.
 */
export function resolveServerConfig(
  envServerUrl = import.meta.env.VITE_SERVER_URL,
  location?: { protocol: string; hostname: string; port: string; origin: string }
): ServerConfig {
  const cleanEnvUrl = (envServerUrl || '').trim().replace(/\/+$/, '');

  // If VITE_SERVER_URL is explicitly provided, use it for public hosted mode
  if (cleanEnvUrl) {
    return {
      url: cleanEnvUrl,
      mode: 'public',
      isConfigured: true,
      error: null,
    };
  }

  // SSR / Testing environment fallback
  if (typeof window === 'undefined' && !location) {
    return {
      url: 'http://localhost:4173',
      mode: 'lan',
      isConfigured: true,
      error: null,
    };
  }

  const loc = location || (typeof window !== 'undefined' ? window.location : { protocol: 'http:', hostname: 'localhost', port: '4173', origin: 'http://localhost:4173' });

  // If running on a public hosting origin (e.g. GitHub Pages) without VITE_SERVER_URL
  const isPublicDomain = !isPrivateNetworkHost(loc.hostname);
  if (isPublicDomain) {
    return {
      url: null,
      mode: 'public',
      isConfigured: false,
      error:
        'Production backend URL (VITE_SERVER_URL) is not configured. Please set VITE_SERVER_URL in GitHub Repository Settings -> Secrets and variables -> Actions -> Variables.',
    };
  }

  // Vite local development server (port 5173 -> proxies/connects to Node LAN backend on port 4173)
  if (loc.port === '5173') {
    return {
      url: `${loc.protocol}//${loc.hostname}:4173`,
      mode: 'dev',
      isConfigured: true,
      error: null,
    };
  }

  // In production LAN mode, the Node server serves both frontend assets and Socket.IO on the same origin
  return {
      url: loc.origin,
      mode: 'lan',
      isConfigured: true,
      error: null,
  };
}

/**
 * Helper to retrieve the active server URL string or fallback.
 */
export function getServerUrl(): string {
  const config = resolveServerConfig();
  return config.url || 'http://localhost:4173';
}

/**
 * Helper to determine whether the client is configured for public hosted multiplayer.
 */
export function isPublicHostingMode(): boolean {
  const config = resolveServerConfig();
  return config.mode === 'public';
}

// Global Socket singleton and wakeup timer references
let socketInstance: MonopolySocket | null = null;
let wakeUpTimer: ReturnType<typeof setTimeout> | null = null;

export const useConnectionStore = create<ConnectionStoreState>((set) => ({
  status: 'idle',
  serverUrl: null,
  mode: 'lan',
  isPublicHosting: false,
  isWakingUp: false,
  error: null,
  reconnectAttempts: 0,

  retryConnection: () => {
    const currentSocket = getSocket();
    const config = resolveServerConfig();

    if (!config.isConfigured || !config.url) {
      set({
        status: 'unconfigured',
        error: config.error,
      });
      return;
    }

    set({
      status: 'connecting',
      isWakingUp: config.mode === 'public',
      error: null,
      reconnectAttempts: 0,
    });

    if (currentSocket && !currentSocket.connected) {
      currentSocket.connect();
    }
  },
}));

/**
 * Initializes or returns the singleton Socket.IO client instance.
 * Automatically wires connection lifecycle events and Render free wake-up notification.
 */
export function getSocket(): MonopolySocket {
  if (socketInstance) {
    return socketInstance;
  }

  const config = resolveServerConfig();

  // If deployed public build is missing backend URL, do not connect to localhost
  if (!config.isConfigured || !config.url) {
    useConnectionStore.setState({
      status: 'unconfigured',
      serverUrl: null,
      mode: config.mode,
      isPublicHosting: true,
      isWakingUp: false,
      error: config.error,
    });

    // Create a dummy disconnected socket instance to avoid null reference crashes
    socketInstance = io('http://127.0.0.1:0', {
      autoConnect: false,
    }) as MonopolySocket;

    return socketInstance;
  }

  useConnectionStore.setState({
    status: 'connecting',
    serverUrl: config.url,
    mode: config.mode,
    isPublicHosting: config.mode === 'public',
    isWakingUp: false,
    error: null,
  });

  // Start wake-up timer for Render Free Web Service spin-up notification (after 4 seconds)
  if (config.mode === 'public') {
    if (wakeUpTimer) clearTimeout(wakeUpTimer);
    wakeUpTimer = setTimeout(() => {
      const state = useConnectionStore.getState();
      if (state.status === 'connecting' || state.status === 'disconnected') {
        useConnectionStore.setState({ isWakingUp: true });
      }
    }, 4000);
  }

  // Helper to retrieve saved token for handshake authentication
  const getStoredToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('monopoly_reconnect_token') || undefined;
    }
    return undefined;
  };

  // Initialize Socket.IO client with bounded backoff and dual WebSocket/polling transports
  socketInstance = io(config.url, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 20, // Bounded backoff
    reconnectionDelay: 1500,
    reconnectionDelayMax: 8000,
    timeout: 20000, // 20s connection timeout accommodating cold starts
    auth: (cb) => {
      cb({ token: getStoredToken() });
    },
  }) as MonopolySocket;

  // Lifecycle listeners
  socketInstance.on('connect', () => {
    if (wakeUpTimer) clearTimeout(wakeUpTimer);
    useConnectionStore.setState({
      status: 'connected',
      isWakingUp: false,
      error: null,
      reconnectAttempts: 0,
    });
  });

  socketInstance.on('disconnect', (_reason) => {
    useConnectionStore.setState({
      status: 'disconnected',
      isWakingUp: false,
    });
  });

  socketInstance.on('connect_error', (_err) => {
    const prevAttempts = useConnectionStore.getState().reconnectAttempts;
    const newAttempts = prevAttempts + 1;
    const isPublic = useConnectionStore.getState().isPublicHosting;

    useConnectionStore.setState({
      reconnectAttempts: newAttempts,
      isWakingUp: isPublic,
      status: newAttempts > 3 ? 'error' : 'connecting',
      error: isPublic
        ? 'Connecting to multiplayer backend. Render Free service may take ~1 minute to wake up...'
        : 'Connecting to local LAN server...',
    });
  });

  socketInstance.io.on('reconnect_failed', () => {
    if (wakeUpTimer) clearTimeout(wakeUpTimer);
    useConnectionStore.setState({
      status: 'error',
      isWakingUp: false,
      error: 'Unable to reach the game server. It may be offline or sleeping. Click Retry to reconnect.',
    });
  });

  return socketInstance;
}

/**
 * Resets socket singleton instance (used in automated unit testing).
 */
export function resetSocketForTesting(): void {
  if (wakeUpTimer) {
    clearTimeout(wakeUpTimer);
    wakeUpTimer = null;
  }
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
    isWakingUp: false,
    error: null,
    reconnectAttempts: 0,
  });
}
