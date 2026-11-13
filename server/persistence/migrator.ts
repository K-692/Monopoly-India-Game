/**
 * Indian Monopoly - Database Schema Migrator
 * Runs version-controlled schema migrations idempotently against PostgreSQL.
 */

import { Pool } from 'pg';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INT PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        applied_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS player_sessions (
        uid VARCHAR(64) PRIMARY KEY,
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        avatar_color VARCHAR(32) NOT NULL,
        socket_id VARCHAR(64),
        room_id VARCHAR(64),
        connected BOOLEAN NOT NULL DEFAULT false,
        last_seen_at BIGINT NOT NULL,
        ip_address VARCHAR(64),
        session_generation INT NOT NULL DEFAULT 1,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_player_sessions_token_hash ON player_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_player_sessions_room_id ON player_sessions(room_id);
      CREATE INDEX IF NOT EXISTS idx_player_sessions_socket_id ON player_sessions(socket_id);

      CREATE TABLE IF NOT EXISTS rooms (
        room_id VARCHAR(64) PRIMARY KEY,
        invite_code VARCHAR(16) UNIQUE NOT NULL,
        invite_code_hash VARCHAR(64) NOT NULL,
        host_uid VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL,
        max_players INT NOT NULL DEFAULT 6,
        turn_timer_seconds INT NOT NULL DEFAULT 30,
        game_mode VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
        custom_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
        cpu_players JSONB,
        game_id VARCHAR(64),
        next_join_sequence INT NOT NULL DEFAULT 2,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rooms_invite_code ON rooms(invite_code);
      CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

      CREATE TABLE IF NOT EXISTS room_members (
        room_id VARCHAR(64) NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
        uid VARCHAR(64) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        photo_url TEXT,
        is_ready BOOLEAN NOT NULL DEFAULT false,
        joined_at BIGINT NOT NULL,
        color_token VARCHAR(32) NOT NULL,
        is_cpu BOOLEAN NOT NULL DEFAULT false,
        player_type VARCHAR(32) NOT NULL DEFAULT 'HUMAN',
        room_join_sequence INT NOT NULL DEFAULT 1,
        PRIMARY KEY (room_id, uid)
      );

      CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);

      CREATE TABLE IF NOT EXISTS games (
        game_id VARCHAR(64) PRIMARY KEY,
        room_id VARCHAR(64) NOT NULL REFERENCES rooms(room_id),
        status VARCHAR(32) NOT NULL,
        current_player_uid VARCHAR(64) NOT NULL,
        turn_number INT NOT NULL DEFAULT 1,
        phase VARCHAR(32) NOT NULL,
        version INT NOT NULL DEFAULT 1,
        winner_uid VARCHAR(64),
        ruleset_version VARCHAR(32) NOT NULL,
        started_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        completed_at BIGINT,
        state JSONB NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_games_room_id ON games(room_id);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_game_per_room
        ON games(room_id)
        WHERE (status IN ('IN_PROGRESS', 'ACTION_REQUIRED'));

      CREATE TABLE IF NOT EXISTS game_events (
        game_id VARCHAR(64) NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
        sequence INT NOT NULL,
        command_id VARCHAR(128) NOT NULL,
        actor_uid VARCHAR(64) NOT NULL,
        type VARCHAR(64) NOT NULL,
        summary TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at BIGINT NOT NULL,
        version_after INT NOT NULL,
        PRIMARY KEY (game_id, sequence)
      );

      CREATE INDEX IF NOT EXISTS idx_game_events_game ON game_events(game_id, sequence);

      CREATE TABLE IF NOT EXISTS processed_commands (
        game_id VARCHAR(64) NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
        command_id VARCHAR(128) NOT NULL,
        actor_uid VARCHAR(64) NOT NULL,
        result JSONB NOT NULL,
        version INT NOT NULL,
        created_at BIGINT NOT NULL,
        PRIMARY KEY (game_id, command_id)
      );

      CREATE INDEX IF NOT EXISTS idx_processed_commands_game ON processed_commands(game_id, command_id);

      CREATE TABLE IF NOT EXISTS game_archives (
        archive_id VARCHAR(64) PRIMARY KEY,
        game_id VARCHAR(64) NOT NULL,
        room_id VARCHAR(64) NOT NULL,
        winner_uid VARCHAR(64) NOT NULL,
        winner_name VARCHAR(100) NOT NULL,
        total_turns INT NOT NULL,
        duration_seconds INT NOT NULL,
        started_at BIGINT NOT NULL,
        completed_at BIGINT NOT NULL,
        data JSONB NOT NULL,
        retention_until BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_game_archives_room ON game_archives(room_id);
    `,
  },
];

export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create tracking table if not present
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INT PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        applied_at BIGINT NOT NULL
      );
    `);

    // Fetch already applied migrations
    const res = await client.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version ASC');
    const applied = new Set(res.rows.map((r) => r.version));

    for (const migration of MIGRATIONS) {
      if (!applied.has(migration.version)) {
        console.log(`[Migrations] Applying migration v${migration.version}: ${migration.name}`);
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)',
          [migration.version, migration.name, Date.now()]
        );
        console.log(`[Migrations] Applied migration v${migration.version} successfully.`);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migrations] Migration failed, transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
  }
}
