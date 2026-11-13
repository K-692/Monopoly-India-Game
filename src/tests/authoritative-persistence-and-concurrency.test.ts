/**
 * Indian Monopoly - Authoritative Persistence & Concurrency Test Suite
 *
 * Verifies the 6 critical production persistence invariants:
 * 1. Room persistence ordering: createRoom does not return success until committed in store.
 * 2. Game persistence ordering: startGame does not return success until committed in store.
 * 3. Game persistence failure: Failed persistence aborts game start, prevents phantom memory state, and emits no events.
 * 4. Immediate first dice roll: Immediate ROLL_DICE succeeds without parent FK violation.
 * 5. Missing parent game rejection: commitCommandExecution on unpersisted gameId fails with GAME_SESSION_NOT_PERSISTED.
 * 6. Concurrent start requests: Near-simultaneous starts atomically yield exactly one active game session.
 */

import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { Server } from 'socket.io';
import { describe, expect, it } from 'vitest';
import { GameCommand, GameState } from '../domain/game-types';
import { DEFAULT_HOST_RULES } from '../domain/ruleset';
import { GameManager } from '../../server/game/game-manager';
import { MemoryStore } from '../../server/persistence/memory-store';
import { CommandCommitParams } from '../../server/persistence/types';
import { RoomManager } from '../../server/rooms/room-manager';
import { setupSocketHandlers } from '../../server/socket/socket-handlers';
import {
  ClientToServerEvents,
  InterServerEvents,
  PlayerAuthResponse,
  PlayerSession,
  RoomCreateResponse,
  ServerRoom,
  ServerToClientEvents,
  SocketData,
} from '../../server/types/server-types';

type TypedClient = ClientSocketType<ServerToClientEvents, ClientToServerEvents>;

