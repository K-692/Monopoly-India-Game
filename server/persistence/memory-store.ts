/**
 * Indian Monopoly - In-Memory Persistence Store
 * Provides fast, non-volatile within process, zero-dependency storage
 * for local Wi-Fi LAN multiplayer hosting and automated testing.
 */

import { EngineResult } from '../../src/domain/game-engine/engine';
import { GameArchive, GameEvent, GameState, RoomMember } from '../../src/domain/game-types';
import { PlayerSession, ServerRoom } from '../types/server-types';
import { CommandCommitParams, PersistenceStore } from './types';

export class MemoryStore implements PersistenceStore {
  private sessionsByUid: Map<string, PlayerSession> = new Map();
  private sessionsByTokenHash: Map<string, PlayerSession> = new Map();
  private sessionsBySocketId: Map<string, PlayerSession> = new Map();

  private rooms: Map<string, ServerRoom> = new Map();
  private roomsByCode: Map<string, string> = new Map(); // inviteCode -> roomId

  private games: Map<string, GameState> = new Map();
  private activeGameByRoomId: Map<string, string> = new Map(); // roomId -> active gameId

  private processedCommands: Map<string, { result: EngineResult; timestamp: number }> = new Map(); // `${gameId}:${commandId}` -> record
  private gameEvents: Map<string, GameEvent[]> = new Map(); // gameId -> events

  private archives: Map<string, GameArchive> = new Map();

  public async init(): Promise<void> {
    // In-memory initialization is immediate
  }

  public async close(): Promise<void> {
    // Clear in-memory maps
    this.sessionsByUid.clear();
    this.sessionsByTokenHash.clear();
    this.sessionsBySocketId.clear();
    this.rooms.clear();
    this.roomsByCode.clear();
    this.games.clear();
    this.activeGameByRoomId.clear();
    this.processedCommands.clear();
    this.gameEvents.clear();
    this.archives.clear();
  }

  public async isHealthy(): Promise<{ ok: boolean; error?: string }> {
    return { ok: true };
  }

  // ==========================================
  // PLAYER SESSIONS
  // ==========================================
  public async saveSession(session: PlayerSession): Promise<void> {
    this.sessionsByUid.set(session.uid, { ...session });
    if (session.tokenHash) {
      this.sessionsByTokenHash.set(session.tokenHash, { ...session });
    }
    if (session.socketId) {
      this.sessionsBySocketId.set(session.socketId, { ...session });
    }
  }

  public async getSessionByUid(uid: string): Promise<PlayerSession | null> {
    const s = this.sessionsByUid.get(uid);
    return s ? { ...s } : null;
  }

  public async getSessionByTokenHash(tokenHash: string): Promise<PlayerSession | null> {
    const s = this.sessionsByTokenHash.get(tokenHash);
    return s ? { ...s } : null;
  }

  public async getSessionBySocketId(socketId: string): Promise<PlayerSession | null> {
    const s = this.sessionsBySocketId.get(socketId);
    return s ? { ...s } : null;
  }

  public async deleteSession(uid: string): Promise<void> {
    const session = this.sessionsByUid.get(uid);
    if (session) {
      this.sessionsByUid.delete(uid);
      if (session.tokenHash) this.sessionsByTokenHash.delete(session.tokenHash);
      if (session.socketId) this.sessionsBySocketId.delete(session.socketId);
    }
  }

  // ==========================================
  // ROOMS & ROOM MEMBERS
  // ==========================================
  public async createRoom(room: ServerRoom): Promise<void> {
    this.rooms.set(room.roomId, { ...room, members: { ...room.members } });
    this.roomsByCode.set(room.inviteCode.toUpperCase(), room.roomId);
  }

  public async updateRoom(room: ServerRoom): Promise<void> {
    this.rooms.set(room.roomId, { ...room, members: { ...room.members } });
    this.roomsByCode.set(room.inviteCode.toUpperCase(), room.roomId);
  }

  public async getRoom(roomId: string): Promise<ServerRoom | null> {
    const r = this.rooms.get(roomId);
    return r ? { ...r, members: { ...r.members } } : null;
  }

  public async getRoomByInviteCode(inviteCode: string): Promise<ServerRoom | null> {
    const roomId = this.roomsByCode.get(inviteCode.trim().toUpperCase());
    if (!roomId) return null;
    return this.getRoom(roomId);
  }

