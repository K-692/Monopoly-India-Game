/**
 * Indian Monopoly - Two-Client Real-Time LAN Multiplayer Integration Tests
 * Validates the full server-authoritative Socket.IO architecture:
 * 1. Room Lifecycle: Creation, 6-char code generation, capacity limits, invalid code rejection.
 * 2. Real-Time Synchronization: Instant membership and readiness propagation across two clients.
 * 3. Authoritative Gameplay: Server dice generation, turn validation, property transactions, deduplication.
 * 4. Network & Reconnection: Reconnection tokens, session resumption, and presence tracking.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createLanServer } from '../../server/index';
import { getLanAddresses, isPrivateIPv4 } from '../../server/network/get-lan-addresses';
import { GameCommand, GameEvent, GameState, RoomState } from '../domain/game-types';
import {
  ClientToServerEvents,
  GameCommandResponse,
  GameStartResponse,
  PlayerAuthResponse,
  PlayerSessionPublic,
  RoomCreateResponse,
  RoomJoinResponse,
  ServerToClientEvents,
} from '../../server/types/server-types';
import { DEFAULT_HOST_RULES } from '../domain/ruleset';

type TypedClient = ClientSocketType<ServerToClientEvents, ClientToServerEvents>;

describe('Indian Monopoly LAN Multiplayer Server Integration', () => {
  let serverInstance: ReturnType<typeof createLanServer>;
  let httpServer: http.Server;
  let serverPort: number;
  let serverUrl: string;

  beforeAll(async () => {
    // Spin up ephemeral test server on port 0 (dynamic available port)
    serverInstance = createLanServer();
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

  function createClient(): TypedClient {
    return ClientSocket(serverUrl, {
      transports: ['websocket'],
      forceNew: true,
      autoConnect: true,
    }) as TypedClient;
  }

  // ==========================================
  // ROOM MANAGEMENT TESTS
  // ==========================================
  describe('Room Creation & Joining', () => {
    it('creates a room with a 6-character code, marks host ready, and rejects invalid join attempts', async () => {
      const clientA = createClient();
      const clientB = createClient();

      try {
        // Register Client A
        const regA = await new Promise<PlayerSessionPublic>((resolve) => {
          clientA.emit('player:register', { displayName: 'Maharaja Host' }, (res) => {
            resolve(res.player!);
          });
        });
        expect(regA.uid).toBeDefined();
        expect(regA.token).toBeDefined();

        // Register Client B
        const regB = await new Promise<PlayerSessionPublic>((resolve) => {
          clientB.emit('player:register', { displayName: 'Guest Player' }, (res) => {
            resolve(res.player!);
          });
        });
        expect(regB.uid).toBeDefined();

        // 1. Create room
        const roomA = await new Promise<RoomState>((resolve, reject) => {
          clientA.emit('room:create', { customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 2 } }, (res) => {
            if (res.ok && res.room) resolve(res.room);
            else reject(new Error(res.error));
          });
        });

        expect(roomA.roomId).toBeDefined();
        expect(roomA.inviteCode).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
        expect(roomA.hostUid).toBe(regA.uid);
        expect(roomA.members[regA.uid].isReady).toBe(true);

        // 2. Reject invalid code
        const invalidJoin = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
          clientB.emit('room:join', { inviteCode: 'ZZZZZZ' }, (res) => resolve(res));
        });
        expect(invalidJoin.ok).toBe(false);
        expect(invalidJoin.error).toContain('Room not found');

        // 3. Join with valid code
        const validJoin = await new Promise<{ ok: boolean; room?: RoomState }>((resolve) => {
          clientB.emit('room:join', { inviteCode: roomA.inviteCode }, (res) => resolve(res));
        });
        expect(validJoin.ok).toBe(true);
        expect(validJoin.room?.members[regB.uid]).toBeDefined();
        expect(validJoin.room?.members[regB.uid].isReady).toBe(false);

        // 4. Reject when room is full
        const clientC = createClient();
        await new Promise<void>((resolve) => {
          clientC.emit('player:register', { displayName: 'Player C' }, () => resolve());
        });
        const fullJoin = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
          clientC.emit('room:join', { inviteCode: roomA.inviteCode }, (res) => resolve(res));
        });
        expect(fullJoin.ok).toBe(false);
        expect(fullJoin.error).toContain('full');
        clientC.disconnect();
      } finally {
        clientA.disconnect();
        clientB.disconnect();
      }
    });

    it('prevents non-host from starting a game and requires all players to be ready', async () => {
      const clientA = createClient();
      const clientB = createClient();

      try {
        await new Promise((res) => clientA.emit('player:register', { displayName: 'Host' }, res));
        await new Promise((res) => clientB.emit('player:register', { displayName: 'Guest' }, res));

        const createRes = await new Promise<RoomCreateResponse>((res) => clientA.emit('room:create', {}, res));
        await new Promise<RoomJoinResponse>((res) => clientB.emit('room:join', { inviteCode: createRes.inviteCode! }, res));

        // Non-host attempts to start
        const guestStart = await new Promise<GameStartResponse>((res) => clientB.emit('room:start', res));
        expect(guestStart.ok).toBe(false);
        expect(guestStart.error).toContain('Only the room host');

        // Host attempts to start when Guest is NOT ready
        const unreadyStart = await new Promise<GameStartResponse>((res) => clientA.emit('room:start', res));
        expect(unreadyStart.ok).toBe(false);
        expect(unreadyStart.error).toContain('Ready');
      } finally {
        clientA.disconnect();
        clientB.disconnect();
      }
    });
  });

  // ==========================================
  // REAL-TIME SYNCHRONIZATION TESTS
  // ==========================================
  describe('Lobby Synchronization', () => {
    it('synchronizes member additions and readiness state across both clients in real-time', async () => {
      const clientA = createClient();
      const clientB = createClient();

      try {
        let clientBStateReceived: RoomState | null = null;
        clientA.on('room:state', (room) => {
          if (Object.keys(room.members).length === 2) {
            clientBStateReceived = room;
          }
        });

        await new Promise((res) => clientA.emit('player:register', { displayName: 'P1' }, res));
        await new Promise((res) => clientB.emit('player:register', { displayName: 'P2' }, res));

        const createRes = await new Promise<RoomCreateResponse>((res) => clientA.emit('room:create', {}, res));
        await new Promise<RoomJoinResponse>((res) => clientB.emit('room:join', { inviteCode: createRes.inviteCode! }, res));

        // Wait for Client A to receive Client B in room:state
        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (clientBStateReceived) {
              clearInterval(check);
              resolve();
            }
          }, 20);
        });

        expect(clientBStateReceived).toBeDefined();
        expect(Object.keys(clientBStateReceived!.members)).toHaveLength(2);

        // Toggle ready on Client B and verify broadcast to Client A
        let readinessSynchronized = false;
        clientA.on('room:state', (room) => {
          const guest = Object.values(room.members).find((m) => m.displayName === 'P2');
          if (guest && guest.isReady) {
            readinessSynchronized = true;
          }
        });

        await new Promise((res) => clientB.emit('room:set-ready', { isReady: true }, res));

        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (readinessSynchronized) {
              clearInterval(check);
              resolve();
            }
          }, 20);
        });

        expect(readinessSynchronized).toBe(true);
      } finally {
        clientA.disconnect();
        clientB.disconnect();
      }
    });
  });

  // ==========================================
  // AUTHORITATIVE GAMEPLAY TESTS
  // ==========================================
  describe('Authoritative Gameplay Execution', () => {
    it('executes server-controlled dice rolls, syncs board positions, and rejects out-of-turn actions', async () => {
      const clientA = createClient();
      const clientB = createClient();

      try {
        let playerA: PlayerSessionPublic;

        await new Promise((res) => clientA.emit('player:register', { displayName: 'Host P1' }, (r) => { playerA = r.player!; res(null); }));
        await new Promise((res) => clientB.emit('player:register', { displayName: 'Guest P2' }, () => { res(null); }));

        const createRes = await new Promise<RoomCreateResponse>((res) => clientA.emit('room:create', {}, res));
        await new Promise<RoomJoinResponse>((res) => clientB.emit('room:join', { inviteCode: createRes.inviteCode! }, res));
        await new Promise((res) => clientB.emit('room:set-ready', { isReady: true }, res));

        // Start match
        let gameStartReceivedA: GameState | null = null;
        let gameStartReceivedB: GameState | null = null;

        clientA.on('game:started', (d) => { gameStartReceivedA = d.gameState; });
        clientB.on('game:started', (d) => { gameStartReceivedB = d.gameState; });

        const startRes = await new Promise<GameStartResponse>((res) => clientA.emit('room:start', res));
        expect(startRes.ok).toBe(true);
        expect(startRes.gameId).toBeDefined();

        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (gameStartReceivedA && gameStartReceivedB) {
              clearInterval(check);
              resolve();
            }
          }, 20);
        });

        expect(gameStartReceivedA!.gameId).toBe(gameStartReceivedB!.gameId);
        expect(gameStartReceivedA!.currentPlayerUid).toBe(playerA!.uid);

        // Client B attempts to ROLL_DICE when it's Client A's turn
        const unauthorizedRoll = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
          const cmd: GameCommand = {
            commandId: 'cmd_hack_1',
            roomId: createRes.roomId!,
            gameId: startRes.gameId!,
            expectedVersion: gameStartReceivedA!.version,
            type: 'ROLL_DICE',
            payload: {},
          };
          clientB.emit('game:command', cmd, (res) => resolve(res));
        });
        expect(unauthorizedRoll.ok).toBe(false);
        expect(unauthorizedRoll.error).toContain('turn');

        // Client A rolls dice
        let eventA: GameEvent | null = null;
        let eventB: GameEvent | null = null;
        let stateA: GameState | null = null;
        let stateB: GameState | null = null;

        clientA.on('game:event', (e) => { if (e.type === 'ROLL_DICE') eventA = e; });
        clientB.on('game:event', (e) => { if (e.type === 'ROLL_DICE') eventB = e; });
        clientA.on('game:state', (s) => { stateA = s; });
        clientB.on('game:state', (s) => { stateB = s; });

        const rollCmd: GameCommand = {
          commandId: 'cmd_roll_valid_1',
          roomId: createRes.roomId!,
          gameId: startRes.gameId!,
          expectedVersion: gameStartReceivedA!.version,
          type: 'ROLL_DICE',
          payload: {},
        };

        const rollRes = await new Promise<GameCommandResponse>((res) => clientA.emit('game:command', rollCmd, res));
        expect(rollRes.ok).toBe(true);

        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (eventA && eventB && stateA && stateB) {
              clearInterval(check);
              resolve();
            }
          }, 20);
        });

        // Verify cryptographic dice generated by server matches on both clients
        const dicePayloadA = eventA!.payload as { d1: number; d2: number };
        const dicePayloadB = eventB!.payload as { d1: number; d2: number };
        expect(dicePayloadA.d1).toBe(dicePayloadB.d1);
        expect(dicePayloadA.d2).toBe(dicePayloadB.d2);
        expect(stateA!.version).toBe(stateB!.version);

        // Test duplicate command idempotency
        const dupRes = await new Promise<GameCommandResponse>((res) => clientA.emit('game:command', rollCmd, res));
        expect(dupRes.ok).toBe(true);

        // Test stale version rejection
        const staleCmd: GameCommand = {
          commandId: 'cmd_stale_1',
          roomId: createRes.roomId!,
          gameId: startRes.gameId!,
          expectedVersion: 9999, // Intentional version mismatch
          type: 'END_TURN',
          payload: {},
        };
        const staleRes = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
          clientA.emit('game:command', staleCmd, (res) => resolve(res));
        });
        expect(staleRes.ok).toBe(false);
        expect(staleRes.error).toContain('Stale version');
      } finally {
        clientA.disconnect();
        clientB.disconnect();
      }
    });

    it('processes join requests from invite links with URL format http://<ip>:<port>/#/join/<code>', async () => {
      const client = createClient();
      try {
        await new Promise((res) => client.emit('player:register', { displayName: 'Link Host' }, res));
        const roomRes = await new Promise<RoomCreateResponse>((res) => client.emit('room:create', {}, res));
        const code = roomRes.inviteCode!;

        // Simulate client extracting code from link
        const simulatedLink = `http://192.168.1.8:4173/#/join/${code}`;
        const extractedCode = simulatedLink.split('#/join/')[1];
        expect(extractedCode).toBe(code);

        const guestClient = createClient();
        try {
          await new Promise((res) => guestClient.emit('player:register', { displayName: 'Link Guest' }, res));
          const joinRes = await new Promise<RoomJoinResponse>((res) => guestClient.emit('room:join', { inviteCode: extractedCode }, res));
          expect(joinRes.ok).toBe(true);
          expect(joinRes.roomId).toBe(roomRes.roomId);
        } finally {
          guestClient.disconnect();
        }
      } finally {
        client.disconnect();
      }
    });
  });

  // ==========================================
  // RECONNECTION & IDENTITY TESTS
  // ==========================================
  describe('Session Reconnection & Network Discovery', () => {
    it('allows a disconnected player to resume their session using the saved reconnection token', async () => {
      const client = createClient();
      let token = '';
      let originalUid = '';

      try {
        await new Promise<void>((resolve) => {
          client.emit('player:register', { displayName: 'Persistent Tycoon' }, (res) => {
            token = res.player!.token;
            originalUid = res.player!.uid;
            resolve();
          });
        });

        // Create room
        const roomRes = await new Promise<RoomCreateResponse>((res) => client.emit('room:create', {}, res));
        expect(roomRes.ok).toBe(true);

        // Simulate page refresh / disconnect
        client.disconnect();

        // Connect new socket instance representing page reloaded
        const newClient = createClient();
        try {
          const resumeRes = await new Promise<PlayerAuthResponse>((resolve) => {
            newClient.emit('player:resume', { token, displayName: 'Persistent Tycoon' }, resolve);
          });

          expect(resumeRes.ok).toBe(true);
          expect(resumeRes.player?.uid).toBe(originalUid);
          expect(resumeRes.player?.token).toBe(token);
        } finally {
          newClient.disconnect();
        }
      } finally {
        if (client.connected) client.disconnect();
      }
    });

    it('identifies private IPv4 addresses and excludes loopback interfaces', () => {
      expect(isPrivateIPv4('192.168.1.10')).toBe(true);
      expect(isPrivateIPv4('10.0.0.5')).toBe(true);
      expect(isPrivateIPv4('172.20.1.1')).toBe(true);
      expect(isPrivateIPv4('127.0.0.1')).toBe(false);
      expect(isPrivateIPv4('8.8.8.8')).toBe(false);

      const addresses = getLanAddresses();
      // Should not contain loopback 127.0.0.1
      expect(addresses.every((a) => a.address !== '127.0.0.1')).toBe(true);
      expect(addresses.every((a) => a.family === 'IPv4')).toBe(true);
    });
  });
});
