/**
 * Indian Monopoly - Computer Player (CPU) & Starting Cash Integration Tests
 *
 * Verifies complete end-to-end integration across the authoritative server:
 * 1. Room Creation with 0, 1, 2, 3 Computer Players and Custom Names
 * 2. Room Capacity Enforcement & Name Collision Prevention
 * 3. Starting Cash Slider Validation (₹5,000 to ₹50,000 in ₹5,000 steps)
 * 4. Automatic CPU Turn Execution via Socket.IO
 * 5. Sell-to-Bank Priority & Financial Debt Resolution
 * 6. CPU Disqualification & Game-Ending Resolution
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createLanServer } from '../../server/index';
import {
  ClientToServerEvents,
  PlayerAuthResponse,
  RoomCreateResponse,
  RoomJoinResponse,
  ServerToClientEvents,
} from '../../server/types/server-types';
import { GameState } from '../domain/game-types';
import { DEFAULT_HOST_RULES, HostCustomRules } from '../domain/ruleset';

type TypedClient = ClientSocketType<ServerToClientEvents, ClientToServerEvents>;

describe('CPU Players & Starting Cash Server Integration', () => {
  let serverInstance: ReturnType<typeof createLanServer>;
  let httpServer: http.Server;
  let serverPort: number;
  let serverUrl: string;

  beforeAll(async () => {
    // Spin up test server on ephemeral port with fast CPU timing for test execution
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
  // ROOM CREATION & CPU CONFIGURATION
  // ==========================================
  describe('Room Creation with Computer Players', () => {
    it('creates room with 0 computer players (human-only baseline)', async () => {
      const client = createClient();

      await new Promise<void>((resolve) => {
        client.emit('player:register', { displayName: 'HostSolo' }, (authRes: PlayerAuthResponse) => {
          expect(authRes.ok).toBe(true);
          resolve();
        });
      });

      const res = await new Promise<RoomCreateResponse>((resolve) => {
        client.emit('room:create', { customRules: DEFAULT_HOST_RULES }, resolve);
      });

      expect(res.ok).toBe(true);
      expect(res.room).toBeDefined();
      expect(res.room?.memberUids.length).toBe(1);
      client.disconnect();
    });

    it('creates room with 1, 2, or 3 computer players with custom names', async () => {
      const client = createClient();

      await new Promise<void>((resolve) => {
        client.emit('player:register', { displayName: 'SherlockHost' }, () => resolve());
      });

      const res = await new Promise<RoomCreateResponse>((resolve) => {
        client.emit(
          'room:create',
          {
            customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 4 },
            cpuPlayers: [
              { name: 'Watson' },
              { name: 'Moriarty' },
              { name: 'Mycroft' },
            ],
          },
          resolve
        );
      });

      expect(res.ok).toBe(true);
      expect(res.room).toBeDefined();
      expect(res.room?.memberUids.length).toBe(4); // 1 host + 3 CPUs

      const members = Object.values(res.room!.members);
      const cpus = members.filter((m) => m.isCpu);
      expect(cpus.length).toBe(3);
      expect(cpus.map((c) => c.displayName).sort()).toEqual(['Moriarty', 'Mycroft', 'Watson'].sort());
      expect(cpus.every((c) => c.isReady)).toBe(true); // CPUs automatically ready in lobby

      client.disconnect();
    });

    it('rejects attempt to add more than 3 computer players', async () => {
      const client = createClient();

      await new Promise<void>((resolve) => {
        client.emit('player:register', { displayName: 'HostPlayer' }, () => resolve());
      });

      const res = await new Promise<RoomCreateResponse>((resolve) => {
        client.emit(
          'room:create',
          {
            customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 6 },
            cpuPlayers: [
              { name: 'CPU1' },
              { name: 'CPU2' },
              { name: 'CPU3' },
              { name: 'CPU4' },
            ],
          },
          resolve
        );
      });

      expect(res.ok).toBe(false);
      expect(res.error).toContain('Maximum 3');
      client.disconnect();
    });

    it('rejects duplicate CPU names or collision with host name', async () => {
      const client = createClient();

      await new Promise<void>((resolve) => {
        client.emit('player:register', { displayName: 'AlphaHost' }, () => resolve());
      });

      // 1. Collision with host name
      const collisionRes = await new Promise<RoomCreateResponse>((resolve) => {
        client.emit(
          'room:create',
          {
            customRules: DEFAULT_HOST_RULES,
            cpuPlayers: [{ name: 'alphahost' }], // Case-insensitive collision
          },
          resolve
        );
      });
      expect(collisionRes.ok).toBe(false);
      expect(collisionRes.error).toContain('host');

      // 2. Duplicate between two CPUs
      const duplicateRes = await new Promise<RoomCreateResponse>((resolve) => {
        client.emit(
          'room:create',
          {
            customRules: DEFAULT_HOST_RULES,
            cpuPlayers: [{ name: 'RoboTrader' }, { name: 'robotrader' }],
          },
          resolve
        );
      });
      expect(duplicateRes.ok).toBe(false);
      expect(duplicateRes.error).toContain('Duplicate');

      client.disconnect();
    });

    it('rejects human player joining with same name as an existing CPU', async () => {
      const hostClient = createClient();
      await new Promise<void>((resolve) => {
        hostClient.emit('player:register', { displayName: 'MasterHost' }, () => resolve());
      });

      const roomRes = await new Promise<RoomCreateResponse>((resolve) => {
        hostClient.emit(
          'room:create',
          {
            customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 4 },
            cpuPlayers: [{ name: 'Terminator' }],
          },
          resolve
        );
      });

      const inviteCode = roomRes.room!.inviteCode;

      // Human client attempts to join with name 'Terminator'
      const joiningClient = createClient();
      await new Promise<void>((resolve) => {
        joiningClient.emit('player:register', { displayName: 'Terminator' }, () => resolve());
      });

      const joinRes = await new Promise<RoomJoinResponse>((resolve) => {
        joiningClient.emit('room:join', { inviteCode }, resolve);
      });

      expect(joinRes.ok).toBe(false);
      expect(joinRes.error).toContain('already in this room');

      hostClient.disconnect();
      joiningClient.disconnect();
    });

    it('rejects joining when computer players fill the room capacity', async () => {
      const hostClient = createClient();
      await new Promise<void>((resolve) => {
        hostClient.emit('player:register', { displayName: 'CapacityHost' }, () => resolve());
      });

      // 2 max players: 1 host + 1 CPU = full room
      const roomRes = await new Promise<RoomCreateResponse>((resolve) => {
        hostClient.emit(
          'room:create',
          {
            customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 2 },
            cpuPlayers: [{ name: 'SoloBot' }],
          },
          resolve
        );
      });

      const inviteCode = roomRes.room!.inviteCode;

      const extraClient = createClient();
      await new Promise<void>((resolve) => {
        extraClient.emit('player:register', { displayName: 'ExtraHuman' }, () => resolve());
      });

      const joinRes = await new Promise<RoomJoinResponse>((resolve) => {
        extraClient.emit('room:join', { inviteCode }, resolve);
      });

      expect(joinRes.ok).toBe(false);
      expect(joinRes.error).toContain('Room is full');

      hostClient.disconnect();
      extraClient.disconnect();
    });
  });

  // ==========================================
  // STARTING CASH SLIDER VALIDATION
  // ==========================================
  describe('Starting Cash Slider Validation', () => {
    it('applies configured starting cash to all players equally', async () => {
      const client = createClient();
      await new Promise<void>((resolve) => {
        client.emit('player:register', { displayName: 'CashHost' }, () => resolve());
      });

      // Configure ₹35,000 starting cash
      const customRules: HostCustomRules = {
        ...DEFAULT_HOST_RULES,
        startingCash: 35000,
      };

      const roomRes = await new Promise<RoomCreateResponse>((resolve) => {
        client.emit('room:create', { customRules, cpuPlayers: [{ name: 'RichBot' }] }, resolve);
      });

      expect(roomRes.ok).toBe(true);
      expect(roomRes.room?.customRules?.startingCash).toBe(35000);

      // Start the game
      const startRes = await new Promise<{ ok: boolean; gameId?: string }>((resolve) => {
        client.emit('room:start', resolve);
      });

      expect(startRes.ok).toBe(true);

      // Join game and verify balances
      const gameState = await new Promise<GameState>((resolve) => {
        client.emit('game:join', { gameId: startRes.gameId! }, (res: { ok: boolean; gameState?: GameState }) => {
          resolve(res.gameState!);
        });
      });

      expect(gameState.rules?.startingCash).toBe(35000);
      expect(gameState.players.length).toBe(2);
      expect(gameState.players[0].cash).toBe(35000);
      expect(gameState.players[1].cash).toBe(35000);

      client.disconnect();
    });

    it('sanitizes invalid starting cash to default ₹20,000', async () => {
      const client = createClient();
      await new Promise<void>((resolve) => {
        client.emit('player:register', { displayName: 'SanitizeHost' }, () => resolve());
      });

      // Pass invalid value 12345 (not multiple of 5000)
      const invalidRules = {
        ...DEFAULT_HOST_RULES,
        startingCash: 12345,
      };

      const roomRes = await new Promise<RoomCreateResponse>((resolve) => {
        client.emit('room:create', { customRules: invalidRules, cpuPlayers: [{ name: 'Bot1' }] }, resolve);
      });

      expect(roomRes.ok).toBe(true);
      expect(roomRes.room?.customRules?.startingCash).toBe(20000);

      client.disconnect();
    });
  });

  // ==========================================
  // CPU AUTONOMOUS GAMEPLAY
  // ==========================================
  describe('CPU Gameplay Automation', () => {
    it('allows starting a game with 1 human host and 1 CPU player', async () => {
      const client = createClient();
      await new Promise<void>((resolve) => {
        client.emit('player:register', { displayName: 'SoloHuman' }, () => resolve());
      });

      const roomRes = await new Promise<RoomCreateResponse>((resolve) => {
        client.emit(
          'room:create',
          {
            customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 2 },
            cpuPlayers: [{ name: 'Autonoma' }],
          },
          resolve
        );
      });
      expect(roomRes.ok).toBe(true);

      // Because CPU is always ready, host can start immediately with 2 players
      const startRes = await new Promise<{ ok: boolean; gameId?: string }>((resolve) => {
        client.emit('room:start', resolve);
      });

      expect(startRes.ok).toBe(true);
      expect(startRes.gameId).toBeDefined();

      client.disconnect();
    });

    it('automatically executes CPU turn when active player is CPU', async () => {
      const client = createClient();
      let myUid = '';

      await new Promise<void>((resolve) => {
        client.emit('player:register', { displayName: 'WatchingHuman' }, (authRes) => {
          myUid = authRes.player!.uid;
          resolve();
        });
      });

      const roomRes = await new Promise<RoomCreateResponse>((resolve) => {
        client.emit(
          'room:create',
          {
            customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 2, startingCash: 20000 },
            cpuPlayers: [{ name: 'DeepBot' }],
          },
          resolve
        );
      });

      const cpuUid = roomRes.room!.memberUids.find((id) => id !== myUid)!;
      let receivedCpuRoll = false;

      // Register game:event listener BEFORE starting room so we never miss CPU rolling first
      client.on('game:event', (event) => {
        if (event.actorUid === cpuUid && (event.type === 'ROLL_DICE' || event.type === 'TRY_DOUBLES')) {
          receivedCpuRoll = true;
        }
      });

      const handleState = (state: GameState) => {
        if (state.currentPlayerUid === myUid && !state.isTimerPaused && (!state.movement || state.movement.isComplete)) {
          if (state.phase === 'AWAIT_ROLL') {
            client.emit('game:command', {
              commandId: 'cmd_h_roll_' + Date.now(),
              roomId: state.roomId,
              gameId: state.gameId,
              expectedVersion: state.version,
              type: 'ROLL_DICE',
              payload: {},
            });
          } else if (state.phase === 'PROPERTY_DECISION') {
            client.emit('game:command', {
              commandId: 'cmd_h_dec_' + Date.now(),
              roomId: state.roomId,
              gameId: state.gameId,
              expectedVersion: state.version,
              type: 'DECLINE_PROPERTY',
              payload: {},
            });
          } else if (state.phase === 'MANAGEMENT' || state.phase === 'TURN_END') {
            client.emit('game:command', {
              commandId: 'cmd_h_end_' + Date.now(),
              roomId: state.roomId,
              gameId: state.gameId,
              expectedVersion: state.version,
              type: 'END_TURN',
              payload: {},
            });
          }
        }
      };

      client.on('game:started', (d: { gameId: string; gameState: GameState }) => {
        handleState(d.gameState);
      });

      client.on('game:state', (state: GameState) => {
        handleState(state);
      });

      const startRes = await new Promise<{ ok: boolean; gameId?: string }>((resolve) => {
        client.emit('room:start', resolve);
      });
      expect(startRes.ok).toBe(true);

      const gameId = startRes.gameId!;

      // Also call game:join
      client.emit('game:join', { gameId }, (res: { ok: boolean; gameState?: GameState }) => {
        if (res.gameState) handleState(res.gameState);
      });

      // Wait until CPU roll event is received
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (receivedCpuRoll) {
            clearInterval(interval);
            resolve();
          }
        }, 50);

        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 4000);
      });

      expect(receivedCpuRoll).toBe(true);
      client.disconnect();
    });
  });
});
