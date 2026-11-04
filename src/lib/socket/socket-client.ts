/**
 * Indian Monopoly - LAN Socket.IO Client Singleton
 * Connects to the authoritative LAN server using the current page origin.
 */

import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../../server/types/server-types';

function getServerUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:4173';

  // In Vite dev mode (port 5173), connect directly to the Node LAN backend on port 4173
  if (window.location.port === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:4173`;
  }

  // In production LAN mode, the server hosts both the React app and Socket.IO on the same origin
  return window.location.origin;
}

export type MonopolySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketInstance: MonopolySocket | null = null;

export function getSocket(): MonopolySocket {
  if (!socketInstance) {
    const serverUrl = getServerUrl();
    socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
  }
  return socketInstance;
}