  public async deleteRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) {
      this.roomsByCode.delete(room.inviteCode.toUpperCase());
      this.rooms.delete(roomId);
    }
  }

  public async cleanupExpiredRooms(_maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    for (const [roomId, room] of this.rooms.entries()) {
      const isExpired = now > room.expiresAt;
      const isAbandoned = Object.keys(room.members).length === 0 && now - room.updatedAt > 30 * 60 * 1000;
      if (isExpired || isAbandoned) {
        this.roomsByCode.delete(room.inviteCode.toUpperCase());
        this.rooms.delete(roomId);
        cleaned++;
      }
    }
    return cleaned;
  }

  public async listActiveRooms(): Promise<ServerRoom[]> {
    return Array.from(this.rooms.values()).map((r) => ({ ...r, members: { ...r.members } }));
  }

  public async saveRoomMember(roomId: string, member: RoomMember): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.members[member.uid] = { ...member };
    room.memberUids = Object.keys(room.members);
    room.updatedAt = Date.now();
  }

  public async removeRoomMember(roomId: string, uid: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;
    delete room.members[uid];
    room.memberUids = Object.keys(room.members);
    room.updatedAt = Date.now();
  }

  // ==========================================
  // GAMES
  // ==========================================
  public async createGame(game: GameState): Promise<{ ok: boolean; game?: GameState; error?: string }> {
    // Invariant: At most one active game per room
    const existingActiveId = this.activeGameByRoomId.get(game.roomId);
    if (existingActiveId) {
      const existing = this.games.get(existingActiveId);
      if (existing && existing.status !== 'COMPLETED') {
        return {
          ok: true,
          game: existing,
        };
      }
    }

    this.games.set(game.gameId, { ...game });
    this.activeGameByRoomId.set(game.roomId, game.gameId);

    // Also update room's gameId & status
    const room = this.rooms.get(game.roomId);
    if (room) {
      room.gameId = game.gameId;
      room.status = 'IN_PROGRESS';
      room.updatedAt = Date.now();
    }

    return { ok: true, game };
  }

  public async updateGame(game: GameState): Promise<void> {
    this.games.set(game.gameId, { ...game });
    if (game.status === 'COMPLETED') {
      const currentActive = this.activeGameByRoomId.get(game.roomId);
      if (currentActive === game.gameId) {
        this.activeGameByRoomId.delete(game.roomId);
      }
    }
  }

  public async getGame(gameId: string): Promise<GameState | null> {
    const g = this.games.get(gameId);
    return g ? { ...g } : null;
  }

  public async getActiveGameForRoom(roomId: string): Promise<GameState | null> {
    const activeGameId = this.activeGameByRoomId.get(roomId);
    if (!activeGameId) return null;
    return this.getGame(activeGameId);
  }

  public async listActiveGames(): Promise<GameState[]> {
    return Array.from(this.games.values())
      .filter((g) => g.status === 'IN_PROGRESS' || g.status === 'ACTION_REQUIRED')
      .map((g) => ({ ...g }));
  }

  // ==========================================
  // ATOMIC COMMAND COMMIT & EVENTS
  // ==========================================
  public async commitCommandExecution(params: CommandCommitParams): Promise<{
    ok: boolean;
    alreadyProcessed?: boolean;
    result: EngineResult;
  }> {
    // 0. Verify parent game exists
    if (!this.games.has(params.gameId)) {
      throw new Error(
        `GAME_SESSION_NOT_PERSISTED: Cannot execute a command because the game session "${params.gameId}" has not been committed to memory store.`
      );
    }

    const dedupeKey = `${params.gameId}:${params.commandId}`;

    // Deduplication check
    if (this.processedCommands.has(dedupeKey)) {
      const cached = this.processedCommands.get(dedupeKey)!;
      return {
        ok: true,
        alreadyProcessed: true,
        result: cached.result,
      };
    }

    // Persist processed command
    this.processedCommands.set(dedupeKey, {
      result: params.result,
      timestamp: Date.now(),
    });

    // Append event
    const events = this.gameEvents.get(params.gameId) || [];
    events.push(params.result.event);
    this.gameEvents.set(params.gameId, events);

    // Update game state
    await this.updateGame(params.nextState);

    return {
      ok: true,
      alreadyProcessed: false,
      result: params.result,
    };
  }

  public async getProcessedCommand(gameId: string, commandId: string): Promise<EngineResult | null> {
    const cached = this.processedCommands.get(`${gameId}:${commandId}`);
    return cached ? cached.result : null;
  }

  public async getGameEvents(gameId: string, fromSequence = 0): Promise<GameEvent[]> {
    const events = this.gameEvents.get(gameId) || [];
    return events.filter((e) => e.sequence >= fromSequence);
  }

  // ==========================================
  // ARCHIVES
  // ==========================================
  public async saveArchive(archive: GameArchive): Promise<void> {
    this.archives.set(archive.gameId, { ...archive });
  }

  public async getArchive(gameId: string): Promise<GameArchive | null> {
    const a = this.archives.get(gameId);
    return a ? { ...a } : null;
  }
}
