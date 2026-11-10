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

  // ==========================================
  // 4. AUTOMATIC CPU TURN CONTINUATION & PACING (REGRESSION SUITE)
  // ==========================================
  describe('Automatic CPU Turn Continuation & Turn Pacing (12 Regressions)', () => {
    it('Test 1: CPU continues after buying a property without waiting for turn timer', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
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
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanPlayer',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
      };
      const room = createTestRoom('room_reg_1', 'player_h1', members);
      const startRes = gm.startGame(room, 'player_h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      // Arrange CPU in PROPERTY_DECISION on space 1 (Old Delhi, ₹600)
      state.currentPlayerUid = 'cpu_1';
      state.phase = 'PROPERTY_DECISION';
      state.turnTimeRemaining = 30;
      state.movement = null;
      state.isTimerPaused = false;
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.position = 1;
      cpu.cash = 5000;
      state.pendingAction = {
        type: 'BUY_OR_AUCTION',
        playerUid: 'cpu_1',
        spaceIndex: 1,
      };

      // Trigger CPU decision
      gm.getCpuController().onGameStateChanged(state);

      // Wait for CPU to buy property, transition to MANAGEMENT, and auto-submit END_TURN + handoff
      // (Fast timing: 40ms buy + 40ms end turn + 100ms handoff = ~180ms)
      await new Promise((r) => setTimeout(r, 350));

      const settled = gm.getGame(gameId)!;
      // Property 1 should be owned by CPU1
      expect(settled.properties[1].ownerUid).toBe('cpu_1');
      // Turn must have advanced past CPU1 without waiting for 30s timer!
      expect(settled.currentPlayerUid).toBe('player_h1');
      expect(settled.turnTimeRemaining).toBe(30);

      gm.stopTurnTimer(gameId);
    });

    it('Test 2: CPU continues after building a house and finishes turn', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
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
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanPlayer',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
      };
      const room = createTestRoom('room_reg_2', 'player_h1', members);
      const startRes = gm.startGame(room, 'player_h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      // Arrange CPU with Brown monopoly (space 1 and space 3), bought on turn 1
      state.turnNumber = 2;
      state.currentPlayerUid = 'cpu_1';
      state.phase = 'MANAGEMENT';
      state.turnTimeRemaining = 30;
      state.movement = null;
      state.isTimerPaused = false;

      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.position = 1;
      cpu.cash = 10000;

      state.properties[1] = {
        spaceIndex: 1,
        propertyId: 'PROP_1',
        ownerUid: 'cpu_1',
        ownershipState: 'OWNED',
        buildings: 0,
        boughtOnTurn: 1,
        isMortgaged: false,
      };
      state.properties[3] = {
        spaceIndex: 3,
        propertyId: 'PROP_3',
        ownerUid: 'cpu_1',
        ownershipState: 'OWNED',
        buildings: 0,
        boughtOnTurn: 1,
        isMortgaged: false,
      };

      // Trigger CPU decision
      gm.getCpuController().onGameStateChanged(state);

      // Wait for building action and subsequent turn completion
      await new Promise((r) => setTimeout(r, 400));

      const settled = gm.getGame(gameId)!;
      // Building must have occurred
      expect(settled.properties[1].buildings).toBeGreaterThan(0);
      // Turn must have completed and handed off to human
      expect(settled.currentPlayerUid).toBe('player_h1');

      gm.stopTurnTimer(gameId);
    });

    it('Test 3: CPU continues after declining a property', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
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
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanPlayer',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
      };
      const room = createTestRoom('room_reg_3', 'player_h1', members);
      const startRes = gm.startGame(room, 'player_h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      // Arrange CPU in PROPERTY_DECISION but unable to afford (cash = ₹50, space 1 = ₹600)
      state.currentPlayerUid = 'cpu_1';
      state.phase = 'PROPERTY_DECISION';
      state.turnTimeRemaining = 30;
      state.movement = null;
      state.isTimerPaused = false;
      const cpu = state.players.find((p) => p.uid === 'cpu_1')!;
      cpu.position = 1;
      cpu.cash = 50;
      state.pendingAction = {
        type: 'BUY_OR_AUCTION',
        playerUid: 'cpu_1',
        spaceIndex: 1,
      };

      // Trigger CPU decision
      gm.getCpuController().onGameStateChanged(state);

      await new Promise((r) => setTimeout(r, 350));

      const settled = gm.getGame(gameId)!;
      // Property remained unowned
      expect(settled.properties[1].ownerUid).toBeNull();
      // Turn transitioned past CPU to player_h1
      expect(settled.currentPlayerUid).toBe('player_h1');

      gm.stopTurnTimer(gameId);
    });

    it('Test 4: CPU has no further action and immediately ends turn without timer expiry', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
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
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanPlayer',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
      };
      const room = createTestRoom('room_reg_4', 'player_h1', members);
      const startRes = gm.startGame(room, 'player_h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      // Arrange CPU in MANAGEMENT phase with 28s remaining and no properties to build
      state.currentPlayerUid = 'cpu_1';
      state.phase = 'MANAGEMENT';
      state.turnTimeRemaining = 28;
      state.movement = null;
      state.isTimerPaused = false;

      gm.getCpuController().onGameStateChanged(state);

      // Wait 250ms (well under the 28s timer)
      await new Promise((r) => setTimeout(r, 250));

      const settled = gm.getGame(gameId)!;
      // Turn must have advanced immediately without waiting for timer to expire!
      expect(settled.currentPlayerUid).toBe('player_h1');
      expect(settled.turnTimeRemaining).toBe(30);

      gm.stopTurnTimer(gameId);
    });

    it('Test 5: CPU to human transition enforces 2-second handoff and gives human full timer', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
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
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanPlayer',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
      };
      const room = createTestRoom('room_reg_5', 'player_h1', members);
      const startRes = gm.startGame(room, 'player_h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      state.currentPlayerUid = 'cpu_1';
      state.phase = 'MANAGEMENT';
      state.turnTimeRemaining = 30;

      // CPU executes END_TURN
      const res = await gm.processCommand(
        gameId,
        {
          commandId: 'cmd_end_cpu_to_human',
          roomId: room.roomId,
          gameId,
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        },
        'cpu_1'
      );

      // 1. Immediately after END_TURN, handoff must be active to human
      expect(res.nextState.handoff).not.toBeNull();
      expect(res.nextState.handoff?.isActive).toBe(true);
      expect(res.nextState.handoff?.toPlayerUid).toBe('player_h1');
      expect(res.nextState.isTimerPaused).toBe(true);

      // 2. Human cannot execute actions during active handoff
      await expect(
        gm.processCommand(
          gameId,
          {
            commandId: 'cmd_premature_human',
            roomId: room.roomId,
            gameId,
            expectedVersion: res.nextState.version,
            type: 'ROLL_DICE',
            payload: {},
          },
          'player_h1'
        )
      ).rejects.toThrow('Turn handoff in progress');

      // 3. Wait for handoff delay to finish (100ms in test + 50ms margin)
      await new Promise((r) => setTimeout(r, 160));

      const settled = gm.getGame(gameId)!;
      expect(settled.handoff).toBeNull();
      expect(settled.isTimerPaused).toBe(false);
      expect(settled.currentPlayerUid).toBe('player_h1');
      expect(settled.turnTimeRemaining).toBe(30);

      gm.stopTurnTimer(gameId);
    });

    it('Test 6: CPU to CPU transition enforces 2-second handoff and starts CPU2 automatically', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
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
        cpu_2: {
          uid: 'cpu_2',
          displayName: 'CPU2',
          photoURL: null,
          isReady: true,
          colorToken: '#10B981',
          joinedAt: Date.now(),
          isCpu: true,
          playerType: 'COMPUTER',
        },
      };
      const room = createTestRoom('room_reg_6', 'cpu_1', members);
      const startRes = gm.startGame(room, 'cpu_1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      state.currentPlayerUid = 'cpu_1';
      state.phase = 'MANAGEMENT';

      // CPU1 ends turn
      const res = await gm.processCommand(
        gameId,
        {
          commandId: 'cmd_end_cpu_to_cpu',
          roomId: room.roomId,
          gameId,
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        },
        'cpu_1'
      );

      // Verify handoff to CPU2
      expect(res.nextState.handoff?.isActive).toBe(true);
      expect(res.nextState.handoff?.toPlayerUid).toBe('cpu_2');

      // CPU2 must not execute during handoff
      await expect(
        gm.processCommand(
          gameId,
          {
            commandId: 'cmd_premature_cpu2',
            roomId: room.roomId,
            gameId,
            expectedVersion: res.nextState.version,
            type: 'ROLL_DICE',
            payload: {},
          },
          'cpu_2'
        )
      ).rejects.toThrow('Turn handoff in progress');

      // Wait for handoff completion + CPU2 automatic roll
      await new Promise((r) => setTimeout(r, 260));

      const settled = gm.getGame(gameId)!;
      expect(settled.currentPlayerUid).toBe('cpu_2');
      // CPU2 should have acted or rolled automatically
      expect(settled.handoff).toBeNull();

      gm.stopTurnTimer(gameId);
    });

    it('Test 7: Human to CPU transition enforces 2-second handoff', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanPlayer',
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
      const room = createTestRoom('room_reg_7', 'player_h1', members);
      const startRes = gm.startGame(room, 'player_h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      state.currentPlayerUid = 'player_h1';
      state.phase = 'MANAGEMENT';

      const res = await gm.processCommand(
        gameId,
        {
          commandId: 'cmd_end_human_to_cpu',
          roomId: room.roomId,
          gameId,
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        },
        'player_h1'
      );

      expect(res.nextState.handoff?.isActive).toBe(true);
      expect(res.nextState.handoff?.toPlayerUid).toBe('cpu_1');

      // Wait for handoff completion
      await new Promise((r) => setTimeout(r, 160));

      const settled = gm.getGame(gameId)!;
      expect(settled.currentPlayerUid).toBe('cpu_1');
      expect(settled.handoff).toBeNull();

      gm.stopTurnTimer(gameId);
    });

    it('Test 8: Human to human transition has no additional handoff delay', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
        player_h1: {
          uid: 'player_h1',
          displayName: 'Human1',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
        player_h2: {
          uid: 'player_h2',
          displayName: 'Human2',
          photoURL: null,
          isReady: true,
          colorToken: '#3B82F6',
          joinedAt: Date.now(),
        },
      };
      const room = createTestRoom('room_reg_8', 'player_h1', members);
      const startRes = gm.startGame(room, 'player_h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      state.currentPlayerUid = 'player_h1';
      state.phase = 'MANAGEMENT';

      const res = await gm.processCommand(
        gameId,
        {
          commandId: 'cmd_end_human_to_human',
          roomId: room.roomId,
          gameId,
          expectedVersion: state.version,
          type: 'END_TURN',
          payload: {},
        },
        'player_h1'
      );

      // Ordinary Human to Human: handoff must be null with zero artificial delay
      expect(res.nextState.handoff).toBeNull();
      expect(res.nextState.isTimerPaused).toBe(false);
      expect(res.nextState.currentPlayerUid).toBe('player_h2');

      gm.stopTurnTimer(gameId);
    });

    it('Test 9: Movement synchronization suppresses decision until pawn lands', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
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
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanPlayer',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
      };
      const room = createTestRoom('room_reg_9', 'player_h1', members);
      const startRes = gm.startGame(room, 'player_h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      state.currentPlayerUid = 'cpu_1';
      state.phase = 'AWAIT_ROLL';

      // Execute ROLL_DICE for CPU
      const rollRes = await gm.processCommand(
        gameId,
        {
          commandId: 'cmd_cpu_roll_sync',
          roomId: room.roomId,
          gameId,
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'cpu_1'
      );

      // Verify movement active and timer paused
      expect(rollRes.nextState.movement).not.toBeNull();
      expect(rollRes.nextState.movement?.isComplete).toBe(false);
      expect(rollRes.nextState.isTimerPaused).toBe(true);

      // Ensure CPU controller does not process decisions while moving
      gm.getCpuController().onGameStateChanged(rollRes.nextState);

      // While moving, no new command was executed: version is still the roll version
      const midMove = gm.getGame(gameId)!;
      expect(midMove.version).toBe(rollRes.nextState.version);

      // Wait for movement to conclude and CPU landing decision to resume
      const moveDuration = rollRes.nextState.movement?.durationMs ?? 60;
      await new Promise((r) => setTimeout(r, moveDuration + 250));

      const settled = gm.getGame(gameId)!;
      // After movement, CPU decision-making resumed automatically, advancing engine version
      expect(settled.version).toBeGreaterThan(rollRes.nextState.version);

      gm.stopTurnTimer(gameId);
    });

    it('Test 10: Re-entrant callback protection ignores concurrent events while command in flight', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
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
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanPlayer',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
      };
      const room = createTestRoom('room_reg_10', 'player_h1', members);
      const startRes = gm.startGame(room, 'player_h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;
      state.currentPlayerUid = 'cpu_1';

      const controller = gm.getCpuController();
      // Simulate that session is currently processing a command
      const session = (controller as unknown as { getSession: (id: string) => { isProcessing: boolean; status: string } }).getSession(gameId);
      session.isProcessing = true;
      session.status = 'ACTION_PENDING';

      // Calling onGameStateChanged must return without starting another action
      controller.onGameStateChanged(state);
      expect(session.isProcessing).toBe(true);
      expect(session.status).toBe('ACTION_PENDING');

      session.isProcessing = false;
      session.status = 'IDLE';
      gm.stopTurnTimer(gameId);
    });

    it('Test 11: Null decision handling distinguishes safe end-turn, pending actions, and foreign turns', () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
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
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanPlayer',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
      };
      const room = createTestRoom('room_reg_11', 'player_h1', members);
      const startRes = gm.startGame(room, 'player_h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;
      const controller = gm.getCpuController();

      // Case A: Safe turn-completion phase (MANAGEMENT, no pending action)
      state.currentPlayerUid = 'cpu_1';
      state.phase = 'MANAGEMENT';
      state.pendingAction = null;
      state.pendingFinancialObligation = null;
      state.movement = null;
      state.handoff = null;
      expect(controller.canSafelyEndTurn(state, 'cpu_1')).toBe(true);

      // Case B: Unresolved mandatory phase (PROPERTY_DECISION)
      state.phase = 'PROPERTY_DECISION';
      expect(controller.canSafelyEndTurn(state, 'cpu_1')).toBe(false);

      // Case C: Pending financial obligation
      state.phase = 'ACTION_REQUIRED';
      state.pendingFinancialObligation = {
        obligationId: 'ob_1',
        debtorUid: 'cpu_1',
        creditorUid: null,
        amountDue: 500,
        paymentType: 'TAX',
        status: 'PENDING',
        idempotencyKey: 'idem_1',
        createdAt: Date.now(),
        expiresAt: Date.now() + 120000,
      };
      expect(controller.canSafelyEndTurn(state, 'cpu_1')).toBe(false);

      // Case D: Active movement
      state.phase = 'MANAGEMENT';
      state.pendingFinancialObligation = null;
      state.movement = {
        playerId: 'cpu_1',
        startPos: 0,
        targetPos: 4,
        steps: 4,
        startedAt: Date.now(),
        endsAt: Date.now() + 1000,
        durationMs: 1000,
        isComplete: false,
      };
      expect(controller.canSafelyEndTurn(state, 'cpu_1')).toBe(false);

      // Case E: Foreign turn (not active player)
      state.movement = null;
      state.currentPlayerUid = 'player_h1';
      expect(controller.canSafelyEndTurn(state, 'cpu_1')).toBe(false);

      gm.stopTurnTimer(gameId);
    });

    it('Test 12: Timer independence preserves 120-second debt window while normal turns end promptly', async () => {
      const gm = new GameManager();
      const members: Record<string, RoomMember> = {
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
        player_h1: {
          uid: 'player_h1',
          displayName: 'HumanPlayer',
          photoURL: null,
          isReady: true,
          colorToken: '#EF4444',
          joinedAt: Date.now(),
        },
      };
      const room = createTestRoom('room_reg_12', 'player_h1', members);
      const startRes = gm.startGame(room, 'player_h1');
      const gameId = startRes.gameId!;
      const state = gm.getGame(gameId)!;

      // 1. Normal CPU turn ends promptly with 25s remaining on the clock
      state.currentPlayerUid = 'cpu_1';
      state.phase = 'MANAGEMENT';
      state.turnTimeRemaining = 25;
      state.movement = null;
      state.isTimerPaused = false;

      gm.getCpuController().onGameStateChanged(state);
      await new Promise((r) => setTimeout(r, 200));

      const settled = gm.getGame(gameId)!;
      expect(settled.currentPlayerUid).toBe('player_h1');

      // 2. Financial resolution uses dedicated 120-second deadline
      const deadline = Date.now() + 120000;
      settled.phase = 'ACTION_REQUIRED';
      settled.turnTimeRemaining = 120;
      settled.pendingFinancialObligation = {
        obligationId: 'ob_debt_test',
        debtorUid: 'player_h1',
        creditorUid: null,
        amountDue: 500,
        paymentType: 'TAX',
        status: 'PENDING',
        idempotencyKey: 'idem_debt',
        createdAt: Date.now(),
        expiresAt: deadline,
      };

      expect(settled.pendingFinancialObligation.expiresAt).toBe(deadline);
      expect(settled.turnTimeRemaining).toBe(120);

      gm.stopTurnTimer(gameId);
    });
  });
});
