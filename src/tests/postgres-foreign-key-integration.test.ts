/**
 * Indian Monopoly - Genuine PostgreSQL Integration Test Suite
 *
 * Exercises PostgresStore against an actual PostgreSQL database instance (PostgreSQL 17 compatible),
 * verifying:
 * 1. Application of actual schema migrations (runMigrations).
 * 2. Authoritative room and game creation in game.rooms and game.games.
 * 3. Immediate execution of ROLL_DICE without foreign key constraint violations (processed_commands_game_id_fkey).
 * 4. Actual rows exist in PostgreSQL:
 *    - game.rooms
 *    - game.games
 *    - game.processed_commands
 *    - game.game_events
 * 5. Monotonic game version advancement in PostgreSQL.
 * 6. Explicit rejection of commands targeting non-persisted games with GAME_SESSION_NOT_PERSISTED.
 *
 * SAFETY GUARD:
 * - Never runs against the production Supabase project (omelbzqsmqsjazaliqvo).
 * - Requires a disposable local or CI test database configured via TEST_DATABASE_URL.
 * - If TEST_DATABASE_URL is not set, this suite is cleanly skipped with an explicit diagnostic notice.
 */

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GameCommand, GameState } from '../domain/game-types';
import { DEFAULT_HOST_RULES } from '../domain/ruleset';
import { GameManager } from '../../server/game/game-manager';
import { PostgresStore } from '../../server/persistence/postgres-store';
import { CommandCommitParams } from '../../server/persistence/types';
import { RoomManager } from '../../server/rooms/room-manager';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

// Safety check: Never connect to production Supabase database for automated test suite
const isProductionSupabase =
  Boolean(TEST_DATABASE_URL) &&
  (TEST_DATABASE_URL!.includes('omelbzqsmqsjazaliqvo') ||
    TEST_DATABASE_URL!.includes('supabase.com') ||
    TEST_DATABASE_URL!.includes('supabase.co'));

if (isProductionSupabase) {
  throw new Error(
    'FATAL SECURITY VIOLATION: TEST_DATABASE_URL must never point to the production Supabase database! Use a disposable local PostgreSQL database for integration testing.'
  );
}

const describeIfPostgres = TEST_DATABASE_URL && !isProductionSupabase ? describe : describe.skip;

if (!TEST_DATABASE_URL) {
  console.info(
    '\n========================================================================================\n' +
      '[PostgreSQL Integration Notice] TEST_DATABASE_URL is not configured.\n' +
      'Genuine PostgreSQL integration test skipped in this environment.\n' +
      'To execute against an actual disposable PostgreSQL instance:\n' +
      '  TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/monopoly_test" npm run test\n' +
      '========================================================================================\n'
  );
}

