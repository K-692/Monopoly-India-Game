/**
 * Indian Monopoly - PostgreSQL Production Persistence Store
 * Provides ACID transactions, durable row-level locking, version constraints,
 * and reliable crash recovery for Render hosted deployments.
 */

import { Pool, PoolConfig } from 'pg';
import { EngineResult } from '../../src/domain/game-engine/engine';
import { GameArchive, GameEvent, GameState, RoomMember } from '../../src/domain/game-types';
import { PlayerSession, ServerRoom } from '../types/server-types';
import { runMigrations } from './migrator';
import { CommandCommitParams, PersistenceStore } from './types';

export class PostgresStore implements PersistenceStore {
  private pool: Pool;
  private isInitialized = false;
  private keepWarmTimer: NodeJS.Timeout | null = null;

  constructor(connectionStringOrConfig?: string | PoolConfig) {
    const config: PoolConfig =
      typeof connectionStringOrConfig === 'string'
        ? { connectionString: connectionStringOrConfig }
        : connectionStringOrConfig || {
            connectionString: process.env.DATABASE_URL,
          };

    // Supabase / Render PostgreSQL requires SSL in production or when connecting to remote cloud host
    const isProduction = process.env.NODE_ENV === 'production';
    const isCloudHost =
      typeof config.connectionString === 'string' &&
      (config.connectionString.includes('supabase') ||
        config.connectionString.includes('render') ||
        config.connectionString.includes('pooler') ||
        config.connectionString.includes('amazonaws.com'));

    if ((isProduction || isCloudHost) && config.connectionString) {
      // Strip sslmode parameter so pg-connection-string doesn't overwrite rejectUnauthorized with true
      try {
        const u = new URL(config.connectionString);
        u.searchParams.delete('sslmode');
        config.connectionString = u.toString();
      } catch {
        config.connectionString = config.connectionString
          .replace(/([?&])sslmode=[^&]+(&|$)/, '$1')
          .replace(/[?&]$/, '');
      }
      config.ssl = { rejectUnauthorized: false };
    }

    // Conservative connection pool sizing suitable for Supabase Free plan and single Render Web Service
    config.max = config.max || 10;
    // Keep connections alive for a long time: opening a new TLS connection to a remote region
    // costs several network round-trips, which previously landed on players' clicks.
    config.idleTimeoutMillis = 10 * 60 * 1000;
    config.keepAlive = true;
    config.keepAliveInitialDelayMillis = 10000;
    config.connectionTimeoutMillis = 8000;
    config.statement_timeout = 8000;
    config.query_timeout = 8000;

    this.pool = new Pool(config);

    // Ensure search_path defaults to game schema, then public on every acquired client
    this.pool.on('connect', (client) => {
      client.query('SET search_path TO game, public').catch((err) => {
        console.warn('[PostgresStore] Warning: Failed to set search_path on connection checkout:', err);
      });
    });

    this.pool.on('error', (err) => {
      console.error('[PostgresStore] Unexpected error on idle database client:', err);
    });
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    console.log('[PostgresStore] Connecting to PostgreSQL and executing migrations...');
    await runMigrations(this.pool);
    this.isInitialized = true;
    await this.warmPool();
    // Periodically touch the pool so idle connections are never torn down between turns
    this.keepWarmTimer = setInterval(() => {
      this.pool.query('SELECT 1').catch(() => {});
    }, 60 * 1000);
    this.keepWarmTimer.unref?.();
    console.log('[PostgresStore] PostgreSQL connection pool and migrations ready.');
  }

  /**
   * Pre-opens a couple of connections so the first game commands do not pay TLS setup cost.
   */
  private async warmPool(): Promise<void> {
    try {
      const clients = await Promise.all([this.pool.connect(), this.pool.connect()]);
      clients.forEach((c) => c.release());
    } catch (err) {
      console.warn('[PostgresStore] Pool warm-up failed (non-fatal):', err);
    }
  }

  public async close(): Promise<void> {
    if (this.keepWarmTimer) {
      clearInterval(this.keepWarmTimer);
      this.keepWarmTimer = null;
    }
    await this.pool.end();
    this.isInitialized = false;
  }

