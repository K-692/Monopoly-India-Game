/**
 * LAN Server Types & Socket.IO Contract Definitions
 * Provides strictly typed communication events between host server and connected clients.
 */

import { GameCommand, GameEvent, GameState, RoomState } from '../../src/domain/game-types';
import { HostCustomRules } from '../../src/domain/ruleset';

export interface PlayerSession {
  uid: string;
  token: string;
  displayName: string;
  avatarColor: string;
  socketId: string | null;
  roomId: string | null;
  connected: boolean;
  lastSeenAt: number;
  ipAddress?: string;
}

export interface PlayerSessionPublic {
  uid: string;
  token: string;
  displayName: string;
  avatarColor: string;
}

export interface ServerRoom extends RoomState {
  expiresAt: number;
}

export interface LanAddressInfo {
  address: string;
  family: string;
  interfaceName: string;
  isPrivate: boolean;
}

export interface LanServerInfo {
  status: 'RUNNING';
  port: number;
  primaryLanAddress: string | null;
  lanAddresses: string[];
  localUrl: string;
  lanUrls: string[];
}

export interface PlayerAuthResponse {
  ok: boolean;
  player?: PlayerSessionPublic;
  error?: string;
}

export interface RoomCreateResponse {
  ok: boolean;
  roomId?: string;
  inviteCode?: string;
  room?: RoomState;
  error?: string;
}

export interface RoomJoinResponse {
  ok: boolean;
  roomId?: string;
  room?: RoomState;
  error?: string;
}

export interface GameStartResponse {
  ok: boolean;
  gameId?: string;
  error?: string;
}

export interface GameCommandResponse {
  ok: boolean;
  error?: string;
}

/**
 * Socket.IO Typed Events
 */
export interface ClientToServerEvents {
  'player:register': (
    data: { displayName: string; avatarColor?: string; token?: string },
    callback: (res: PlayerAuthResponse) => void
  ) => void;

  'player:resume': (
    data: { token: string; displayName?: string },
    callback: (res: PlayerAuthResponse) => void
  ) => void;

  'room:create': (
    data: { customRules?: HostCustomRules },
    callback: (res: RoomCreateResponse) => void
  ) => void;

  'room:join': (
    data: { inviteCode: string },
    callback: (res: RoomJoinResponse) => void
  ) => void;

  'room:leave': (
    callback?: (res: { ok: boolean }) => void
  ) => void;

  'room:set-ready': (
    data: { isReady: boolean },
    callback?: (res: { ok: boolean; error?: string }) => void
  ) => void;

  'room:start': (
    callback?: (res: GameStartResponse) => void
  ) => void;

  'game:command': (
    data: GameCommand,
    callback?: (res: GameCommandResponse) => void
  ) => void;

  'game:join': (
    data: { gameId: string },
    callback?: (res: { ok: boolean; gameState?: GameState; room?: RoomState; error?: string }) => void
  ) => void;

  'reaction:send': (
    data: { emote: string }
  ) => void;

  'ping': (
    callback: () => void
  ) => void;
}

export interface ServerToClientEvents {
  'player:registered': (data: PlayerSessionPublic) => void;
  'player:resumed': (data: PlayerSessionPublic) => void;
  'room:created': (room: RoomState) => void;
  'room:joined': (room: RoomState) => void;
  'room:state': (room: RoomState) => void;
  'game:started': (data: { gameId: string; gameState: GameState }) => void;
  'game:state': (gameState: GameState) => void;
  'game:event': (event: GameEvent) => void;
  'game:timer': (data: { remaining: number; activeUid: string }) => void;
  'reaction:received': (reaction: {
    id: string;
    roomId: string;
    senderUid: string;
    senderName: string;
    emote: string;
    timestamp: number;
  }) => void;
  'server:error': (data: { code: string; message: string }) => void;
  'player:presence': (data: { uid: string; connected: boolean }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  session?: PlayerSession;
}
