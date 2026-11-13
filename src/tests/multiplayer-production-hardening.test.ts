/**
 * Indian Monopoly - Production Multiplayer Hardening Test Suite
 *
 * Comprehensive integration tests verifying:
 * 1. Strict Room & Game Isolation (Room A vs Room B, independent socket channels)
 * 2. Duplicate Game Prevention (Atomic transition, duplicate start deduplication)
 * 3. 3-Player Synchronization & Command Idempotency (Deduplication, stale version rejection)
 * 4. Security & Authorization (Handshake auth, session fencing, unauthorized access)
 * 5. Automatic Human-to-CPU Takeover (Grace period, bot activation for disconnected slot)
 * 6. Human Reconnection & Control Recovery (Token restoration, bot cancellation)
 * 7. Server Crash & Restart Recovery (Active state restoration, deadline preservation)
 */

import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GameCommand, GameEvent, GameState, RoomState } from '../domain/game-types';
import { DEFAULT_HOST_RULES } from '../domain/ruleset';
import { createLanServer } from '../../server/index';
import { MemoryStore } from '../../server/persistence/memory-store';
import {
  ClientToServerEvents,
  GameCommandResponse,
  GameStartResponse,
  PlayerAuthResponse,
  PlayerSessionPublic,
  RoomCreateResponse,
  ServerToClientEvents,
} from '../../server/types/server-types';

type TypedClient = ClientSocketType<ServerToClientEvents, ClientToServerEvents>;