  public async isHealthy(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await this.pool.query('SELECT 1 as health');
      return { ok: res.rows.length > 0 };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ==========================================
  // PLAYER SESSIONS
  // ==========================================
  public async saveSession(session: PlayerSession): Promise<void> {
    const now = Date.now();
    const expiresAt = session.expiresAt || (now + 30 * 24 * 60 * 60 * 1000);
    await this.pool.query(
      `
      INSERT INTO game.player_sessions (
        uid, token_hash, display_name, avatar_color, socket_id, room_id,
        connected, last_seen_at, ip_address, session_generation, created_at, updated_at,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (uid) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        avatar_color = EXCLUDED.avatar_color,
        socket_id = EXCLUDED.socket_id,
        room_id = EXCLUDED.room_id,
        connected = EXCLUDED.connected,
        last_seen_at = EXCLUDED.last_seen_at,
        ip_address = EXCLUDED.ip_address,
        session_generation = EXCLUDED.session_generation,
        updated_at = EXCLUDED.updated_at,
        expires_at = EXCLUDED.expires_at
      `,
      [
        session.uid,
        session.tokenHash || session.token,
        session.displayName,
        session.avatarColor,
        session.socketId,
        session.roomId,
        session.connected,
        session.lastSeenAt || now,
        session.ipAddress || null,
        session.sessionGeneration || 1,
        now,
        now,
        expiresAt,
      ]
    );
  }

  public async getSessionByUid(uid: string): Promise<PlayerSession | null> {
    const res = await this.pool.query(
      `SELECT uid, token_hash, display_name, avatar_color, socket_id, room_id, connected, last_seen_at, ip_address, session_generation, expires_at
       FROM game.player_sessions WHERE uid = $1`,
      [uid]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      uid: r.uid,
      token: r.token_hash,
      tokenHash: r.token_hash,
      displayName: r.display_name,
      avatarColor: r.avatar_color,
      socketId: r.socket_id,
      roomId: r.room_id,
      connected: r.connected,
      lastSeenAt: Number(r.last_seen_at),
      ipAddress: r.ip_address,
      sessionGeneration: r.session_generation,
      expiresAt: Number(r.expires_at),
    };
  }

  public async getSessionByTokenHash(tokenHash: string): Promise<PlayerSession | null> {
    const res = await this.pool.query(
      `SELECT uid, token_hash, display_name, avatar_color, socket_id, room_id, connected, last_seen_at, ip_address, session_generation, expires_at
       FROM game.player_sessions WHERE token_hash = $1`,
      [tokenHash]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      uid: r.uid,
      token: r.token_hash,
      tokenHash: r.token_hash,
      displayName: r.display_name,
      avatarColor: r.avatar_color,
      socketId: r.socket_id,
      roomId: r.room_id,
      connected: r.connected,
      lastSeenAt: Number(r.last_seen_at),
      ipAddress: r.ip_address,
      sessionGeneration: r.session_generation,
      expiresAt: Number(r.expires_at),
    };
  }

  public async getSessionBySocketId(socketId: string): Promise<PlayerSession | null> {
    const res = await this.pool.query(
      `SELECT uid, token_hash, display_name, avatar_color, socket_id, room_id, connected, last_seen_at, ip_address, session_generation, expires_at
       FROM game.player_sessions WHERE socket_id = $1`,
      [socketId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      uid: r.uid,
      token: r.token_hash,
      tokenHash: r.token_hash,
      displayName: r.display_name,
      avatarColor: r.avatar_color,
      socketId: r.socket_id,
      roomId: r.room_id,
      connected: r.connected,
      lastSeenAt: Number(r.last_seen_at),
      ipAddress: r.ip_address,
      sessionGeneration: r.session_generation,
      expiresAt: Number(r.expires_at),
    };
  }

  public async deleteSession(uid: string): Promise<void> {
    await this.pool.query('DELETE FROM game.player_sessions WHERE uid = $1', [uid]);
  }

  // ==========================================
  // ROOMS & ROOM MEMBERS
  // ==========================================
  public async createRoom(room: ServerRoom): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        INSERT INTO game.rooms (
          room_id, invite_code, invite_code_hash, host_uid, status,
          max_players, turn_timer_seconds, game_mode, custom_rules,
          cpu_players, game_id, next_join_sequence, created_at, updated_at, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `,
        [
          room.roomId,
          room.inviteCode.toUpperCase(),
          room.inviteCodeHash,
          room.hostUid,
          room.status,
          room.maxPlayers,
          room.turnTimerSeconds,
          room.gameMode,
          JSON.stringify(room.customRules || {}),
          room.cpuPlayers ? JSON.stringify(room.cpuPlayers) : null,
          room.gameId || null,
          room.nextJoinSequence || 2,
          room.createdAt,
          room.updatedAt,
          room.expiresAt,
        ]
      );

      for (const member of Object.values(room.members)) {
        await client.query(
          `
          INSERT INTO game.room_members (
            room_id, uid, display_name, photo_url, is_ready, joined_at,
            color_token, is_cpu, player_type, room_join_sequence, last_activity_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (room_id, uid) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            photo_url = EXCLUDED.photo_url,
            is_ready = EXCLUDED.is_ready,
            color_token = EXCLUDED.color_token,
            is_cpu = EXCLUDED.is_cpu,
            player_type = EXCLUDED.player_type,
            room_join_sequence = EXCLUDED.room_join_sequence,
            last_activity_at = EXCLUDED.last_activity_at
          `,
          [
            room.roomId,
            member.uid,
            member.displayName,
            member.photoURL || null,
            member.isReady,
            member.joinedAt,
            member.colorToken,
            Boolean(member.isCpu),
            member.playerType || (member.isCpu ? 'COMPUTER' : 'HUMAN'),
            member.roomJoinSequence || 1,
            member.lastActivityAt || member.joinedAt || Date.now(),
          ]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async updateRoom(room: ServerRoom): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        UPDATE game.rooms SET
          status = $2,
          host_uid = $3,
          max_players = $4,
          turn_timer_seconds = $5,
          game_mode = $6,
          custom_rules = $7,
          cpu_players = $8,
          game_id = $9,
          next_join_sequence = $10,
          updated_at = $11,
          expires_at = $12
        WHERE room_id = $1
        `,
        [
          room.roomId,
          room.status,
          room.hostUid,
          room.maxPlayers,
          room.turnTimerSeconds,
          room.gameMode,
          JSON.stringify(room.customRules || {}),
          room.cpuPlayers ? JSON.stringify(room.cpuPlayers) : null,
          room.gameId || null,
          room.nextJoinSequence || 2,
          Date.now(),
          room.expiresAt,
        ]
      );

      // Upsert members
      const memberUids = Object.keys(room.members);
      if (memberUids.length > 0) {
        // Remove members that are no longer in the room
        await client.query(
          `DELETE FROM game.room_members WHERE room_id = $1 AND uid != ALL($2)`,
          [room.roomId, memberUids]
        );

        for (const member of Object.values(room.members)) {
          await client.query(
            `
            INSERT INTO game.room_members (
              room_id, uid, display_name, photo_url, is_ready, joined_at,
              color_token, is_cpu, player_type, room_join_sequence, last_activity_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (room_id, uid) DO UPDATE SET
              display_name = EXCLUDED.display_name,
              photo_url = EXCLUDED.photo_url,
              is_ready = EXCLUDED.is_ready,
              color_token = EXCLUDED.color_token,
              is_cpu = EXCLUDED.is_cpu,
              player_type = EXCLUDED.player_type,
              room_join_sequence = EXCLUDED.room_join_sequence,
              last_activity_at = EXCLUDED.last_activity_at
            `,
            [
              room.roomId,
              member.uid,
              member.displayName,
              member.photoURL || null,
              member.isReady,
              member.joinedAt,
              member.colorToken,
              Boolean(member.isCpu),
              member.playerType || (member.isCpu ? 'COMPUTER' : 'HUMAN'),
              member.roomJoinSequence || 1,
              member.lastActivityAt || member.joinedAt || Date.now(),
            ]
          );
        }
      } else {
        await client.query('DELETE FROM game.room_members WHERE room_id = $1', [room.roomId]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async getRoom(roomId: string): Promise<ServerRoom | null> {
    const roomRes = await this.pool.query('SELECT * FROM game.rooms WHERE room_id = $1', [roomId]);
    if (roomRes.rows.length === 0) return null;
    const r = roomRes.rows[0];

    const memberRes = await this.pool.query('SELECT * FROM game.room_members WHERE room_id = $1 ORDER BY room_join_sequence ASC', [roomId]);
    const members: Record<string, RoomMember> = {};
    const memberUids: string[] = [];

    for (const m of memberRes.rows) {
      members[m.uid] = {
        uid: m.uid,
        displayName: m.display_name,
        photoURL: m.photo_url,
        isReady: m.is_ready,
        joinedAt: Number(m.joined_at),
        colorToken: m.color_token,
        isCpu: m.is_cpu,
        playerType: m.player_type,
        roomJoinSequence: m.room_join_sequence,
        lastActivityAt: Number(m.last_activity_at || m.joined_at),
      };
      memberUids.push(m.uid);
    }

    return {
      roomId: r.room_id,
      inviteCode: r.invite_code,
      inviteCodeHash: r.invite_code_hash,
      hostUid: r.host_uid,
      status: r.status,
      maxPlayers: r.max_players,
      turnTimerSeconds: r.turn_timer_seconds,
      gameMode: r.game_mode,
      customRules: r.custom_rules,
      cpuPlayers: r.cpu_players || undefined,
      gameId: r.game_id || undefined,
      members,
      memberUids,
      nextJoinSequence: r.next_join_sequence,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
      expiresAt: Number(r.expires_at),
    };
  }

  public async getRoomByInviteCode(inviteCode: string): Promise<ServerRoom | null> {
    const res = await this.pool.query('SELECT room_id FROM game.rooms WHERE invite_code = $1', [inviteCode.trim().toUpperCase()]);
    if (res.rows.length === 0) return null;
    return this.getRoom(res.rows[0].room_id);
  }

  public async deleteRoom(roomId: string): Promise<void> {
    await this.pool.query('DELETE FROM game.rooms WHERE room_id = $1', [roomId]);
  }

  public async cleanupExpiredRooms(_maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    const res = await this.pool.query(
      `DELETE FROM game.rooms WHERE expires_at < $1 OR (room_id NOT IN (SELECT room_id FROM game.room_members) AND $1 - updated_at > 1800000)`,
      [now]
    );
    return res.rowCount || 0;
  }

  public async listActiveRooms(): Promise<ServerRoom[]> {
    const res = await this.pool.query(`SELECT room_id FROM game.rooms WHERE status IN ('LOBBY', 'IN_PROGRESS') ORDER BY updated_at DESC`);
    const rooms: ServerRoom[] = [];
    for (const row of res.rows) {
      const room = await this.getRoom(row.room_id);
      if (room) rooms.push(room);
    }
    return rooms;
  }

  public async saveRoomMember(roomId: string, member: RoomMember): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO game.room_members (
        room_id, uid, display_name, photo_url, is_ready, joined_at,
        color_token, is_cpu, player_type, room_join_sequence, last_activity_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (room_id, uid) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        photo_url = EXCLUDED.photo_url,
        is_ready = EXCLUDED.is_ready,
        color_token = EXCLUDED.color_token,
        is_cpu = EXCLUDED.is_cpu,
        player_type = EXCLUDED.player_type,
        room_join_sequence = EXCLUDED.room_join_sequence,
        last_activity_at = EXCLUDED.last_activity_at
      `,
      [
        roomId,
        member.uid,
        member.displayName,
        member.photoURL || null,
        member.isReady,
        member.joinedAt,
        member.colorToken,
        Boolean(member.isCpu),
        member.playerType || (member.isCpu ? 'COMPUTER' : 'HUMAN'),
        member.roomJoinSequence || 1,
        member.lastActivityAt || member.joinedAt || Date.now(),
      ]
    );
  }

  public async removeRoomMember(roomId: string, uid: string): Promise<void> {
    await this.pool.query('DELETE FROM game.room_members WHERE room_id = $1 AND uid = $2', [roomId, uid]);
  }

  // ==========================================
  // GAMES
  // ==========================================
  public async createGame(game: GameState): Promise<{ ok: boolean; game?: GameState; error?: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Lock room to guarantee strict serial transition from LOBBY to IN_PROGRESS
      const roomLock = await client.query<{ status: string; game_id: string | null }>(
        'SELECT status, game_id FROM game.rooms WHERE room_id = $1 FOR UPDATE',
        [game.roomId]
      );

      if (roomLock.rows.length === 0) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Room does not exist' };
      }

      const room = roomLock.rows[0];

      // If room is already IN_PROGRESS or has an active game, return the existing game
      if (room.status === 'IN_PROGRESS' && room.game_id) {
        const existingGameRes = await client.query('SELECT state FROM game.games WHERE game_id = $1', [room.game_id]);
        await client.query('ROLLBACK');
        if (existingGameRes.rows.length > 0) {
          return { ok: true, game: existingGameRes.rows[0].state as GameState };
        }
      }

      if (room.status === 'COMPLETED' || room.status === 'ARCHIVED') {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Cannot start game: room has already concluded.' };
      }

      // 2. Insert new game record
      await client.query(
        `
        INSERT INTO game.games (
          game_id, room_id, status, current_player_uid, turn_number,
          phase, version, winner_uid, ruleset_version, started_at,
          updated_at, completed_at, state
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          game.gameId,
          game.roomId,
          game.status,
          game.currentPlayerUid,
          game.turnNumber,
          game.phase,
          game.version,
          game.winnerUid || null,
          game.rulesetVersion,
          game.startedAt,
          game.updatedAt,
          game.completedAt || null,
          JSON.stringify(game),
        ]
      );

      // 3. Atomically update room status and active game_id
      await client.query(
        'UPDATE game.rooms SET status = $2, game_id = $3, updated_at = $4 WHERE room_id = $1',
        [game.roomId, 'IN_PROGRESS', game.gameId, Date.now()]
      );

      await client.query('COMMIT');
      return { ok: true, game };
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('idx_one_active_game_per_room')) {
        // Handled constraint violation: Fetch existing active game for room
        const activeRes = await this.pool.query(
          `SELECT state FROM game.games WHERE room_id = $1 AND status IN ('IN_PROGRESS', 'ACTION_REQUIRED')`,
          [game.roomId]
        );
        if (activeRes.rows.length > 0) {
          return { ok: true, game: activeRes.rows[0].state as GameState };
        }
      }
      return { ok: false, error: msg };
    } finally {
      client.release();
    }
  }

  public async updateGame(game: GameState): Promise<void> {
    await this.pool.query(
      `
      UPDATE game.games SET
        status = $2,
        current_player_uid = $3,
        turn_number = $4,
        phase = $5,
        version = $6,
        winner_uid = $7,
        updated_at = $8,
        completed_at = $9,
        state = $10
      WHERE game_id = $1
      `,
      [
        game.gameId,
        game.status,
        game.currentPlayerUid,
        game.turnNumber,
        game.phase,
        game.version,
        game.winnerUid || null,
        Date.now(),
        game.completedAt || null,
        JSON.stringify(game),
      ]
    );
  }

  public async getGame(gameId: string): Promise<GameState | null> {
    const res = await this.pool.query('SELECT state FROM game.games WHERE game_id = $1', [gameId]);
    if (res.rows.length === 0) return null;
    return res.rows[0].state as GameState;
  }

  public async getActiveGameForRoom(roomId: string): Promise<GameState | null> {
    const res = await this.pool.query(
      `SELECT state FROM game.games WHERE room_id = $1 AND status IN ('IN_PROGRESS', 'ACTION_REQUIRED') ORDER BY started_at DESC LIMIT 1`,
      [roomId]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0].state as GameState;
  }

  public async listActiveGames(): Promise<GameState[]> {
    const res = await this.pool.query(
      `SELECT state FROM game.games WHERE status IN ('IN_PROGRESS', 'ACTION_REQUIRED') ORDER BY updated_at DESC`
    );
    return res.rows.map((r) => r.state as GameState);
  }

  // ==========================================
  // ATOMIC COMMAND COMMIT & EVENTS
  // ==========================================
  public async commitCommandExecution(params: CommandCommitParams): Promise<{
    ok: boolean;
    alreadyProcessed?: boolean;
    result: EngineResult;
    durationMs?: number;
  }> {
    const startTime = Date.now();
    const client = await this.pool.connect();
    try {
      // High-performance atomic commit via compound CTE query:
      // 1. Obtains row-level lock on the game session (FOR UPDATE).
      // 2. Records processed command with idempotent ON CONFLICT (game_id, command_id) DO NOTHING.
      // 3. Atomically records game event and updates game state in a single round-trip.
      // 4. Returns game existence, whether command was newly applied, and previous result if already processed.
      const cteSql = `
        WITH locked_game AS (
          SELECT game_id, version FROM game.games WHERE game_id = $1 FOR UPDATE
        ),
        ins_cmd AS (
          INSERT INTO game.processed_commands (game_id, command_id, actor_uid, result, version, created_at)
          SELECT $1, $2, $3, $4::jsonb, $5::int, $6::bigint
          FROM locked_game
          ON CONFLICT (game_id, command_id) DO NOTHING
          RETURNING result
        ),
        ins_event AS (
          INSERT INTO game.game_events (game_id, sequence, command_id, actor_uid, type, summary, payload, created_at, version_after)
          SELECT $1, $7::int, $2, $3, $8, $9, $10::jsonb, $11::bigint, $12::int
          FROM ins_cmd
          ON CONFLICT (game_id, sequence) DO NOTHING
        ),
        upd_game AS (
          UPDATE game.games SET
            status = $13,
            current_player_uid = $14,
            turn_number = $15::int,
            phase = $16,
            version = $5::int,
            winner_uid = $17,
            updated_at = $18::bigint,
            completed_at = $19::bigint,
            state = $20::jsonb
          WHERE game_id = $1 AND EXISTS (SELECT 1 FROM ins_cmd)
          RETURNING game_id
        )
        SELECT 
          (SELECT COUNT(*)::int FROM locked_game) as game_found,
          (SELECT COUNT(*)::int FROM ins_cmd) as cmd_inserted,
          (SELECT result FROM game.processed_commands WHERE game_id = $1 AND command_id = $2) as existing_result;
      `;

      const now = Date.now();
      const queryParams = [
        params.gameId, // $1
        params.commandId, // $2
        params.actorUid, // $3
        JSON.stringify(params.result), // $4
        params.nextState.version, // $5
        now, // $6
        params.result.event.sequence, // $7
        params.result.event.type, // $8
        params.result.event.summary, // $9
        JSON.stringify(params.result.event.payload || {}), // $10
        params.result.event.createdAt, // $11
        params.result.event.versionAfter, // $12
        params.nextState.status, // $13
        params.nextState.currentPlayerUid, // $14
        params.nextState.turnNumber, // $15
        params.nextState.phase, // $16
        params.nextState.winnerUid || null, // $17
        now, // $18
        params.nextState.completedAt || null, // $19
        JSON.stringify(params.nextState), // $20
      ];

      const res = await client.query<{
        game_found: number;
        cmd_inserted: number;
        existing_result: EngineResult | null;
      }>(cteSql, queryParams);

      const durationMs = Date.now() - startTime;
      const row = res.rows[0];

      if (!row || row.game_found === 0) {
        throw new Error(
          `GAME_SESSION_NOT_PERSISTED: Cannot execute a command because the game session "${params.gameId}" has not been committed to PostgreSQL.`
        );
      }

      if (row.cmd_inserted === 0 && row.existing_result) {
        return {
          ok: true,
          alreadyProcessed: true,
          result: row.existing_result,
          durationMs,
        };
      }

      return {
        ok: true,
        alreadyProcessed: false,
        result: params.result,
        durationMs,
      };
    } finally {
      client.release();
    }
  }

  public async getProcessedCommand(gameId: string, commandId: string): Promise<EngineResult | null> {
    const res = await this.pool.query<{ result: EngineResult }>(
      'SELECT result FROM game.processed_commands WHERE game_id = $1 AND command_id = $2',
      [gameId, commandId]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0].result;
  }

  public async getGameEvents(gameId: string, fromSequence = 0): Promise<GameEvent[]> {
    const res = await this.pool.query(
      `SELECT sequence, command_id, actor_uid, type, summary, payload, created_at, version_after
       FROM game.game_events WHERE game_id = $1 AND sequence >= $2 ORDER BY sequence ASC`,
      [gameId, fromSequence]
    );
    return res.rows.map((r) => ({
      sequence: r.sequence,
      commandId: r.command_id,
      actorUid: r.actor_uid,
      type: r.type,
      summary: r.summary,
      payload: r.payload,
      createdAt: Number(r.created_at),
      versionAfter: r.version_after,
    }));
  }

  // ==========================================
  // ARCHIVES
  // ==========================================
  public async saveArchive(archive: GameArchive): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO game.game_archives (
        archive_id, game_id, room_id, winner_uid, winner_name,
        total_turns, duration_seconds, started_at, completed_at,
        data, retention_until, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (archive_id) DO NOTHING
      `,
      [
        archive.archiveId,
        archive.gameId,
        archive.roomId,
        archive.winnerUid,
        archive.winnerName,
        archive.totalTurns,
        archive.durationSeconds,
        archive.startedAt,
        archive.completedAt,
        JSON.stringify(archive),
        archive.retentionUntil,
        Date.now(),
      ]
    );
  }

  public async getArchive(gameId: string): Promise<GameArchive | null> {
    const res = await this.pool.query('SELECT data FROM game.game_archives WHERE game_id = $1', [gameId]);
    if (res.rows.length === 0) return null;
    return res.rows[0].data as GameArchive;
  }
}
