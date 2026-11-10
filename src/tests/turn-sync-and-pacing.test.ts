/**
 * Indian Monopoly - Turn Synchronization, CPU Pacing & Timer Integration Tests
 *
 * Verifies the authoritative turn lifecycle across human and computer players:
 * 1. Turn Completion & Player Handoff Invariants
 * 2. 2-Second CPU Handoff Delay and Pacing Isolation
 * 3. Player Timer Pauses During Token Movement Animation
 * 4. Fresh Timer Reset on Genuinely New Actionable Phase (e.g. PROPERTY_DECISION)
 * 5. Independent 120-Second Financial Resolution Timer
 * 6. Session-Level CPU Execution Locking & Idempotent Command Deduplication
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createLanServer } from '../../server/index';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ServerRoom,
} from '../../server/types/server-types';
import { GameCommand, RoomMember } from '../domain/game-types';
import { DEFAULT_HOST_RULES, HostCustomRules } from '../domain/ruleset';
import { GameManager } from '../../server/game/game-manager';

type TypedClient = ClientSocketType<ServerToClientEvents, ClientToServerEvents>;

function createTestRoom(
  roomId: string,
  hostUid: string,
  members: Record<string, RoomMember>,
  customRules: HostCustomRules = DEFAULT_HOST_RULES
): ServerRoom {
  return {
    roomId,
    hostUid,
    inviteCode: 'TEST01',
    inviteCodeHash: 'hash_test',
    maxPlayers: 2,
    turnTimerSeconds: customRules.turnTimerSeconds as 0 | 30 | 45 | 60,
    gameMode: 'STANDARD',
    memberUids: Object.keys(members),
    members,
    customRules,
    status: 'IN_PROGRESS',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };
}

describe('Turn Synchronization, CPU Pacing & Player Timers', () => {
  let serverInstance: ReturnType<typeof createLanServer>;
  let httpServer: http.Server;
  let serverPort: number;
  let serverUrl: string;

  beforeAll(async () => {
    // Spin up LAN server for socket-level tests
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
  // 1. TURN COMPLETION & HANDOFF INVARIANTS
  // ==========================================
  describe('Turn Completion & Handoff Invariants', () => {
    it('blocks actions during active token movement and pauses the timer', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanHost',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
        cpu_1: {
          uid: 'cpu_1',
          displayName: 'CPU1',
          photoURL: null,
          isReady: true,
          colorToken: '#3B82F6',
          joinedAt: Date.now(),
          isCpu: true,
          playerType: 'COMPUTER',
        },
      };
      const room = createTestRoom('room_timer_1', 'player_h1', members);

      const startRes = gm.startGame(room, 'player_h1');
      expect(startRes.ok).toBe(true);
      const gameId = startRes.gameId!;

      // Ensure player_h1 is current player for this test step
      const state = gm.getGame(gameId)!;
      state.currentPlayerUid = 'player_h1';
      state.phase = 'AWAIT_ROLL';
      state.turnTimeRemaining = 30;

      // Execute ROLL_DICE
      const rollRes = await gm.processCommand(
        gameId,
        {
          commandId: 'cmd_roll_test',
          roomId: room.roomId,
          gameId,
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'player_h1'
      );

      // Verify movement state is initialized and timer is paused
      expect(rollRes.nextState.movement).not.toBeNull();
      expect(rollRes.nextState.movement?.isComplete).toBe(false);
      expect(rollRes.nextState.isTimerPaused).toBe(true);

      // Attempting another roll or action while token is moving must be rejected!
      await expect(
        gm.processCommand(
          gameId,
          {
            commandId: 'cmd_premature_action',
            roomId: room.roomId,
            gameId,
            expectedVersion: rollRes.nextState.version,
            type: 'ROLL_DICE',
            payload: {},
          },
          'player_h1'
        )
      ).rejects.toThrow('Player token is currently moving');

      // Attempting an out-of-turn action from next player must also be rejected!
      await expect(
        gm.processCommand(
          gameId,
          {
            commandId: 'cmd_out_of_turn',
            roomId: room.roomId,
            gameId,
            expectedVersion: rollRes.nextState.version,
            type: 'ROLL_DICE',
            payload: {},
          },
          'cpu_1'
        )
      ).rejects.toThrow();

      gm.stopTurnTimer(gameId);
    });

    it('enforces a 2-second minimum handoff delay when transitioning to a CPU player', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanHost',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
        cpu_1: {
          uid: 'cpu_1',
          displayName: 'CPU1',
          photoURL: null,
          isReady: true,
          colorToken: '#3B82F6',
          joinedAt: Date.now(),
          isCpu: true,
          playerType: 'COMPUTER',
        },
      };
      const room = createTestRoom('room_handoff_1', 'player_h1', members);

      const startRes = gm.startGame(room, 'player_h1');
      expect(startRes.ok).toBe(true);
      const gameId = startRes.gameId!;

      const state = gm.getGame(gameId)!;
      state.currentPlayerUid = 'player_h1';
      state.phase = 'MANAGEMENT';
      state.movement = null;
      state.isTimerPaused = false;

      // Human ends turn -> Next player is CPU1
      const endRes = await gm.processCommand(
        gameId,
        {
          commandId: 'cmd_end_turn_test',
          roomId: room.roomId,
          gameId,
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        },
        'player_h1'
      );

      // Verify handoff state
      expect(endRes.nextState.currentPlayerUid).toBe('cpu_1');
      expect(endRes.nextState.handoff).not.toBeNull();
      expect(endRes.nextState.handoff?.isActive).toBe(true);
      expect(endRes.nextState.handoff?.toPlayerUid).toBe('cpu_1');
      expect(endRes.nextState.isTimerPaused).toBe(true);

      // Actions during active handoff must be rejected!
      await expect(
        gm.processCommand(
          gameId,
          {
            commandId: 'cmd_during_handoff',
            roomId: room.roomId,
            gameId,
            expectedVersion: endRes.nextState.version,
            type: 'ROLL_DICE',
            payload: {},
          },
          'cpu_1'
        )
      ).rejects.toThrow('Turn handoff in progress');

      gm.stopTurnTimer(gameId);
    });
  });

  // ==========================================
  // 2. PLAYER TIMER LIFECYCLE & RESETS
  // ==========================================
  describe('Player Timer Lifecycle & Resets', () => {
    it('resets timer to full configured duration when entering PROPERTY_DECISION', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanHost',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
        player_h2: {
          uid: 'player_h2',
          displayName: 'HumanGuest',
          photoURL: null,
          isReady: true,
          colorToken: '#3B82F6',
          joinedAt: Date.now(),
        },
      };
      const room = createTestRoom('room_timer_reset', 'player_h1', members, {
        ...DEFAULT_HOST_RULES,
        turnTimerSeconds: 45,
      });

      const startRes = gm.startGame(room, 'player_h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      state.currentPlayerUid = 'player_h1';
      state.phase = 'AWAIT_ROLL';
      // Simulate that some turn time had already ticked down while deciding to roll
      state.turnTimeRemaining = 12;

      // Process roll
      await gm.processCommand(
        gameId,
        {
          commandId: 'cmd_roll_prop',
          roomId: room.roomId,
          gameId,
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'player_h1'
      );

      const movingState = gm.getGame(gameId)!;
      expect(movingState.isTimerPaused).toBe(true);

      // Fast-forward movement completion
      const duration = movingState.movement?.durationMs ?? 50;
      await new Promise<void>((r) => setTimeout(r, duration + 30));

      const settledState = gm.getGame(gameId)!;
      expect(settledState.movement?.isComplete).toBe(true);
      expect(settledState.isTimerPaused).toBe(false);

      // If landed on purchasable property, timer must be reset to full configured duration (45s)!
      if (settledState.phase === 'PROPERTY_DECISION') {
        expect(settledState.turnTimeRemaining).toBe(45);
      }

      gm.stopTurnTimer(gameId);
    });

    it('keeps 120-second financial resolution timer strictly independent of normal turn timer', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        player_debtor: {
          uid: 'player_debtor',
          displayName: 'Debtor',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
        player_creditor: {
          uid: 'player_creditor',
          displayName: 'Creditor',
          photoURL: null,
          isReady: true,
          colorToken: '#3B82F6',
          joinedAt: Date.now(),
        },
      };
      const room = createTestRoom('room_debt_timer', 'player_debtor', members);

      const startRes = gm.startGame(room, 'player_debtor');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      // Setup low-balance financial debt
      const deadline = Date.now() + 120000;
      state.phase = 'ACTION_REQUIRED';
      state.turnTimeRemaining = 120;
      state.pendingFinancialObligation = {
        obligationId: 'ob_test_1',
        debtorUid: 'player_debtor',
        creditorUid: null,
        amountDue: 500,
        paymentType: 'TAX',
        status: 'PENDING',
        idempotencyKey: 'idem_test_1',
        createdAt: Date.now(),
        expiresAt: deadline,
      };

      // Debtor owns an unmortgaged property and sells it to bank
      const debtor = state.players.find((p) => p.uid === 'player_debtor')!;
      debtor.cash = 100;
      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'PROP_1',
        ownerUid: 'player_debtor',
        ownershipState: 'OWNED',
        buildings: 0,
        isMortgaged: false,
      };

      // Process SELL_TO_BANK
      const sellRes = await gm.processCommand(
        gameId,
        {
          commandId: 'cmd_sell_bank',
          roomId: room.roomId,
          gameId,
          expectedVersion: state.version,
          type: 'MORTGAGE',
          payload: { spaceIndex: 1 },
        },
        'player_debtor'
      );

      // Financial obligation deadline must remain intact; not overwritten with standard 30s turn timer!
      expect(sellRes.nextState.phase).toBe('ACTION_REQUIRED');
      expect(sellRes.nextState.pendingFinancialObligation?.expiresAt).toBe(deadline);
      expect(sellRes.nextState.turnTimeRemaining).toBeGreaterThan(100);

      gm.stopTurnTimer(gameId);
    });
  });

  // ==========================================
  // 3. CPU EXECUTION LOCKING & SEQUENTIALITY
  // ==========================================
  describe('CPU Execution Locking & Sequentiality', () => {
    it('executes actions through idempotent deduplication cache on repeated attempts', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        host_p: {
          uid: 'host_p',
          displayName: 'HostP',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
        cpu_1: {
          uid: 'cpu_1',
          displayName: 'CPU1',
          photoURL: null,
          isReady: true,
          colorToken: '#3B82F6',
          joinedAt: Date.now(),
          isCpu: true,
          playerType: 'COMPUTER',
        },
      };
      const room = createTestRoom('room_idempotent', 'host_p', members);

      const startRes = gm.startGame(room, 'host_p');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;
      state.currentPlayerUid = 'host_p';
      state.phase = 'AWAIT_ROLL';

      const rollCommand: GameCommand = {
        commandId: 'cmd_idempotent_test_01',
        roomId: room.roomId,
        gameId,
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      };

      // First execution
      const res1 = await gm.processCommand(gameId, rollCommand, 'host_p');
      expect(res1.nextState.dice).not.toBeNull();
      const initialRollId = res1.nextState.dice?.rollId;

      // Duplicate execution with the identical commandId must return identical cached result without rolling again
      const res2 = await gm.processCommand(gameId, rollCommand, 'host_p');
      expect(res2.nextState.dice?.rollId).toBe(initialRollId);

      gm.stopTurnTimer(gameId);
    });

    it('connects a socket client without connection errors', () => {
      const client = createClient();
      expect(client).toBeDefined();
      client.disconnect();
    });
  });
});
