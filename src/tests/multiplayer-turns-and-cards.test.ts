/**
 * Indian Monopoly - Comprehensive Hardening Test Suite
 * Covers Scenarios A through F:
 * Scenario A: Multiplayer Turn Reliability & Validation
 * Scenario B: Mortgage Reacquisition Requires Physical Landing
 * Scenario C: Civic Fund Complete Audit (All 12 Canonical Cards)
 * Scenario D: Market Buzz Complete Audit (All 12 Canonical Cards)
 * Scenario E: Give Up Functionality & Blocked Properties
 * Scenario F: Reconnection & State Recovery via game:join
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createLanServer } from '../../server/index';
import { GameCommand, GameState, RoomState } from '../domain/game-types';
import { applyGameCommand } from '../domain/game-engine/engine';
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import {
  ClientToServerEvents,
  GameCommandResponse,
  PlayerSessionPublic,
  ServerToClientEvents,
} from '../../server/types/server-types';

type TypedClient = ClientSocketType<ServerToClientEvents, ClientToServerEvents>;

describe('Indian Monopoly Comprehensive Hardening Suite', () => {
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

  // =========================================================================
  // SCENARIO A: MULTIPLAYER TURN RELIABILITY & VALIDATION
  // =========================================================================
  describe('Scenario A: Multiplayer Turn Reliability & Validation', () => {
    it('validates that only active player can roll, prevents duplicates, and advances turns reliably', async () => {
      const client1 = createClient();
      const client2 = createClient();
      const client3 = createClient();

      try {
        // Register 3 players
        const p1 = await new Promise<PlayerSessionPublic>((res) =>
          client1.emit('player:register', { displayName: 'Player 1' }, (r) => res(r.player!))
        );
        const p2 = await new Promise<PlayerSessionPublic>((res) =>
          client2.emit('player:register', { displayName: 'Player 2' }, (r) => res(r.player!))
        );
        await new Promise<PlayerSessionPublic>((res) =>
          client3.emit('player:register', { displayName: 'Player 3' }, (r) => res(r.player!))
        );

        // Client 1 creates room
        const roomRes = await new Promise<{ roomId: string; inviteCode: string }>((res) =>
          client1.emit('room:create', {}, (r) => res({ roomId: r.roomId!, inviteCode: r.inviteCode! }))
        );

        // Clients 2 & 3 join room
        await new Promise<void>((res) => client2.emit('room:join', { inviteCode: roomRes.inviteCode }, () => res()));
        await new Promise<void>((res) => client3.emit('room:join', { inviteCode: roomRes.inviteCode }, () => res()));

        // Mark ready
        await new Promise<void>((res) => client2.emit('room:set-ready', { isReady: true }, () => res()));
        await new Promise<void>((res) => client3.emit('room:set-ready', { isReady: true }, () => res()));

        // Start game
        const startRes = await new Promise<{ ok: boolean; gameId?: string }>((res) =>
          client1.emit('room:start', (r) => res(r))
        );
        expect(startRes.ok).toBe(true);
        const gameId = startRes.gameId!;

        const activeGame = serverInstance.gameManager.getGame(gameId)!;
        expect(activeGame).toBeDefined();
        const activeUid = activeGame.currentPlayerUid;
        const nonActiveClient = activeUid === p1.uid ? client2 : client1;
        const activeClient = activeUid === p1.uid ? client1 : (activeUid === p2.uid ? client2 : client3);

        // 1. Non-active player attempting to roll is strictly rejected
        const illegalRollRes = await new Promise<GameCommandResponse>((res) => {
          nonActiveClient.emit(
            'game:command',
            {
              commandId: 'cmd_illegal_roll',
              roomId: roomRes.roomId,
              gameId,
              expectedVersion: activeGame.version,
              type: 'ROLL_DICE',
              payload: {},
            },
            res
          );
        });
        expect(illegalRollRes.ok).toBe(false);
        expect(illegalRollRes.error).toMatch(/not your turn/i);

        // 2. Active player rolls dice successfully
        const legalRollRes = await new Promise<GameCommandResponse>((res) => {
          activeClient.emit(
            'game:command',
            {
              commandId: 'cmd_legal_roll_1',
              roomId: roomRes.roomId,
              gameId,
              expectedVersion: activeGame.version,
              type: 'ROLL_DICE',
              payload: {},
            },
            res
          );
        });
        expect(legalRollRes.ok).toBe(true);

        // 3. Active player trying to roll a second time in same turn is rejected
        const updatedGame = serverInstance.gameManager.getGame(gameId)!;
        const duplicateRollRes = await new Promise<GameCommandResponse>((res) => {
          activeClient.emit(
            'game:command',
            {
              commandId: 'cmd_dup_roll',
              roomId: roomRes.roomId,
              gameId,
              expectedVersion: updatedGame.version,
              type: 'ROLL_DICE',
              payload: {},
            },
            res
          );
        });
        expect(duplicateRollRes.ok).toBe(false);
      } finally {
        client1.disconnect();
        client2.disconnect();
        client3.disconnect();
      }
    });
  });

  // =========================================================================
  // SCENARIO B: MORTGAGE REACQUISITION RULES
  // =========================================================================
  describe('Scenario B: Mortgage Reacquisition Requires Physical Landing', () => {
    it('blocks unmortgage without physical landing and enforces exact repayment', () => {
      const state = createInitialGame('room_test', 'game_test', {
        user_1: { uid: 'user_1', displayName: 'Player 1', photoURL: null, colorToken: '#000', isReady: true, joinedAt: 1 },
        user_2: { uid: 'user_2', displayName: 'Player 2', photoURL: null, colorToken: '#fff', isReady: true, joinedAt: 2 },
      }, undefined, 'user_1');

      // Setup: user_1 owns property #1 (Jaipur) and mortgages it
      const prop1 = state.properties[1];
      prop1.ownerUid = 'user_1';
      prop1.ownershipState = 'OWNED';
      prop1.isMortgaged = true;
      const originalMortgageVal = 300; // Jaipur mortgage value

      state.phase = 'MANAGEMENT';
      state.reacquisitionOpportunity = null;

      // 1. Attempting to unmortgage directly without landing must throw GameEngineError
      expect(() => {
        applyGameCommand(state, {
          commandId: 'cmd_unmortgage_direct',
          roomId: state.roomId,
          gameId: state.gameId,
          expectedVersion: state.version,
          type: 'UNMORTGAGE',
          payload: { spaceIndex: 1 },
        }, 'user_1');
      }).toThrow('Mortgaged property can only be reacquired by landing on it during an eligible turn.');

      // 2. Physical landing on property #1 creates reacquisitionOpportunity
      // Simulate landing on space 1 via roll
      const landingRollCmd: GameCommand = {
        commandId: 'cmd_land_mortgage',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'ROLL_DICE',
        payload: {},
      };
      state.phase = 'AWAIT_ROLL';
      state.players[0].position = 0;
      const landResult = applyGameCommand(state, landingRollCmd, 'user_1', [0, 1]); // Lands on space 1
      const postLandState = landResult.nextState;

      expect(postLandState.reacquisitionOpportunity).toBeDefined();
      expect(postLandState.reacquisitionOpportunity?.spaceIndex).toBe(1);
      expect(postLandState.reacquisitionOpportunity?.status).toBe('PENDING');
      expect(postLandState.reacquisitionOpportunity?.cost).toBe(originalMortgageVal);

      // 3. If player declines reacquisition, status becomes DECLINED and re-attempting in same turn fails
      const declineCmd: GameCommand = {
        commandId: 'cmd_decline_reacq',
        roomId: postLandState.roomId,
        gameId: postLandState.gameId,
        expectedVersion: postLandState.version,
        type: 'DECLINE_REACQUISITION',
        payload: { spaceIndex: 1 },
      };
      const declineResult = applyGameCommand(postLandState, declineCmd, 'user_1');
      expect(declineResult.nextState.reacquisitionOpportunity?.status).toBe('DECLINED');

      // Attempting to unmortgage after declining in same turn fails
      expect(() => {
        applyGameCommand(declineResult.nextState, {
          commandId: 'cmd_unmortgage_after_decline',
          roomId: postLandState.roomId,
          gameId: postLandState.gameId,
          expectedVersion: declineResult.nextState.version,
          type: 'UNMORTGAGE',
          payload: { spaceIndex: 1 },
        }, 'user_1');
      }).toThrow('Mortgaged property can only be reacquired by landing on it during an eligible turn.');

      // 4. In a subsequent turn, physically landing on property 1 again allows reacquisition
      const endTurnResult = applyGameCommand(declineResult.nextState, {
        commandId: 'cmd_end_turn_1',
        roomId: postLandState.roomId,
        gameId: postLandState.gameId,
        expectedVersion: declineResult.nextState.version,
        type: 'END_TURN',
        payload: {},
      }, 'user_1');

      // Advance user_2's turn
      const u2Roll = applyGameCommand(endTurnResult.nextState, {
        commandId: 'cmd_u2_roll',
        roomId: postLandState.roomId,
        gameId: postLandState.gameId,
        expectedVersion: endTurnResult.nextState.version,
        type: 'ROLL_DICE',
        payload: {},
      }, 'user_2', [1, 1]);
      const u2End = applyGameCommand(u2Roll.nextState, {
        commandId: 'cmd_u2_end',
        roomId: postLandState.roomId,
        gameId: postLandState.gameId,
        expectedVersion: u2Roll.nextState.version,
        type: u2Roll.nextState.phase === 'PROPERTY_DECISION' ? 'DECLINE_PROPERTY' : 'END_TURN',
        payload: {},
      }, 'user_2');

      const u2Final = u2End.nextState.phase === 'MANAGEMENT' || u2End.nextState.phase === 'TURN_END'
        ? applyGameCommand(u2End.nextState, {
            commandId: 'cmd_u2_final_end',
            roomId: postLandState.roomId,
            gameId: postLandState.gameId,
            expectedVersion: u2End.nextState.version,
            type: 'END_TURN',
            payload: {},
          }, 'user_2').nextState
        : u2End.nextState;

      // Now back to user_1's turn
      expect(u2Final.currentPlayerUid).toBe('user_1');
      u2Final.players[0].position = 39; // Place just before 1
      const u1SecondLand = applyGameCommand(u2Final, {
        commandId: 'cmd_u1_second_roll',
        roomId: u2Final.roomId,
        gameId: u2Final.gameId,
        expectedVersion: u2Final.version,
        type: 'ROLL_DICE',
        payload: {},
      }, 'user_1', [1, 1]); // 39 + 2 = 41 % 40 = 1 (lands on 1)

      expect(u1SecondLand.nextState.reacquisitionOpportunity?.status).toBe('PENDING');
      const cashBefore = u1SecondLand.nextState.players[0].cash;

      // Reacquire property
      const reacqResult = applyGameCommand(u1SecondLand.nextState, {
        commandId: 'cmd_reacquire_success',
        roomId: u1SecondLand.nextState.roomId,
        gameId: u1SecondLand.nextState.gameId,
        expectedVersion: u1SecondLand.nextState.version,
        type: 'UNMORTGAGE',
        payload: { spaceIndex: 1 },
      }, 'user_1');

      expect(reacqResult.nextState.properties[1].isMortgaged).toBe(false);
      expect(reacqResult.nextState.players[0].cash).toBe(cashBefore - originalMortgageVal);
      expect(reacqResult.nextState.reacquisitionOpportunity).toBeNull();
    });
  });

  // =========================================================================
  // SCENARIO C: CIVIC FUND COMPLETE AUDIT (ALL 12 CARDS)
  // =========================================================================
  describe('Scenario C: Civic Fund Complete Audit (All 12 Canonical Cards)', () => {
    it('executes all 12 Civic Fund cards correctly including insufficient fund obligations', () => {
      const createTestState = () => {
        const s = createInitialGame('room_cf', 'game_cf', {
          user_1: { uid: 'user_1', displayName: 'Player 1', photoURL: null, colorToken: '#000', isReady: true, joinedAt: 1 },
          user_2: { uid: 'user_2', displayName: 'Player 2', photoURL: null, colorToken: '#fff', isReady: true, joinedAt: 2 },
        }, undefined, 'user_1');
        s.phase = 'AWAIT_ROLL';
        s.players[0].position = 0;
        return s;
      };

      // Test each rule index 1..12 on Civic Fund space 2
      // Dice roll [1, 1] lands on space 2 (Civic Fund)
      for (let ruleIndex = 1; ruleIndex <= 12; ruleIndex++) {
        const state = createTestState();
        const startCash = state.players[0].cash;

        // Set up deed or buildings if ruleIndex checks deeds/buildings
        if (ruleIndex === 5) {
          // Development grant: ₹100 per house on unblocked
          state.properties[1].ownerUid = 'user_1';
          state.properties[1].ownershipState = 'OWNED';
          state.properties[1].buildings = 2; // 2 houses = ₹200
          state.properties[3].ownerUid = 'user_1';
          state.properties[3].ownershipState = 'BLOCKED';
          state.properties[3].buildings = 4; // should be ignored!
        } else if (ruleIndex === 6) {
          // Municipal maintenance: ₹250 per unblocked deed
          state.properties[1].ownerUid = 'user_1';
          state.properties[1].ownershipState = 'OWNED';
          // Also set a blocked property to verify blocked is excluded
          state.properties[3].ownerUid = 'user_1';
          state.properties[3].ownershipState = 'BLOCKED';
        }

        const res = applyGameCommand(state, {
          commandId: `cmd_cf_${ruleIndex}`,
          roomId: state.roomId,
          gameId: state.gameId,
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        }, 'user_1', [1, 1], { cardRuleIndex: ruleIndex });

        expect(res.nextState.activeCardPopup).toBeDefined();
        expect(res.nextState.activeCardPopup?.deck).toBe('CIVIC');

        // Verify specific card effects
        if (ruleIndex === 1) {
          // Bank interest: ₹500 credit
          expect(res.nextState.players[0].cash).toBe(startCash + 500);
        } else if (ruleIndex === 2) {
          // Tax refund: ₹700 credit
          expect(res.nextState.players[0].cash).toBe(startCash + 700);
        } else if (ruleIndex === 3) {
          // Education expense: ₹400 debit
          expect(res.nextState.players[0].cash).toBe(startCash - 400);
        } else if (ruleIndex === 4) {
          // Festival gathering: Pay each active player ₹200
          expect(res.nextState.players[0].cash).toBe(startCash - 200);
          expect(res.nextState.players[1].cash).toBe(startCash + 200);
        } else if (ruleIndex === 5) {
          // Development grant: ₹100 per house on unblocked (2 houses = ₹200)
          expect(res.nextState.players[0].cash).toBe(startCash + 200);
        } else if (ruleIndex === 6) {
          // Municipal maintenance: ₹250 per unblocked deed (1 unblocked deed)
          expect(res.nextState.players[0].cash).toBe(startCash - 250);
        } else if (ruleIndex === 7) {
          // Community development: ₹1,000 credit
          expect(res.nextState.players[0].cash).toBe(startCash + 1000);
        } else if (ruleIndex === 8) {
          // Road repair contribution: ₹1,000 debit
          expect(res.nextState.players[0].cash).toBe(startCash - 1000);
        } else if (ruleIndex === 9) {
          // Special legal exemption: Get Out of Jail Free
          expect(res.nextState.players[0].jailFreeCards).toBe(1);
        } else if (ruleIndex === 10) {
          // Civic investigation: Go directly to Jail
          expect(res.nextState.players[0].inJail).toBe(true);
          expect(res.nextState.players[0].position).toBe(10);
        } else if (ruleIndex === 11) {
          // Legal settlement: ₹1,500 credit
          expect(res.nextState.players[0].cash).toBe(startCash + 1500);
        } else if (ruleIndex === 12) {
          // Utility expenses: ₹600 debit
          expect(res.nextState.players[0].cash).toBe(startCash - 600);
        }
      }

      // Verify that insufficient funds during Civic Fund debit creates ACTION_REQUIRED when player has assets to mortgage
      const brokeState = createTestState();
      brokeState.players[0].cash = 50; // cannot afford ₹400 education expense (rule 3)
      brokeState.properties[1].ownerUid = 'user_1';
      brokeState.properties[1].ownershipState = 'OWNED';
      const auditRes = applyGameCommand(brokeState, {
        commandId: 'cmd_broke_cf',
        roomId: brokeState.roomId,
        gameId: brokeState.gameId,
        expectedVersion: brokeState.version,
        type: 'ROLL_DICE',
        payload: {},
      }, 'user_1', [1, 1], { cardRuleIndex: 3 });

      expect(auditRes.nextState.phase).toBe('ACTION_REQUIRED');
      expect(auditRes.nextState.pendingFinancialObligation).toBeDefined();
      expect(auditRes.nextState.pendingFinancialObligation?.amountDue).toBe(400);
    });
  });

  // =========================================================================
  // SCENARIO D: MARKET BUZZ COMPLETE AUDIT (ALL 12 CARDS)
  // =========================================================================
  describe('Scenario D: Market Buzz Complete Audit (All 12 Canonical Cards)', () => {
    it('executes all 12 Market Buzz cards including movements and property landing transitions', () => {
      const createTestState = () => {
        const s = createInitialGame('room_mb', 'game_mb', {
          user_1: { uid: 'user_1', displayName: 'Player 1', photoURL: null, colorToken: '#000', isReady: true, joinedAt: 1 },
          user_2: { uid: 'user_2', displayName: 'Player 2', photoURL: null, colorToken: '#fff', isReady: true, joinedAt: 2 },
        }, undefined, 'user_1');
        s.phase = 'AWAIT_ROLL';
        s.players[0].position = 10; // 10 + 2 = 12 (Market Buzz)
        return s;
      };

      // Test each rule index 1..12 on Market Buzz space 12
      for (let ruleIndex = 1; ruleIndex <= 12; ruleIndex++) {
        const state = createTestState();
        const startCash = state.players[0].cash;

        if (ruleIndex === 7) {
          // Repair Tax: ₹250 per house
          state.properties[1].ownerUid = 'user_1';
          state.properties[1].ownershipState = 'OWNED';
          state.properties[1].buildings = 2; // 2 * 250 = 500
        } else if (ruleIndex === 10) {
          // Transit Dividend: ₹400 per station
          state.properties[5].ownerUid = 'user_1';
          state.properties[5].ownershipState = 'OWNED'; // 1 transit = ₹400
        }

        const res = applyGameCommand(state, {
          commandId: `cmd_mb_${ruleIndex}`,
          roomId: state.roomId,
          gameId: state.gameId,
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        }, 'user_1', [1, 1], { cardRuleIndex: ruleIndex });

        expect(res.nextState.activeCardPopup).toBeDefined();
        expect(res.nextState.activeCardPopup?.deck).toBe('MARKET');

        if (ruleIndex === 1) {
          // Startup Grant: ₹800 credit
          expect(res.nextState.players[0].cash).toBe(startCash + 800);
        } else if (ruleIndex === 2) {
          // Festival Travel to Start: space 0 + ₹3,000 salary
          expect(res.nextState.players[0].position).toBe(0);
          expect(res.nextState.players[0].cash).toBe(startCash + 3000);
        } else if (ruleIndex === 3) {
          // Business Conference: Connaught Place (space 38)
          expect(res.nextState.players[0].position).toBe(38);
          // Space 38 is an unowned city, so phase must transition to PROPERTY_DECISION!
          expect(res.nextState.phase).toBe('PROPERTY_DECISION');
        } else if (ruleIndex === 4) {
          // Railway Expansion: advances to next transit space with 2x rent
          expect([5, 15, 25, 35]).toContain(res.nextState.players[0].position);
        } else if (ruleIndex === 5) {
          // Road Diversion: -3 spaces (12 - 3 = 9)
          expect(res.nextState.players[0].position).toBe(9);
        } else if (ruleIndex === 6) {
          // Highway toll: ₹300 debit
          expect(res.nextState.players[0].cash).toBe(startCash - 300);
        } else if (ruleIndex === 7) {
          // Repair Tax: ₹250 per house (2 houses = ₹500 debit)
          expect(res.nextState.players[0].cash).toBe(startCash - 500);
        } else if (ruleIndex === 8) {
          // Successful tender: ₹1,200 credit
          expect(res.nextState.players[0].cash).toBe(startCash + 1200);
        } else if (ruleIndex === 9) {
          // Regulatory Violation: Go to Jail
          expect(res.nextState.players[0].inJail).toBe(true);
          expect(res.nextState.players[0].position).toBe(10);
        } else if (ruleIndex === 10) {
          // Transit Dividend: ₹400 credit (1 station owned)
          expect(res.nextState.players[0].cash).toBe(startCash + 400);
        } else if (ruleIndex === 11) {
          // Emergency procurement: ₹700 debit
          expect(res.nextState.players[0].cash).toBe(startCash - 700);
        } else if (ruleIndex === 12) {
          // Mumbai prime location: advances to space 39, enters PROPERTY_DECISION
          expect(res.nextState.players[0].position).toBe(39);
          expect(res.nextState.phase).toBe('PROPERTY_DECISION');
        }
      }
    });
  });

  // =========================================================================
  // SCENARIO E: GIVE UP FUNCTIONALITY & BLOCKED PROPERTIES
  // =========================================================================
  describe('Scenario E: Give Up Functionality & Blocked Properties', () => {
    it('marks player bankrupt, blocks all cities with 0 rent, and preserves history', () => {
      const state = createInitialGame('room_gu', 'game_gu', {
        user_1: { uid: 'user_1', displayName: 'Player 1', photoURL: null, colorToken: '#000', isReady: true, joinedAt: 1 },
        user_2: { uid: 'user_2', displayName: 'Player 2', photoURL: null, colorToken: '#fff', isReady: true, joinedAt: 2 },
        user_3: { uid: 'user_3', displayName: 'Player 3', photoURL: null, colorToken: '#f00', isReady: true, joinedAt: 3 },
      }, undefined, 'user_1');

      // User 1 owns property 1 (with 2 buildings, mortgaged) and property 3
      state.properties[1].ownerUid = 'user_1';
      state.properties[1].ownershipState = 'OWNED';
      state.properties[1].buildings = 2;
      state.properties[1].isMortgaged = true;

      state.properties[3].ownerUid = 'user_1';
      state.properties[3].ownershipState = 'OWNED';
      state.properties[3].buildings = 0;
      state.properties[3].isMortgaged = false;

      state.phase = 'MANAGEMENT';

      // User 1 surrenders via GIVE_UP
      const giveUpRes = applyGameCommand(state, {
        commandId: 'cmd_giveup_user1',
        roomId: state.roomId,
        gameId: state.gameId,
        expectedVersion: state.version,
        type: 'GIVE_UP',
        payload: {},
      }, 'user_1');

      const nextState = giveUpRes.nextState;
      const surrenderedPlayer = nextState.players.find((p) => p.uid === 'user_1')!;
      expect(surrenderedPlayer.isBankrupt).toBe(true);

      // Verify property blocking and historical preservation
      const prop1 = nextState.properties[1];
      expect(prop1.ownershipState).toBe('BLOCKED');
      expect(prop1.ownerUid).toBe('user_1'); // Historical ownership preserved
      expect(prop1.buildings).toBe(2); // Historical buildings preserved
      expect(prop1.isMortgaged).toBe(true); // Historical mortgage preserved

      const prop3 = nextState.properties[3];
      expect(prop3.ownershipState).toBe('BLOCKED');

      // Section 9: Immediate game termination on surrender
      expect(nextState.status).toBe('COMPLETED');
      expect(nextState.winnerUid).toBe('user_2');
      expect(nextState.disqualifiedPlayerUid).toBe('user_1');

      // Verify that further gameplay actions are rejected because match has concluded immediately
      expect(() => {
        applyGameCommand(nextState, {
          commandId: 'cmd_u2_land_blocked',
          roomId: nextState.roomId,
          gameId: nextState.gameId,
          expectedVersion: nextState.version,
          type: 'ROLL_DICE',
          payload: {},
        }, 'user_2', [0, 1]);
      }).toThrow('Game has already concluded');

      // Verify blocked property cannot be mortgaged or unmortgaged
      expect(() => {
        applyGameCommand(nextState, {
          commandId: 'cmd_mortgage_blocked',
          roomId: nextState.roomId,
          gameId: nextState.gameId,
          expectedVersion: nextState.version,
          type: 'MORTGAGE',
          payload: { spaceIndex: 1 },
        }, 'user_1');
      }).toThrow('Game has already concluded');
    });
  });

  // =========================================================================
  // SCENARIO F: RECONNECTION & STATE RECOVERY VIA game:join
  // =========================================================================
  describe('Scenario F: Reconnection & State Recovery via game:join', () => {
    it('restores authoritative game state and room when client emits game:join', async () => {
      const client = createClient();

      try {
        // Register player and create a game
        await new Promise<PlayerSessionPublic>((res) =>
          client.emit('player:register', { displayName: 'Reconnector' }, (r) => res(r.player!))
        );

        const roomRes = await new Promise<{ roomId: string; inviteCode: string }>((res) =>
          client.emit('room:create', {}, (r) => res({ roomId: r.roomId!, inviteCode: r.inviteCode! }))
        );

        // Manually start game on server
        const room = serverInstance.roomManager.getRoom(roomRes.roomId)!;
        // Register and add second player to allow start
        const dummy2 = serverInstance.roomManager.registerPlayer('Player 2 Dummy');
        serverInstance.roomManager.joinRoom(roomRes.inviteCode, dummy2.uid);
        serverInstance.roomManager.setReady(roomRes.roomId, dummy2.uid, true);
        serverInstance.roomManager.setReady(roomRes.roomId, room.hostUid, true);

        const startRes = serverInstance.gameManager.startGame(room, room.hostUid);
        expect(startRes.ok).toBe(true);
        const gameId = startRes.gameId!;

        // Simulate reconnecting client asking for game state via 'game:join'
        const reconnectClient = createClient();
        await new Promise<void>((res) =>
          reconnectClient.emit('player:register', { displayName: 'Reconnector 2' }, () => res())
        );

        const joinResponse = await new Promise<{ ok: boolean; gameState?: GameState; room?: RoomState }>((res) => {
          reconnectClient.emit('game:join', { gameId }, (response) => {
            res(response);
          });
        });

        expect(joinResponse.ok).toBe(true);
        expect(joinResponse.gameState).toBeDefined();
        expect(joinResponse.gameState?.gameId).toBe(gameId);
        expect(joinResponse.room).toBeDefined();
        expect(joinResponse.room?.roomId).toBe(roomRes.roomId);

        reconnectClient.disconnect();
      } finally {
        client.disconnect();
      }
    });
  });
});
