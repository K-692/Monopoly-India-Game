/**
 * Indian Monopoly - Session & Rate Limiting Middleware
 * Protects LAN server against code brute-forcing, invalid session spoofing,
 * and malformed Socket.IO payloads.
 */

import { Socket } from 'socket.io';
import { RoomManager } from '../rooms/room-manager';
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from '../types/server-types';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const joinRateLimits = new Map<string, RateLimitRecord>();
const MAX_JOIN_ATTEMPTS_PER_MINUTE = 20;

/**
 * Checks if a client IP has exceeded the allowed join attempt rate.
 */
export function checkJoinRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = joinRateLimits.get(ip);

  if (!record || now > record.resetAt) {
    joinRateLimits.set(ip, {
      count: 1,
      resetAt: now + 60 * 1000,
    });
    return true;
  }

  if (record.count >= MAX_JOIN_ATTEMPTS_PER_MINUTE) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Validates that an incoming socket event has a registered and authenticated player session.
 */
export function requireSession(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  roomManager: RoomManager
): boolean {
  const session = socket.data.session;
  if (!session) {
    socket.emit('server:error', {
      code: 'UNAUTHENTICATED',
      message: 'You must establish a player session before performing this action.',
    });
    return false;
  }

  // Double check that session is still active in roomManager
  const activeSession = roomManager.getSessionByUid(session.uid);
  if (!activeSession) {
    socket.emit('server:error', {
      code: 'INVALID_SESSION',
      message: 'Player session expired or not found. Please refresh.',
    });
    return false;
  }

  return true;
}