describeIfPostgres('Genuine PostgreSQL Integration & Foreign Key Constraints Suite', () => {
  let store: PostgresStore;
  let pool: Pool;
  let roomManager: RoomManager;
  let gameManager: GameManager;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });

    store = new PostgresStore({ connectionString: TEST_DATABASE_URL });
    await store.init();

    roomManager = new RoomManager(store);
    gameManager = new GameManager(store);

    // Clean up test tables in disposable test database
    await pool.query(
      'TRUNCATE game.game_events, game.processed_commands, game.games, game.room_members, game.rooms, game.player_sessions CASCADE'
    );
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(
        'TRUNCATE game.game_events, game.processed_commands, game.games, game.room_members, game.rooms, game.player_sessions CASCADE'
      ).catch(() => {});
      await pool.end().catch(() => {});
    }
    if (store) {
      await store.close().catch(() => {});
    }
  });

  it('verifies genuine PostgreSQL persistence and immediate ROLL_DICE without foreign key violation', async () => {
    // 1. Register host and guest sessions
    const hostSession = roomManager.registerPlayer('PgHost');
    const guestSession = roomManager.registerPlayer('PgGuest');

    // 2. Create room and await PostgreSQL commitment
    const roomRes = await roomManager.createRoom(hostSession.uid, DEFAULT_HOST_RULES);
    expect(roomRes.ok).toBe(true);
    const room = roomRes.room!;

    // 3. Join guest and set both ready
    roomManager.joinRoom(room.inviteCode, guestSession.uid);
    roomManager.setReady(room.roomId, hostSession.uid, true);
    roomManager.setReady(room.roomId, guestSession.uid, true);

    // 4. Start game with authoritative PostgreSQL persistence
    const startRes = await gameManager.startGame(room, hostSession.uid, {
      forcedPlayerOrder: [hostSession.uid, guestSession.uid],
    });
    expect(startRes.ok).toBe(true);
    const gameId = startRes.gameId!;
    const initialVersion = startRes.gameState!.version;

    // 5. Immediately execute ROLL_DICE command
    const diceCommand: GameCommand = {
      commandId: 'cmd_pg_test_roll_001',
      roomId: room.roomId,
      gameId,
      expectedVersion: initialVersion,
      type: 'ROLL_DICE',
      payload: {
        forcedDice: [1, 2],
      },
    };

    // This command must not throw foreign key violation processed_commands_game_id_fkey
    const rollResult = await gameManager.processCommand(gameId, diceCommand, hostSession.uid);
    expect(rollResult.nextState).toBeDefined();
    expect(rollResult.event.type).toBe('ROLL_DICE');

    // 6. Direct PostgreSQL verification: Inspect actual rows using raw SQL queries
    // Row 1: game.rooms exists
    const roomDb = await pool.query('SELECT room_id, status, host_uid FROM game.rooms WHERE room_id = $1', [room.roomId]);
    expect(roomDb.rows).toHaveLength(1);
    expect(roomDb.rows[0].status).toBe('IN_PROGRESS');

    // Row 2: game.games exists
    const gameDb = await pool.query('SELECT game_id, room_id, version, status FROM game.games WHERE game_id = $1', [gameId]);
    expect(gameDb.rows).toHaveLength(1);
    expect(gameDb.rows[0].room_id).toBe(room.roomId);

    // Row 3: game.processed_commands exists with matching game_id foreign key
    const cmdDb = await pool.query(
      'SELECT game_id, command_id, version FROM game.processed_commands WHERE game_id = $1 AND command_id = $2',
      [gameId, 'cmd_pg_test_roll_001']
    );
    expect(cmdDb.rows).toHaveLength(1);
    expect(cmdDb.rows[0].game_id).toBe(gameId);

    // Row 4: game.game_events exists with matching game_id foreign key
    const eventDb = await pool.query(
      'SELECT game_id, command_id, type FROM game.game_events WHERE game_id = $1 AND command_id = $2',
      [gameId, 'cmd_pg_test_roll_001']
    );
    expect(eventDb.rows).toHaveLength(1);
    expect(eventDb.rows[0].type).toBe('ROLL_DICE');

    // 7. Verify version advanced in PostgreSQL
    const updatedGame = await store.getGame(gameId);
    expect(updatedGame).not.toBeNull();
    expect(updatedGame!.version).toBeGreaterThan(initialVersion);
  });

  it('verifies commitCommandExecution on non-existent game in PostgreSQL is rejected with GAME_SESSION_NOT_PERSISTED', async () => {
    const phantomGameId = 'game_phantom_unpersisted_999';
    const commitParams: CommandCommitParams = {
      gameId: phantomGameId,
      commandId: 'cmd_phantom_001',
      actorUid: 'usr_nobody',
      result: {
        nextState: {} as GameState,
        event: {
          sequence: 1,
          commandId: 'cmd_phantom_001',
          actorUid: 'usr_nobody',
          type: 'ROLL_DICE',
          summary: 'Phantom roll',
          payload: {},
          createdAt: Date.now(),
          versionAfter: 2,
        },
      },
      nextState: {
        gameId: phantomGameId,
        status: 'IN_PROGRESS',
        currentPlayerUid: 'usr_nobody',
        turnNumber: 1,
        phase: 'AWAIT_ROLL',
        version: 2,
        rulesetVersion: '1.0.0',
        startedAt: Date.now(),
        updatedAt: Date.now(),
      } as GameState,
    };

    // Must reject with GAME_SESSION_NOT_PERSISTED before attempting foreign key write
    await expect(store.commitCommandExecution(commitParams)).rejects.toThrow('GAME_SESSION_NOT_PERSISTED');

    // Confirm no orphaned records in database
    const checkDb = await pool.query('SELECT * FROM game.processed_commands WHERE game_id = $1', [phantomGameId]);
    expect(checkDb.rows).toHaveLength(0);
  });
});
