/**
 * Indian Monopoly - Persistence Layer Types
 * Defines interfaces for durable multi-tenant storage across
 * PostgreSQL (production) and In-Memory (LAN / automated testing).
 */

import { EngineResult } from '../../src/domain/game-engine/engine';
import { GameArchive, GameEvent, GameState, RoomMember } from '../../src/domain/game-types';
import { PlayerSession, ServerRoom } from '../types/server-types';

export interface CommandCommitParams {
  gameId: string;
  commandId: string;
  actorUid: string;
  result: EngineResult;
  nextState: GameState;
}

export interface PersistenceStore {
  /**
   * Initializes database connections, connection pools, and verifies schema migrations.
   */
  init(): Promise<void>;

  /**
   * Gracefully drains connections on server shutdown.
   */
  close(): Promise<void>;

  /**
   * Health and readiness probe checking database availability and migration status.
   */
  isHealthy(): Promise<{ ok: boolean; error?: string }>;

  // ==========================================
  // PLAYER SESSIONS
  // ==========================================
  saveSession(session: PlayerSession): Promise<void>;
  getSessionByUid(uid: string): Promise<PlayerSession | null>;
  getSessionByTokenHash(tokenHash: string): Promise<PlayerSession | null>;
  getSessionBySocketId(socketId: string): Promise<PlayerSession | null>;
  deleteSession(uid: string): Promise<void>;

  // ==========================================
  // ROOMS & ROOM MEMBERS
  // ==========================================
  createRoom(room: ServerRoom): Promise<void>;
  updateRoom(room: ServerRoom): Promise<void>;
  getRoom(roomId: string): Promise<ServerRoom | null>;
  getRoomByInviteCode(inviteCode: string): Promise<ServerRoom | null>;
  deleteRoom(roomId: string): Promise<void>;
  cleanupExpiredRooms(maxAgeMs?: number): Promise<number>;
  listActiveRooms(): Promise<ServerRoom[]>;

  saveRoomMember(roomId: string, member: RoomMember): Promise<void>;
  removeRoomMember(roomId: string, uid: string): Promise<void>;

  // ==========================================
  // GAMES
  // ==========================================
  /**
   * Atomically creates a new game session for a room in LOBBY state.
   * Enforces that a room can have AT MOST ONE active game session.
   */
  createGame(game: GameState): Promise<{ ok: boolean; game?: GameState; error?: string }>;
  updateGame(game: GameState): Promise<void>;
  getGame(gameId: string): Promise<GameState | null>;
  getActiveGameForRoom(roomId: string): Promise<GameState | null>;
  listActiveGames(): Promise<GameState[]>;
  /** Permanently removes a game with its events, processed commands and archive. */
  deleteGame(gameId: string): Promise<void>;

  // ==========================================
  // ATOMIC COMMAND COMMIT & EVENTS
  // ==========================================
  /**
   * Atomically persists the updated game state, event, and processed command record.
   * If commandId has already been processed for this game, returns the cached result.
   */
  commitCommandExecution(params: CommandCommitParams): Promise<{
    ok: boolean;
    alreadyProcessed?: boolean;
    result: EngineResult;
    durationMs?: number;
  }>;
  getProcessedCommand(gameId: string, commandId: string): Promise<EngineResult | null>;
  getGameEvents(gameId: string, fromSequence?: number): Promise<GameEvent[]>;

  // ==========================================
  // ARCHIVES
  // ==========================================
  saveArchive(archive: GameArchive): Promise<void>;
  getArchive(gameId: string): Promise<GameArchive | null>;
}