describe('Authoritative Room and Game Persistence Invariants', () => {
  // =========================================================================
  // 1. ROOM PERSISTENCE ORDERING
  // =========================================================================
  it('1. Room persistence ordering: createRoom does not resolve until room is committed in store', async () => {
    let delayResolve: () => void = () => {};
    const delayPromise = new Promise<void>((resolve) => {
      delayResolve = resolve;
    });

    class DelayedRoomStore extends MemoryStore {
      public override async createRoom(room: ServerRoom): Promise<void> {
        await delayPromise;
        return super.createRoom(room);
      }
    }

    const store = new DelayedRoomStore();
    const rm = new RoomManager(store);
    const host = rm.registerPlayer('TestHost');

    let isCreateRoomFinished = false;
    const createPromise = rm.createRoom(host.uid, DEFAULT_HOST_RULES).then((res) => {
      isCreateRoomFinished = true;
      return res;
    });

    // Before store commit resolves, createRoom must still be pending
    await new Promise((r) => setTimeout(r, 20));
    expect(isCreateRoomFinished).toBe(false);

    // Release delayed store persistence
    delayResolve();
    const result = await createPromise;

    expect(result.ok).toBe(true);
    expect(result.room).toBeDefined();

    // Verify room is committed in store
    const stored = await store.getRoom(result.room!.roomId);
    expect(stored).not.toBeNull();
    expect(stored?.roomId).toBe(result.room!.roomId);
  });

  it('1.1 Host session persistence: persisted host session contains correct room ID immediately upon creation', async () => {
    const store = new MemoryStore();
    const rm = new RoomManager(store);
    const host = rm.registerPlayer('Aarav Host');
    expect(host.uid).toBeDefined();

    // Prior to room creation, host session in store has no roomId
    const preSession = await store.getSessionByUid(host.uid);
    expect(preSession?.roomId).toBeNull();

    const createRes = await rm.createRoom(host.uid, DEFAULT_HOST_RULES);
    expect(createRes.ok).toBe(true);
    const room = createRes.room!;

    // Host session in memory has new roomId
    const hostSessionMem = rm.getSessionByUid(host.uid);
    expect(hostSessionMem?.roomId).toBe(room.roomId);

    // Crucial: Host session committed in the store has the new roomId
    const storedSession = await store.getSessionByUid(host.uid);
    expect(storedSession).not.toBeNull();
    expect(storedSession?.roomId).toBe(room.roomId);
  });

  it('1.2 Host session persistence failure rollback: cleans up room and preserves previous session state', async () => {
    class FailingSaveSessionStore extends MemoryStore {
      public override async saveSession(session: PlayerSession): Promise<void> {
        // Fail when attempting to save the session with the new room
        if (session.roomId && typeof session.roomId === 'string' && session.roomId.startsWith('room_')) {
          throw new Error('Database disk error during saveSession');
        }
        return super.saveSession(session);
      }
    }

    const store = new FailingSaveSessionStore();
    const rm = new RoomManager(store);
    const host = rm.registerPlayer('RollbackHost');

    const preSession = rm.getSessionByUid(host.uid);
    expect(preSession?.roomId).toBeNull();

    const createRes = await rm.createRoom(host.uid, DEFAULT_HOST_RULES);
    expect(createRes.ok).toBe(false);
    expect(createRes.error).toContain('database persistence failure');

    // Host session rolled back to previous state
    expect(rm.getSessionByUid(host.uid)?.roomId).toBeNull();

    // Store has no orphaned room
    const activeRooms = await store.listActiveRooms();
    expect(activeRooms).toHaveLength(0);
  });

  // =========================================================================
  // 2. GAME PERSISTENCE ORDERING
  // =========================================================================
  it('2. Game persistence ordering: startGame does not resolve until game record is committed in store', async () => {
    let delayResolve: () => void = () => {};
    const delayPromise = new Promise<void>((resolve) => {
      delayResolve = resolve;
    });

    class DelayedGameStore extends MemoryStore {
      public override async createGame(game: GameState) {
        await delayPromise;
        return super.createGame(game);
      }
    }

    const store = new DelayedGameStore();
    const rm = new RoomManager(store);
    const gm = new GameManager(store);

    const host = rm.registerPlayer('HostPlayer');
    const guest = rm.registerPlayer('GuestPlayer');

    const roomRes = await rm.createRoom(host.uid, DEFAULT_HOST_RULES);
    expect(roomRes.ok).toBe(true);
    const room = roomRes.room!;

    rm.joinRoom(room.inviteCode, guest.uid);
    rm.setReady(room.roomId, host.uid, true);
    rm.setReady(room.roomId, guest.uid, true);

    let isStartGameFinished = false;
    const startPromise = gm.startGame(room, host.uid).then((res) => {
      isStartGameFinished = true;
      return res;
    });

    // Before store commit resolves, startGame must still be pending
    await new Promise((r) => setTimeout(r, 20));
    expect(isStartGameFinished).toBe(false);

    // Release store persistence
    delayResolve();
    const startRes = await startPromise;

    expect(startRes.ok).toBe(true);
    expect(startRes.gameId).toBeDefined();

    // Verify game is committed in store
    const storedGame = await store.getGame(startRes.gameId!);
    expect(storedGame).not.toBeNull();
    expect(storedGame?.gameId).toBe(startRes.gameId);
  });

  // =========================================================================
  // 3. GAME PERSISTENCE FAILURE
  // =========================================================================
  it('3. Game persistence failure: returns failure, leaves no phantom game in memory, emits no events', async () => {
    class FailingGameStore extends MemoryStore {
      public override async createGame(_game: GameState): Promise<{ ok: boolean; game?: GameState; error?: string }> {
        return { ok: false, error: 'Database write constraint rejected: Disk quota exceeded' };
      }
    }

    const store = new FailingGameStore();
    const rm = new RoomManager(store);
    const gm = new GameManager(store);

    const broadcastEvents: Array<{ event: string; data: unknown }> = [];
    gm.setBroadcastCallback((_gameId, _roomId, event, data) => {
      broadcastEvents.push({ event, data });
    });

    const host = rm.registerPlayer('HostPlayer');
    const guest = rm.registerPlayer('GuestPlayer');

    const roomRes = await rm.createRoom(host.uid, DEFAULT_HOST_RULES);
    expect(roomRes.ok).toBe(true);
    const room = roomRes.room!;

    rm.joinRoom(room.inviteCode, guest.uid);
    rm.setReady(room.roomId, host.uid, true);
    rm.setReady(room.roomId, guest.uid, true);

    const startRes = await gm.startGame(room, host.uid);

    // 1. Verify failure result
    expect(startRes.ok).toBe(false);
    expect(startRes.error).toContain('Disk quota exceeded');
    expect(startRes.gameId).toBeUndefined();

    // 2. Room must remain in LOBBY status (no partial state)
    expect(room.status).toBe('LOBBY');
    expect(room.gameId).toBeUndefined();

    // 3. GameManager must not have any registered active game for room
    expect(gm.getActiveGameIdForRoom(room.roomId)).toBeUndefined();

    // 4. No game:started event broadcasted
    const startedBroadcasts = broadcastEvents.filter((b) => b.event === 'game:started');
    expect(startedBroadcasts).toHaveLength(0);
  });

  // =========================================================================
  // 4. IMMEDIATE FIRST DICE ROLL
  // =========================================================================
  it('4. Immediate first dice roll: immediate ROLL_DICE succeeds and finds committed parent record', async () => {
    const store = new MemoryStore();
    const rm = new RoomManager(store);
    const gm = new GameManager(store);

    const host = rm.registerPlayer('DiceRoller');
    const guest = rm.registerPlayer('DiceGuest');

    const roomRes = await rm.createRoom(host.uid, DEFAULT_HOST_RULES);
    expect(roomRes.ok).toBe(true);
    const room = roomRes.room!;

    rm.joinRoom(room.inviteCode, guest.uid);
    rm.setReady(room.roomId, host.uid, true);
    rm.setReady(room.roomId, guest.uid, true);

    const startRes = await gm.startGame(room, host.uid, { forcedPlayerOrder: [host.uid, guest.uid] });
    expect(startRes.ok).toBe(true);
    const gameId = startRes.gameId!;

    // Immediately dispatch ROLL_DICE as first action
    const diceCommand: GameCommand = {
      commandId: 'cmd_dice_first_turn_001',
      roomId: room.roomId,
      gameId,
      expectedVersion: startRes.gameState!.version,
      type: 'ROLL_DICE',
      payload: {
        forcedDice: [2, 3], // 5 steps
      },
    };

    const rollResult = await gm.processCommand(gameId, diceCommand, host.uid);
    expect(rollResult.nextState).toBeDefined();
    expect(rollResult.event.type).toBe('ROLL_DICE');

    // Verify processed command was recorded in store with parent association
    const processed = await store.getProcessedCommand(gameId, 'cmd_dice_first_turn_001');
    expect(processed).not.toBeNull();
    expect(processed?.event.type).toBe('ROLL_DICE');

    // Verify game state in store was updated
    const updatedGame = await store.getGame(gameId);
    expect(updatedGame).not.toBeNull();
    expect(updatedGame!.version).toBeGreaterThan(startRes.gameState!.version);
  });

  // =========================================================================
  // 5. MISSING PARENT GAME REJECTION
  // =========================================================================
  it('5. Missing parent game: commitCommandExecution on uncommitted gameId throws GAME_SESSION_NOT_PERSISTED', async () => {
    const store = new MemoryStore();

    const commitParams: CommandCommitParams = {
      gameId: 'game_nonexistent_uncommitted_123',
      commandId: 'cmd_orphan_test_001',
      actorUid: 'usr_nobody',
      result: {
        nextState: {} as GameState,
        event: {
          sequence: 1,
          commandId: 'cmd_orphan_test_001',
          actorUid: 'usr_nobody',
          type: 'DICE_ROLLED',
          summary: 'Dice rolled',
          payload: {},
          createdAt: Date.now(),
          versionAfter: 2,
        },
      },
      nextState: {
        gameId: 'game_nonexistent_uncommitted_123',
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

    await expect(store.commitCommandExecution(commitParams)).rejects.toThrow('GAME_SESSION_NOT_PERSISTED');

    // Verify no orphaned processed command or event was inserted
    const processed = await store.getProcessedCommand('game_nonexistent_uncommitted_123', 'cmd_orphan_test_001');
    expect(processed).toBeNull();
  });

  // =========================================================================
  // 6. CONCURRENT START REQUESTS ATOMICITY
  // =========================================================================
  it('6. Concurrent start requests: near-simultaneous starts result in exactly one active game session', async () => {
    const store = new MemoryStore();
    const rm = new RoomManager(store);
    const gm = new GameManager(store);

    const host = rm.registerPlayer('ConcurrentHost');
    const guest = rm.registerPlayer('ConcurrentGuest');

    const roomRes = await rm.createRoom(host.uid, DEFAULT_HOST_RULES);
    expect(roomRes.ok).toBe(true);
    const room = roomRes.room!;

    rm.joinRoom(room.inviteCode, guest.uid);
    rm.setReady(room.roomId, host.uid, true);
    rm.setReady(room.roomId, guest.uid, true);

    // Trigger two simultaneous startGame requests
    const [startRes1, startRes2] = await Promise.all([
      gm.startGame(room, host.uid),
      gm.startGame(room, host.uid),
    ]);

    expect(startRes1.ok).toBe(true);
    expect(startRes2.ok).toBe(true);

    // Both should yield the identical game ID (strict room-game bijection)
    expect(startRes1.gameId).toBe(startRes2.gameId);

    // Store must have exactly one active game for this room
    const activeGame = await store.getActiveGameForRoom(room.roomId);
    expect(activeGame).not.toBeNull();
    expect(activeGame?.gameId).toBe(startRes1.gameId);
  });

  // =========================================================================
  // 7. SERVER READINESS GATE
  // =========================================================================
  it('7. Server readiness gate: rejects operations with SERVICE_INITIALIZING until ready, accepts when ready', async () => {
    let isReady = false;
    const store = new MemoryStore();
    const rm = new RoomManager(store);
    const gm = new GameManager(store);

    const httpServer = http.createServer();
    const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
      cors: { origin: '*' },
    });

    setupSocketHandlers(io, rm, gm, () => isReady);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = httpServer.address();
    const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
    const client: TypedClient = ClientSocket(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      autoConnect: true,
    }) as TypedClient;

    await new Promise<void>((resolve) => client.on('connect', () => resolve()));

    // 1. When server is not ready: player:register is rejected with SERVICE_INITIALIZING
    const registerBeforeReady = await new Promise<PlayerAuthResponse>((resolve) => {
      client.emit('player:register', { displayName: 'EarlyBird' }, (res) => resolve(res));
    });
    expect(registerBeforeReady.ok).toBe(false);
    expect(registerBeforeReady.code).toBe('SERVICE_INITIALIZING');
    expect(registerBeforeReady.error).toContain('Server is initializing');

    // 2. room:create is rejected with SERVICE_INITIALIZING
    const roomBeforeReady = await new Promise<RoomCreateResponse>((resolve) => {
      client.emit('room:create', { customRules: DEFAULT_HOST_RULES }, (res) => resolve(res));
    });
    expect(roomBeforeReady.ok).toBe(false);
    expect(roomBeforeReady.code).toBe('SERVICE_INITIALIZING');

    // 3. Transition server to ready
    isReady = true;

    // 4. Now operations succeed!
    const registerAfterReady = await new Promise<PlayerAuthResponse>((resolve) => {
      client.emit('player:register', { displayName: 'ReadyPlayer' }, (res) => resolve(res));
    });
    expect(registerAfterReady.ok).toBe(true);
    expect(registerAfterReady.player).toBeDefined();

    const roomAfterReady = await new Promise<RoomCreateResponse>((resolve) => {
      client.emit('room:create', { customRules: DEFAULT_HOST_RULES }, (res) => resolve(res));
    });
    expect(roomAfterReady.ok).toBe(true);
    expect(roomAfterReady.room).toBeDefined();

    // Clean up
    client.disconnect();
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });
});