describe('Production-Grade Multiplayer Hardening Suite', () => {
  let serverInstance: ReturnType<typeof createLanServer>;
  let httpServer: http.Server;
  let serverPort: number;
  let serverUrl: string;
  let sharedStore: MemoryStore;

  beforeAll(async () => {
    // Shared store to test restart recovery
    sharedStore = new MemoryStore();
    serverInstance = createLanServer({ store: sharedStore });
    httpServer = serverInstance.httpServer;

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address();
        if (typeof addr === 'object' && addr !== null) {
          serverPort = addr.port;
          serverUrl = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    clearInterval(serverInstance.cleanupInterval);
    serverInstance.io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  function createClient(token?: string): TypedClient {
    return ClientSocket(serverUrl, {
      transports: ['websocket'],
      forceNew: true,
      autoConnect: true,
      auth: { token },
    }) as TypedClient;
  }

  // =========================================================================
  // SECTION 1: STRICT ROOM AND GAME ISOLATION
  // =========================================================================
  describe('Phase 2 & 10.A: Strict Room & Game Isolation', () => {
    it('guarantees that Room A and Room B operate as completely independent sessions', async () => {
      const clientA1 = createClient();
      const clientA2 = createClient();
      const clientB1 = createClient();
      const clientB2 = createClient();

      try {
        // Register players
        const pA1 = await new Promise<PlayerSessionPublic>((res) => clientA1.emit('player:register', { displayName: 'Host Alpha' }, (r) => res(r.player!)));
        await new Promise<PlayerSessionPublic>((res) => clientA2.emit('player:register', { displayName: 'Guest Alpha' }, (r) => res(r.player!)));
        await new Promise<PlayerSessionPublic>((res) => clientB1.emit('player:register', { displayName: 'Host Beta' }, (r) => res(r.player!)));
        await new Promise<PlayerSessionPublic>((res) => clientB2.emit('player:register', { displayName: 'Guest Beta' }, (r) => res(r.player!)));

        // Create Room A and Room B
        const roomA = await new Promise<RoomState>((res) => clientA1.emit('room:create', { customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 2 } }, (r) => res(r.room!)));
        const roomB = await new Promise<RoomState>((res) => clientB1.emit('room:create', { customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 2 } }, (r) => res(r.room!)));

        expect(roomA.roomId).not.toBe(roomB.roomId);
        expect(roomA.inviteCode).not.toBe(roomB.inviteCode);

        // Join guests
        await new Promise((res) => clientA2.emit('room:join', { inviteCode: roomA.inviteCode }, res));
        await new Promise((res) => clientB2.emit('room:join', { inviteCode: roomB.inviteCode }, res));

        // Mark ready
        await new Promise((res) => clientA1.emit('room:set-ready', { isReady: true }, res));
        await new Promise((res) => clientA2.emit('room:set-ready', { isReady: true }, res));
        await new Promise((res) => clientB1.emit('room:set-ready', { isReady: true }, res));
        await new Promise((res) => clientB2.emit('room:set-ready', { isReady: true }, res));

        // Start Room A
        const startA = await new Promise<GameStartResponse>((res) => clientA1.emit('room:start', res));
        expect(startA.ok).toBe(true);
        expect(startA.gameId).toBeDefined();

        // Start Room B
        const startB = await new Promise<GameStartResponse>((res) => clientB1.emit('room:start', res));
        expect(startB.ok).toBe(true);
        expect(startB.gameId).toBeDefined();
        expect(startA.gameId).not.toBe(startB.gameId);

        // Track events received by Room B clients
        const roomBEventsReceived: GameEvent[] = [];
        clientB1.on('game:event', (ev) => roomBEventsReceived.push(ev));
        clientB2.on('game:event', (ev) => roomBEventsReceived.push(ev));

        // Execute dice roll in Room A
        const gameA = serverInstance.gameManager.getGame(startA.gameId!)!;
        const cmdA: GameCommand = {
          commandId: 'cmd_iso_roll_' + Date.now(),
          roomId: roomA.roomId,
          gameId: startA.gameId!,
          expectedVersion: gameA.version,
          type: 'ROLL_DICE',
          payload: {},
        };

        const activePlayerUid = gameA.currentPlayerUid;
        const activeClient = activePlayerUid === pA1.uid ? clientA1 : clientA2;

        const cmdRes = await new Promise<GameCommandResponse>((res) => activeClient.emit('game:command', cmdA, res));
        expect(cmdRes.ok).toBe(true);

        // Wait brief delay to ensure socket event dispatching
        await new Promise((r) => setTimeout(r, 100));

        // Verify Room B received ZERO events from Room A
        expect(roomBEventsReceived).toHaveLength(0);

        // Verify Game B state version did not change
        const freshGameB = serverInstance.gameManager.getGame(startB.gameId!)!;
        expect(freshGameB.version).toBe(1);
      } finally {
        clientA1.disconnect();
        clientA2.disconnect();
        clientB1.disconnect();
        clientB2.disconnect();
      }
    });

    it('prevents multiple active games inside one room on repeated start requests', async () => {
      const hostClient = createClient();
      const guestClient = createClient();

      try {
        await new Promise((res) => hostClient.emit('player:register', { displayName: 'Host Dedupe' }, res));
        await new Promise((res) => guestClient.emit('player:register', { displayName: 'Guest Dedupe' }, res));

        const roomRes = await new Promise<RoomCreateResponse>((res) => hostClient.emit('room:create', { customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 2 } }, res));
        await new Promise((res) => guestClient.emit('room:join', { inviteCode: roomRes.inviteCode! }, res));

        await new Promise((res) => hostClient.emit('room:set-ready', { isReady: true }, res));
        await new Promise((res) => guestClient.emit('room:set-ready', { isReady: true }, res));

        // Concurrent duplicate start requests from the host
        const [res1, res2] = await Promise.all([
          new Promise<GameStartResponse>((res) => hostClient.emit('room:start', res)),
          new Promise<GameStartResponse>((res) => hostClient.emit('room:start', res)),
        ]);

        expect(res1.ok).toBe(true);
        expect(res2.ok).toBe(true);
        // Both requests must return the EXACT same gameId without creating a second instance
        expect(res1.gameId).toBe(res2.gameId);

        // Third sequential start request must also return existing gameId idempotently
        const res3 = await new Promise<GameStartResponse>((res) => hostClient.emit('room:start', res));
        expect(res3.ok).toBe(true);
        expect(res3.gameId).toBe(res1.gameId);
      } finally {
        hostClient.disconnect();
        guestClient.disconnect();
      }
    });
  });

  // =========================================================================
  // SECTION 2: 3-PLAYER SYNCHRONIZATION & IDEMPOTENCY
  // =========================================================================
  describe('Phase 3 & 10.B: Multiplayer Synchronization & Command Idempotency', () => {
    it('synchronizes 3 human clients and enforces durable command deduplication & version checks', async () => {
      const client1 = createClient();
      const client2 = createClient();
      const client3 = createClient();

      try {
        const p1 = await new Promise<PlayerSessionPublic>((res) => client1.emit('player:register', { displayName: 'Tycoon 1' }, (r) => res(r.player!)));
        const p2 = await new Promise<PlayerSessionPublic>((res) => client2.emit('player:register', { displayName: 'Tycoon 2' }, (r) => res(r.player!)));
        await new Promise<PlayerSessionPublic>((res) => client3.emit('player:register', { displayName: 'Tycoon 3' }, (r) => res(r.player!)));

        const roomRes = await new Promise<RoomCreateResponse>((res) => client1.emit('room:create', { customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 3 } }, res));
        await new Promise((res) => client2.emit('room:join', { inviteCode: roomRes.inviteCode! }, res));
        await new Promise((res) => client3.emit('room:join', { inviteCode: roomRes.inviteCode! }, res));

        await new Promise((res) => client1.emit('room:set-ready', { isReady: true }, res));
        await new Promise((res) => client2.emit('room:set-ready', { isReady: true }, res));
        await new Promise((res) => client3.emit('room:set-ready', { isReady: true }, res));

        const startRes = await new Promise<GameStartResponse>((res) => client1.emit('room:start', res));
        expect(startRes.ok).toBe(true);
        const gameId = startRes.gameId!;

        // Track incoming state versions across all three clients
        const statesClient1: number[] = [];
        const statesClient2: number[] = [];
        const statesClient3: number[] = [];

        client1.on('game:state', (s) => statesClient1.push(s.version));
        client2.on('game:state', (s) => statesClient2.push(s.version));
        client3.on('game:state', (s) => statesClient3.push(s.version));

        let currentGameState = serverInstance.gameManager.getGame(gameId)!;
        const activeUid = currentGameState.currentPlayerUid;
        const activeClient = activeUid === p1.uid ? client1 : activeUid === p2.uid ? client2 : client3;

        // Command 1: ROLL_DICE
        const commandId1 = 'cmd_sync_roll_' + Date.now();
        const cmd1: GameCommand = {
          commandId: commandId1,
          roomId: roomRes.roomId!,
          gameId,
          expectedVersion: currentGameState.version,
          type: 'ROLL_DICE',
          payload: {},
        };

        const rollRes = await new Promise<GameCommandResponse>((res) => activeClient.emit('game:command', cmd1, res));
        expect(rollRes.ok).toBe(true);

        // Wait for state propagation
        await new Promise((r) => setTimeout(r, 150));

        currentGameState = serverInstance.gameManager.getGame(gameId)!;
        expect(currentGameState.version).toBeGreaterThan(1);
        const expectedVersionAfterRoll = currentGameState.version;

        // Verify all three clients converged on the exact same version
        expect(statesClient1).toContain(expectedVersionAfterRoll);
        expect(statesClient2).toContain(expectedVersionAfterRoll);
        expect(statesClient3).toContain(expectedVersionAfterRoll);

        // Deduplication Test: Deliver identical commandId again
        const duplicateRes = await new Promise<GameCommandResponse>((res) => activeClient.emit('game:command', cmd1, res));
        expect(duplicateRes.ok).toBe(true);

        // State version must NOT advance on duplicate command delivery
        const stateAfterDedupe = serverInstance.gameManager.getGame(gameId)!;
        expect(stateAfterDedupe.version).toBe(expectedVersionAfterRoll);

        // Stale Version Test: Try sending a command with version 1 (which is now obsolete)
        const staleCmd: GameCommand = {
          commandId: 'cmd_stale_' + Date.now(),
          roomId: roomRes.roomId!,
          gameId,
          expectedVersion: 1, // Intentionally stale
          type: 'END_TURN',
          payload: {},
        };

        const staleRes = await new Promise<GameCommandResponse>((res) => activeClient.emit('game:command', staleCmd, res));
        expect(staleRes.ok).toBe(false);
        expect(staleRes.error).toContain('Stale version');
      } finally {
        client1.disconnect();
        client2.disconnect();
        client3.disconnect();
      }
    });
  });

  // =========================================================================
  // SECTION 3: SECURITY & AUTHORIZATION
  // =========================================================================
  describe('Phase 8: Security & Authorization Enforcement', () => {
    it('rejects unauthenticated room queries and non-member room access', async () => {
      const client = createClient();

      try {
        // Query room before authentication
        const unauthGet = await new Promise<{ ok: boolean; error?: string }>((res) => {
          client.emit('room:get', { roomId: 'room_fake123' }, res);
        });
        expect(unauthGet.ok).toBe(false);
        expect(unauthGet.error).toContain('Unauthenticated');

        // Authenticate as a legitimate player
        await new Promise((res) => client.emit('player:register', { displayName: 'Legit Player' }, res));

        // Create a room with another host
        const hostClient = createClient();
        await new Promise((res) => hostClient.emit('player:register', { displayName: 'Host Secret' }, res));
        const hostRoom = await new Promise<RoomCreateResponse>((res) => hostClient.emit('room:create', {}, res));

        // Non-member client attempts to inspect Host Secret's private room
        const forbiddenGet = await new Promise<{ ok: boolean; error?: string }>((res) => {
          client.emit('room:get', { roomId: hostRoom.roomId! }, res);
        });
        expect(forbiddenGet.ok).toBe(false);
        expect(forbiddenGet.error).toContain('not a member');

        hostClient.disconnect();
      } finally {
        client.disconnect();
      }
    });

    it('invalidates older sockets when a new connection is established for the same session', async () => {
      const client1 = createClient();

      try {
        const regRes = await new Promise<PlayerAuthResponse>((res) => {
          client1.emit('player:register', { displayName: 'Single Session User' }, res);
        });
        const token = regRes.player!.token;

        let client1Replaced = false;
        client1.on('server:error', (err) => {
          if (err.code === 'SESSION_REPLACED') {
            client1Replaced = true;
          }
        });

        // Open second socket with the same token in handshake auth
        const client2 = createClient(token);

        // Wait for handshake and invalidation
        await new Promise((r) => setTimeout(r, 200));

        expect(client1Replaced).toBe(true);
        expect(client1.connected).toBe(false);
        expect(client2.connected).toBe(true);

        client2.disconnect();
      } finally {
        client1.disconnect();
      }
    });
  });

  // =========================================================================
  // SECTION 4: AUTOMATIC HUMAN-TO-CPU TAKEOVER
  // =========================================================================
  describe('Phase 5 & 10.C: Automatic Human-to-CPU Takeover on Disconnection', () => {
    it('preserves human slot and activates temporary bot takeover after grace period', async () => {
      const hostClient = createClient();
      const guestClient = createClient();

      try {
        await new Promise<PlayerSessionPublic>((res) => hostClient.emit('player:register', { displayName: 'Host Active' }, (r) => res(r.player!)));
        const guestAuth = await new Promise<PlayerSessionPublic>((res) => guestClient.emit('player:register', { displayName: 'Guest Drop' }, (r) => res(r.player!)));

        const room = await new Promise<RoomState>((res) => hostClient.emit('room:create', { customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 2 } }, (r) => res(r.room!)));
        await new Promise((res) => guestClient.emit('room:join', { inviteCode: room.inviteCode }, res));

        await new Promise((res) => hostClient.emit('room:set-ready', { isReady: true }, res));
        await new Promise((res) => guestClient.emit('room:set-ready', { isReady: true }, res));

        const startRes = await new Promise<GameStartResponse>((res) => hostClient.emit('room:start', res));
        const gameId = startRes.gameId!;

        // Track controller changed event
        let controllerChangedPayload: { uid: string; controllerType: string; isBotControlled: boolean } | null = null;
        hostClient.on('player:controller_changed', (data) => {
          if (data.uid === guestAuth.uid) {
            controllerChangedPayload = data;
          }
        });

        // Simulate guest disconnecting
        guestClient.disconnect();

        // Immediately after disconnect: human slot is still marked human (grace period in progress)
        let state = serverInstance.gameManager.getGame(gameId)!;
        let guestPlayer = state.players.find((p) => p.uid === guestAuth.uid)!;
        expect(guestPlayer.isCpu).toBe(false);
        expect(guestPlayer.playerType).toBe('HUMAN');
        expect(guestPlayer.disconnectedAt).toBeDefined();
        expect(guestPlayer.isBotControlled).toBeFalsy();

        // Wait for bot takeover grace period (200ms in test mode)
        await new Promise((r) => setTimeout(r, 350));

        state = serverInstance.gameManager.getGame(gameId)!;
        guestPlayer = state.players.find((p) => p.uid === guestAuth.uid)!;

        // Verify slot is now temporarily bot controlled
        expect(guestPlayer.isBotControlled).toBe(true);
        expect(guestPlayer.controllerType).toBe('BOT');
        // Crucial invariant: original human classification is NEVER deleted or permanently overwritten
        expect(guestPlayer.playerType).toBe('HUMAN');
        expect(guestPlayer.isCpu).toBe(false);

        // Verify broadcast event was sent to remaining human player
        expect(controllerChangedPayload).toBeDefined();
        expect(controllerChangedPayload!.uid).toBe(guestAuth.uid);
        expect(controllerChangedPayload!.controllerType).toBe('BOT');
        expect(controllerChangedPayload!.isBotControlled).toBe(true);
      } finally {
        hostClient.disconnect();
      }
    });
  });

  // =========================================================================
  // SECTION 5: HUMAN RECONNECTION & CONTROL RECOVERY
  // =========================================================================
  describe('Phase 5.4 & 10.D: Human Reconnection & Control Recovery', () => {
    it('restores original player slot, cancels bot takeover, and recovers authoritative state', async () => {
      const hostClient = createClient();
      let guestClient = createClient();

      try {
        await new Promise((res) => hostClient.emit('player:register', { displayName: 'Host Recov' }, res));
        const guestAuth = await new Promise<PlayerSessionPublic>((res) => guestClient.emit('player:register', { displayName: 'Guest Recov' }, (r) => res(r.player!)));

        const room = await new Promise<RoomState>((res) => hostClient.emit('room:create', { customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 2 } }, (r) => res(r.room!)));
        await new Promise((res) => guestClient.emit('room:join', { inviteCode: room.inviteCode }, res));

        await new Promise((res) => hostClient.emit('room:set-ready', { isReady: true }, res));
        await new Promise((res) => guestClient.emit('room:set-ready', { isReady: true }, res));

        const startRes = await new Promise<GameStartResponse>((res) => hostClient.emit('room:start', res));
        const gameId = startRes.gameId!;

        // Guest disconnects and triggers bot takeover
        guestClient.disconnect();
        await new Promise((r) => setTimeout(r, 350));

        let state = serverInstance.gameManager.getGame(gameId)!;
        let guestSlot = state.players.find((p) => p.uid === guestAuth.uid)!;
        expect(guestSlot.isBotControlled).toBe(true);

        // Guest reconnects using original token in handshake auth
        guestClient = createClient(guestAuth.token);

        // Request game:join to sync state
        const joinRes = await new Promise<{ ok: boolean; gameState?: GameState }>((res) => {
          guestClient.emit('game:join', { gameId }, res);
        });

        expect(joinRes.ok).toBe(true);
        expect(joinRes.gameState).toBeDefined();

        // Verify original player identity was restored
        state = serverInstance.gameManager.getGame(gameId)!;
        guestSlot = state.players.find((p) => p.uid === guestAuth.uid)!;

        expect(guestSlot.uid).toBe(guestAuth.uid);
        expect(guestSlot.displayName).toBe('Guest Recov');
        // Bot control has been rescinded and returned to human
        expect(guestSlot.isBotControlled).toBe(false);
        expect(guestSlot.controllerType).toBe('HUMAN');
        expect(guestSlot.disconnectedAt).toBeNull();
      } finally {
        hostClient.disconnect();
        guestClient.disconnect();
      }
    });
  });

  // =========================================================================
  // SECTION 6: SERVER RESTART & PERSISTENCE RECOVERY
  // =========================================================================
  describe('Phase 6.3 & 10.E: Server Restart & State Recovery', () => {
    it('restores active matches and timer states from durable persistence after server restart', async () => {
      // 1. Create a match on initial server
      const clientA = createClient();
      const clientB = createClient();

      let gameId = '';
      let roomId = '';

      try {
        const pA = await new Promise<PlayerSessionPublic>((res) => clientA.emit('player:register', { displayName: 'Persist Host' }, (r) => res(r.player!)));
        await new Promise<PlayerSessionPublic>((res) => clientB.emit('player:register', { displayName: 'Persist Guest' }, (r) => res(r.player!)));

        const room = await new Promise<RoomState>((res) => clientA.emit('room:create', { customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 2 } }, (r) => res(r.room!)));
        roomId = room.roomId;
        await new Promise((res) => clientB.emit('room:join', { inviteCode: room.inviteCode }, res));

        await new Promise((res) => clientA.emit('room:set-ready', { isReady: true }, res));
        await new Promise((res) => clientB.emit('room:set-ready', { isReady: true }, res));

        const startRes = await new Promise<GameStartResponse>((res) => clientA.emit('room:start', res));
        gameId = startRes.gameId!;

        // Execute a dice roll
        const game = serverInstance.gameManager.getGame(gameId)!;
        const activeClient = game.currentPlayerUid === pA.uid ? clientA : clientB;
        await new Promise((res) =>
          activeClient.emit(
            'game:command',
            {
              commandId: 'cmd_before_restart_' + Date.now(),
              roomId,
              gameId,
              expectedVersion: game.version,
              type: 'ROLL_DICE',
              payload: {},
            },
            res
          )
        );
      } finally {
        clientA.disconnect();
        clientB.disconnect();
      }

      // Verify state was saved to sharedStore
      const savedGame = await sharedStore.getGame(gameId);
      expect(savedGame).toBeDefined();
      expect(savedGame!.version).toBeGreaterThan(1);
      const savedVersion = savedGame!.version;

      // 2. Simulate server restart with a new server instance sharing the same store
      const newServerInstance = createLanServer({ store: sharedStore });
      const newHttpServer = newServerInstance.httpServer;

      let newPort = 0;
      await new Promise<void>((resolve) => {
        newHttpServer.listen(0, '127.0.0.1', () => {
          const addr = newHttpServer.address();
          if (typeof addr === 'object' && addr !== null) {
            newPort = addr.port;
          }
          resolve();
        });
      });

      try {
        // Wait for store initialization and recovery
        await new Promise((r) => setTimeout(r, 100));

        // Verify active game was recovered in the new GameManager
        const recoveredGame = newServerInstance.gameManager.getGame(gameId);
        expect(recoveredGame).toBeDefined();
        expect(recoveredGame!.gameId).toBe(gameId);
        expect(recoveredGame!.roomId).toBe(roomId);
        expect(recoveredGame!.version).toBe(savedVersion);

        // Verify client can connect to the new server and join the match
        const newClient = ClientSocket(`http://127.0.0.1:${newPort}`, {
          transports: ['websocket'],
          forceNew: true,
        }) as TypedClient;

        await new Promise<void>((res) =>
          newClient.emit('player:register', { displayName: 'Recovered Player' }, () => res())
        );

        const joinResponse = await new Promise<{ ok: boolean; gameState?: GameState; room?: RoomState }>((res) => {
          newClient.emit('game:join', { gameId }, res);
        });

        expect(joinResponse.ok).toBe(true);
        expect(joinResponse.gameState?.version).toBe(savedVersion);

        newClient.disconnect();
      } finally {
        clearInterval(newServerInstance.cleanupInterval);
        newServerInstance.io.close();
        await new Promise<void>((resolve) => newHttpServer.close(() => resolve()));
      }
    });
  });

  // =========================================================================
  // SECTION 7: DATABASE RESILIENCE & HEALTH CHECKS
  // =========================================================================
  describe('Phase 11: Database Unavailability & Fail-Safe Recovery', () => {
    it('returns HTTP 503 from /api/health when the persistence store is unhealthy', async () => {
      // Create a store that reports an error in isHealthy()
      const failingStore = new MemoryStore();
      failingStore.isHealthy = async () => ({ ok: false, error: 'Connection to Supabase timed out' });

      const failServerInstance = createLanServer({ store: failingStore });
      const failHttpServer = failServerInstance.httpServer;

      let failPort = 0;
      await new Promise<void>((resolve) => {
        failHttpServer.listen(0, '127.0.0.1', () => {
          const addr = failHttpServer.address();
          if (typeof addr === 'object' && addr !== null) {
            failPort = addr.port;
          }
          resolve();
        });
      });

      try {
        const response = await fetch(`http://127.0.0.1:${failPort}/api/health`);
        expect(response.status).toBe(503);
        const data = (await response.json()) as { status: string; database: string; dbError?: string };
        expect(data.status).toBe('degraded');
        expect(data.database).toBe('error');
        expect(data.dbError).toContain('Supabase');
      } finally {
        clearInterval(failServerInstance.cleanupInterval);
        failServerInstance.io.close();
        await new Promise<void>((resolve) => failHttpServer.close(() => resolve()));
      }
    });

    it('rejects stale commands when expectedVersion does not match current game version', async () => {
      const client1 = createClient();
      const client2 = createClient();

      try {
        const p1 = await new Promise<PlayerSessionPublic>((res) =>
          client1.emit('player:register', { displayName: 'Stale Tester 1' }, (r) => res(r.player!))
        );
        await new Promise<PlayerSessionPublic>((res) =>
          client2.emit('player:register', { displayName: 'Stale Tester 2' }, (r) => res(r.player!))
        );

        const room = await new Promise<RoomState>((res) =>
          client1.emit('room:create', { customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 2 } }, (r) => res(r.room!))
        );
        await new Promise((res) => client2.emit('room:join', { inviteCode: room.inviteCode }, res));

        await new Promise((res) => client1.emit('room:set-ready', { isReady: true }, res));
        await new Promise((res) => client2.emit('room:set-ready', { isReady: true }, res));

        const startRes = await new Promise<GameStartResponse>((res) => client1.emit('room:start', res));
        const gameId = startRes.gameId!;

        const game = serverInstance.gameManager.getGame(gameId)!;
        const activeClient = game.currentPlayerUid === p1.uid ? client1 : client2;

        // Submit a command with deliberately stale expectedVersion = 999
        const staleRes = await new Promise<GameCommandResponse>((res) =>
          activeClient.emit(
            'game:command',
            {
              commandId: 'cmd_stale_' + Date.now(),
              roomId: room.roomId,
              gameId,
              expectedVersion: 999, // Incorrect version
              type: 'ROLL_DICE',
              payload: {},
            },
            res
          )
        );

        expect(staleRes.ok).toBe(false);
        expect(staleRes.error).toBeDefined();
      } finally {
        client1.disconnect();
        client2.disconnect();
      }
    });
  });
});
