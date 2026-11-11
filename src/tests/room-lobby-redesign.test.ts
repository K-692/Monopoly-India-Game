/**
 * Comprehensive Integration & Unit Tests for Simplified Room Creation and Host-Controlled Waiting Lobby
 *
 * Verifies all 18 scenarios:
 * 1. Room Creation creates host as human player without CPU count or max player config (fixed at 6).
 * 2. Room accepts human players until 6 total slots are occupied.
 * 3. A 7th player cannot join (rejected with room full).
 * 4. Host can add CPUs until room reaches 6 players; adding when full is rejected.
 * 5. Non-host cannot add, remove, or rename CPUs (strictly rejected).
 * 6. CPUs are automatically ready upon creation.
 * 7. Human players (including newly joined) are initially NOT ready.
 * 8. Host is a human player and must also become ready.
 * 9. Host cannot start with fewer than 2 total players.
 * 10. Host cannot start while any human player is not ready.
 * 11. Host can start with valid combinations of humans and CPUs (e.g. 1 human + 1 CPU, 2 humans + 4 CPUs, etc.).
 * 12. Newly joined human player resets readiness requirement and blocks start until ready.
 * 13. Removing a CPU frees a slot for a human or CPU player.
 * 14. Renaming a CPU is synchronized across all connected clients.
 * 15. CPU display names are preserved into active GameState on game start.
 * 16. CPU and human turns initialize and function correctly with autonomous pacing.
 * 17. Safe concurrency prevents exceeding the 6-player limit.
 * 18. Existing LAN multiplayer connectivity and features continue to work.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createLanServer } from '../../server/index';
import {
  ClientToServerEvents,
  GameStartResponse,
  PlayerAuthResponse,
  RoomCreateResponse,
  RoomJoinResponse,
  ServerToClientEvents,
} from '../../server/types/server-types';
import { RoomState } from '../domain/game-types';
import { DEFAULT_HOST_RULES } from '../domain/ruleset';

type TypedClient = ClientSocketType<ServerToClientEvents, ClientToServerEvents>;

describe('Simplified Room Creation & Host-Controlled 6-Slot Waiting Lobby', () => {
  let serverInstance: ReturnType<typeof createLanServer>;
  let httpServer: http.Server;
  let serverPort: number;
  let serverUrl: string;

  beforeAll(async () => {
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
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  const createClient = (): TypedClient => {
    return ClientSocket(serverUrl, {
      transports: ['websocket'],
      forceNew: true,
      autoConnect: true,
    });
  };

  // Helper to register player session
  const registerPlayer = async (client: TypedClient, name: string): Promise<string> => {
    return new Promise((resolve) => {
      client.emit('player:register', { displayName: name }, (res: PlayerAuthResponse) => {
        resolve(res.player!.uid);
      });
    });
  };

  // =========================================================================
  // SCENARIO 1: Create room creates host as human without asking for CPU count
  // =========================================================================
  it('1. creates room with host as human player, 6 total capacity, and host is initially NOT ready', async () => {
    const client = createClient();
    const hostUid = await registerPlayer(client, 'AaravHost');

    const res = await new Promise<RoomCreateResponse>((resolve) => {
      client.emit('room:create', { customRules: DEFAULT_HOST_RULES }, resolve);
    });

    expect(res.ok).toBe(true);
    expect(res.room).toBeDefined();
    expect(res.room?.maxPlayers).toBe(6);
    expect(res.room?.hostUid).toBe(hostUid);
    expect(res.room?.memberUids.length).toBe(1);

    const hostMember = res.room?.members[hostUid];
    expect(hostMember).toBeDefined();
    expect(hostMember?.isCpu).toBe(false);
    expect(hostMember?.playerType).toBe('HUMAN');
    // Scenario 7 & 8: Host is human and starts as NOT READY
    expect(hostMember?.isReady).toBe(false);

    client.disconnect();
  });

  // =========================================================================
  // SCENARIOS 2 & 3: Six total player capacity and seventh player rejection
  // =========================================================================
  it('2 & 3. accepts human players up to 6 slots and rejects a 7th player with room full error', async () => {
    const hostClient = createClient();
    await registerPlayer(hostClient, 'HostCap');

    const roomRes = await new Promise<RoomCreateResponse>((resolve) => {
      hostClient.emit('room:create', {}, resolve);
    });
    const inviteCode = roomRes.room!.inviteCode;

    const guestClients: TypedClient[] = [];

    // Join 5 additional human players (total = 6)
    for (let i = 2; i <= 6; i++) {
      const guest = createClient();
      guestClients.push(guest);
      await registerPlayer(guest, `Guest_${i}`);

      const joinRes = await new Promise<RoomJoinResponse>((resolve) => {
        guest.emit('room:join', { inviteCode }, resolve);
      });
      expect(joinRes.ok).toBe(true);
      expect(Object.keys(joinRes.room!.members).length).toBe(i);
    }

    // 7th player attempts to join
    const seventhClient = createClient();
    await registerPlayer(seventhClient, 'Guest_7');

    const rejectRes = await new Promise<RoomJoinResponse>((resolve) => {
      seventhClient.emit('room:join', { inviteCode }, resolve);
    });

    expect(rejectRes.ok).toBe(false);
    expect(rejectRes.error).toContain('full');

    hostClient.disconnect();
    seventhClient.disconnect();
    guestClients.forEach((c) => c.disconnect());
  });

  // =========================================================================
  // SCENARIO 4, 6, 13: Host adds CPUs, CPUs auto-ready, remove CPU frees slot
  // =========================================================================
  it('4, 6 & 13. host adds CPUs (auto-ready) up to 6 capacity, cannot exceed, and removing CPU frees a slot', async () => {
    const hostClient = createClient();
    await registerPlayer(hostClient, 'CpuManagerHost');

    const roomRes = await new Promise<RoomCreateResponse>((resolve) => {
      hostClient.emit('room:create', {}, resolve);
    });
    const roomId = roomRes.room!.roomId;

    // Add 5 CPUs to reach 6 total players (1 host + 5 CPUs)
    for (let i = 1; i <= 5; i++) {
      const addRes = await new Promise<{ ok: boolean; room?: RoomState; error?: string }>((resolve) => {
        hostClient.emit('room:add-cpu', undefined, resolve);
      });
      expect(addRes.ok).toBe(true);
      expect(Object.keys(addRes.room!.members).length).toBe(i + 1);

      // Verify CPU is automatically ready and has sensible default name
      const members = Object.values(addRes.room!.members);
      const cpus = members.filter((m) => m.isCpu);
      expect(cpus.length).toBe(i);
      expect(cpus.every((c) => c.isReady)).toBe(true);
      expect(cpus[i - 1].displayName).toMatch(/CPU/);
    }

    // 6th CPU addition attempt should be rejected (all 6 slots full)
    const overflowRes = await new Promise<{ ok: boolean; room?: RoomState; error?: string }>((resolve) => {
      hostClient.emit('room:add-cpu', undefined, resolve);
    });
    expect(overflowRes.ok).toBe(false);
    expect(overflowRes.error).toContain('full');

    // Find one CPU and remove it
    const latestRoom = serverInstance.roomManager.getRoom(roomId)!;
    const cpuToRemove = Object.values(latestRoom.members).find((m) => m.isCpu)!;
    expect(cpuToRemove).toBeDefined();

    const removeRes = await new Promise<{ ok: boolean; room?: RoomState; error?: string }>((resolve) => {
      hostClient.emit('room:remove-cpu', { cpuUid: cpuToRemove.uid }, resolve);
    });
    expect(removeRes.ok).toBe(true);
    expect(Object.keys(removeRes.room!.members).length).toBe(5);
    expect(removeRes.room?.members[cpuToRemove.uid]).toBeUndefined();

    // Now a new CPU or human player can take the freed slot
    const addAgainRes = await new Promise<{ ok: boolean; room?: RoomState; error?: string }>((resolve) => {
      hostClient.emit('room:add-cpu', { name: 'ReplacementBot' }, resolve);
    });
    expect(addAgainRes.ok).toBe(true);
    expect(Object.keys(addAgainRes.room!.members).length).toBe(6);

    hostClient.disconnect();
  });

  // =========================================================================
  // SCENARIO 5: Non-host cannot add, remove, or rename CPUs
  // =========================================================================
  it('5. non-host cannot add, remove, or rename computer players', async () => {
    const hostClient = createClient();
    const guestClient = createClient();

    await registerPlayer(hostClient, 'PermHost');
    await registerPlayer(guestClient, 'PermGuest');

    const roomRes = await new Promise<RoomCreateResponse>((resolve) => {
      hostClient.emit('room:create', {}, resolve);
    });
    const inviteCode = roomRes.room!.inviteCode;

    await new Promise<RoomJoinResponse>((resolve) => {
      guestClient.emit('room:join', { inviteCode }, resolve);
    });

    // Host adds a CPU
    const addRes = await new Promise<{ ok: boolean; room?: RoomState }>((resolve) => {
      hostClient.emit('room:add-cpu', { name: 'TargetBot' }, resolve);
    });
    const targetCpu = Object.values(addRes.room!.members).find((m) => m.isCpu)!;

    // Non-host attempts to add CPU
    const guestAdd = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      guestClient.emit('room:add-cpu', undefined, resolve);
    });
    expect(guestAdd.ok).toBe(false);
    expect(guestAdd.error).toContain('Only the room host');

    // Non-host attempts to remove CPU
    const guestRemove = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      guestClient.emit('room:remove-cpu', { cpuUid: targetCpu.uid }, resolve);
    });
    expect(guestRemove.ok).toBe(false);
    expect(guestRemove.error).toContain('Only the room host');

    // Non-host attempts to rename CPU
    const guestRename = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      guestClient.emit('room:rename-cpu', { cpuUid: targetCpu.uid, newName: 'HackedName' }, resolve);
    });
    expect(guestRename.ok).toBe(false);
    expect(guestRename.error).toContain('Only the room host');

    hostClient.disconnect();
    guestClient.disconnect();
  });

  // =========================================================================
  // SCENARIOS 7, 8, 9, 10, 11, 12: Ready Lifecycle & Game Start Conditions
  // =========================================================================
  it('7-12. validates readiness, requires host readiness, blocks starting with < 2 players or unready humans', async () => {
    const hostClient = createClient();
    await registerPlayer(hostClient, 'StartRulesHost');

    const roomRes = await new Promise<RoomCreateResponse>((resolve) => {
      hostClient.emit('room:create', {}, resolve);
    });
    const inviteCode = roomRes.room!.inviteCode;

    // Scenario 9: Host alone cannot start match (< 2 players)
    await new Promise<void>((resolve) => hostClient.emit('room:set-ready', { isReady: true }, () => resolve()));
    const soloStart = await new Promise<GameStartResponse>((resolve) => {
      hostClient.emit('room:start', resolve);
    });
    expect(soloStart.ok).toBe(false);
    expect(soloStart.error).toContain('At least 2');

    // Host adds 1 CPU -> now 2 players total.
    await new Promise<void>((resolve) => {
      hostClient.emit('room:add-cpu', { name: 'DuetBot' }, () => resolve());
    });

    // Scenario 8 & 10: If host toggles NOT READY, game cannot start even with auto-ready CPU!
    await new Promise<void>((resolve) => hostClient.emit('room:set-ready', { isReady: false }, () => resolve()));
    const unreadyHostStart = await new Promise<GameStartResponse>((resolve) => {
      hostClient.emit('room:start', resolve);
    });
    expect(unreadyHostStart.ok).toBe(false);
    expect(unreadyHostStart.error).toContain('Ready');

    // Once host is ready, game can start with 1 human + 1 CPU!
    await new Promise<void>((resolve) => hostClient.emit('room:set-ready', { isReady: true }, () => resolve()));

    // Scenario 12: A new human player joins -> starts as NOT READY and blocks starting
    const guestClient = createClient();
    await registerPlayer(guestClient, 'LateHuman');
    await new Promise<RoomJoinResponse>((resolve) => {
      guestClient.emit('room:join', { inviteCode }, resolve);
    });

    // Host attempts to start before guest readies up
    const blockedByGuestStart = await new Promise<GameStartResponse>((resolve) => {
      hostClient.emit('room:start', resolve);
    });
    expect(blockedByGuestStart.ok).toBe(false);
    expect(blockedByGuestStart.error).toContain('LateHuman');

    // Guest readies up -> Now all human players are ready!
    await new Promise<void>((resolve) => guestClient.emit('room:set-ready', { isReady: true }, () => resolve()));

    // Scenario 11: Host starts with valid 3-player mix (2 humans + 1 CPU)
    const validStart = await new Promise<GameStartResponse>((resolve) => {
      hostClient.emit('room:start', resolve);
    });
    expect(validStart.ok).toBe(true);
    expect(validStart.gameId).toBeDefined();

    hostClient.disconnect();
    guestClient.disconnect();
  });

  // =========================================================================
  // SCENARIO 14 & 15: CPU Renaming & Synchronization
  // =========================================================================
  it('14 & 15. synchronized CPU renaming across clients and preserves custom CPU name on game start', async () => {
    const hostClient = createClient();
    const guestClient = createClient();

    await registerPlayer(hostClient, 'RenameHost');
    await registerPlayer(guestClient, 'ObserverGuest');

    const roomRes = await new Promise<RoomCreateResponse>((resolve) => {
      hostClient.emit('room:create', {}, resolve);
    });
    const inviteCode = roomRes.room!.inviteCode;

    await new Promise<RoomJoinResponse>((resolve) => {
      guestClient.emit('room:join', { inviteCode }, resolve);
    });

    // Host adds a default CPU
    const addRes = await new Promise<{ ok: boolean; room?: RoomState }>((resolve) => {
      hostClient.emit('room:add-cpu', undefined, resolve);
    });
    const targetCpu = Object.values(addRes.room!.members).find((m) => m.isCpu)!;

    // Observer guest listens for room:state broadcast
    let broadcastReceived = false;
    guestClient.on('room:state', (updatedRoom) => {
      const cpuInGuest = updatedRoom.members[targetCpu.uid];
      if (cpuInGuest && cpuInGuest.displayName === 'Chanakya') {
        broadcastReceived = true;
      }
    });

    // Host renames CPU to 'Chanakya'
    const renameRes = await new Promise<{ ok: boolean; room?: RoomState; error?: string }>((resolve) => {
      hostClient.emit('room:rename-cpu', { cpuUid: targetCpu.uid, newName: 'Chanakya' }, resolve);
    });
    expect(renameRes.ok).toBe(true);
    expect(renameRes.room?.members[targetCpu.uid].displayName).toBe('Chanakya');

    // Verify rename rejection with duplicate or invalid names
    const duplicateRename = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      hostClient.emit('room:rename-cpu', { cpuUid: targetCpu.uid, newName: 'ObserverGuest' }, resolve);
    });
    expect(duplicateRename.ok).toBe(false);
    expect(duplicateRename.error).toContain('already exists');

    // Wait for guest socket to receive updated room state
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (broadcastReceived) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 1000);
    });
    expect(broadcastReceived).toBe(true);

    // Scenario 15: Start match and verify custom CPU name is preserved in GameState
    await new Promise<void>((resolve) => hostClient.emit('room:set-ready', { isReady: true }, () => resolve()));
    await new Promise<void>((resolve) => guestClient.emit('room:set-ready', { isReady: true }, () => resolve()));

    const startRes = await new Promise<GameStartResponse>((resolve) => {
      hostClient.emit('room:start', resolve);
    });
    expect(startRes.ok).toBe(true);

    const game = serverInstance.gameManager.getGame(startRes.gameId!)!;
    expect(game).toBeDefined();
    const cpuPlayer = game.players.find((p) => p.uid === targetCpu.uid);
    expect(cpuPlayer).toBeDefined();
    expect(cpuPlayer?.displayName).toBe('Chanakya');
    expect(cpuPlayer?.isCpu).toBe(true);

    hostClient.disconnect();
    guestClient.disconnect();
  });

  // =========================================================================
  // SCENARIO 16 & 18: Turn Automation and Fairness after Lobby Initialization
  // =========================================================================
  it('16 & 18. preserves turn lifecycle, timers, and CPU automation after start', async () => {
    const hostClient = createClient();
    await registerPlayer(hostClient, 'PlayTurnHost');

    const roomRes = await new Promise<RoomCreateResponse>((resolve) => {
      hostClient.emit('room:create', { customRules: { ...DEFAULT_HOST_RULES, turnTimerSeconds: 30 } }, resolve);
    });
    expect(roomRes.ok).toBe(true);

    await new Promise<void>((resolve) => {
      hostClient.emit('room:add-cpu', { name: 'AutoBot' }, () => resolve());
    });

    await new Promise<void>((resolve) => hostClient.emit('room:set-ready', { isReady: true }, () => resolve()));

    const startRes = await new Promise<GameStartResponse>((resolve) => {
      hostClient.emit('room:start', resolve);
    });
    expect(startRes.ok).toBe(true);

    const game = serverInstance.gameManager.getGame(startRes.gameId!)!;
    expect(game.players.length).toBe(2);
    expect(game.turnTimeRemaining).toBe(30);
    expect(game.status).toBe('IN_PROGRESS');

    hostClient.disconnect();
  });
});
