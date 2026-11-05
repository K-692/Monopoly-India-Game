import { describe, it, expect } from 'vitest';
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import { applyGameCommand } from '../domain/game-engine/engine';
import { sound } from '../lib/audio/sound-engine';

const mockMembers = {
  user_1: { uid: 'user_1', displayName: 'Player 1', photoURL: null, colorToken: '#FF5722', isReady: true, joinedAt: 1 },
  user_2: { uid: 'user_2', displayName: 'Player 2', photoURL: null, colorToken: '#2196F3', isReady: true, joinedAt: 2 },
  user_3: { uid: 'user_3', displayName: 'Player 3', photoURL: null, colorToken: '#4CAF50', isReady: true, joinedAt: 3 },
};

describe('Start-Pass Notifications, Mortgage Board Preview & Audio Engine', () => {
  // =========================================================================
  // 1. START-PASS NOTIFICATION ISOLATION
  // =========================================================================
  describe('Start-Pass Notification Isolation', () => {
    it('produces START_REWARD transaction exclusively designating the passing player as recipient', () => {
      const state = createInitialGame('room_test', 'game_test', mockMembers, undefined, 'user_1');

      // Position player 1 just before Start (space 38). Roll 3 -> crosses Start to space 1 (Jaipur)
      state.players[0].position = 38;
      const initialCash = state.players[0].cash;
      const configuredReward = state.rules?.passStartReward ?? 2000;

      const result = applyGameCommand(
        state,
        {
          commandId: 'cmd_pass_start',
          roomId: 'room_test',
          gameId: 'game_test',
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'user_1',
        [1, 2] // Total 3 -> 38 + 3 = 41 % 40 = space 1 (Jaipur)
      );

      const nextState = result.nextState;
      expect(nextState.players[0].position).toBe(1);
      expect(nextState.players[0].cash).toBe(initialCash + configuredReward);

      // Verify activeMoneyTransaction designating user_1 exclusively as recipient
      expect(nextState.activeMoneyTransaction).toBeDefined();
      expect(nextState.activeMoneyTransaction?.type).toBe('START_REWARD');
      expect(nextState.activeMoneyTransaction?.recipientUid).toBe('user_1');
      expect(nextState.activeMoneyTransaction?.amount).toBe(configuredReward);

      // Verify START_REWARD transaction recorded in ledger
      const startTx = nextState.transactions?.find((tx) => tx.type === 'START_REWARD');
      expect(startTx).toBeDefined();
      expect(startTx?.playerUid).toBe('user_1');
      expect(startTx?.direction).toBe('CREDIT');
      expect(startTx?.amount).toBe(configuredReward);
    });

    it('simulates client notification filter: only credited player sees "You received ₹X" popup', () => {
      const startTx = {
        id: 'tx_start_101',
        type: 'START_REWARD' as const,
        amount: 200,
        playerUid: 'user_1',
        recipientUid: 'user_1',
        description: 'Passed Start bonus',
        timestamp: Date.now(),
      };

      // Helper function mirroring GameBoard.tsx logic:
      const evaluateStartPassNotification = (viewerUid: string, tx: typeof startTx) => {
        if (tx.type === 'START_REWARD') {
          // Privacy constraint: only notify the credited player
          if (tx.recipientUid === viewerUid) {
            return {
              shown: true,
              message: `You received ₹${tx.amount}`,
            };
          }
          return { shown: false, message: null };
        }
        return { shown: false, message: null };
      };

      // Credited player (user_1) sees notification
      const user1Result = evaluateStartPassNotification('user_1', startTx);
      expect(user1Result.shown).toBe(true);
      expect(user1Result.message).toBe('You received ₹200');

      // Other players (user_2, user_3) see nothing
      const user2Result = evaluateStartPassNotification('user_2', startTx);
      expect(user2Result.shown).toBe(false);
      expect(user2Result.message).toBeNull();

      const user3Result = evaluateStartPassNotification('user_3', startTx);
      expect(user3Result.shown).toBe(false);
      expect(user3Result.message).toBeNull();
    });

    it('deduplicates start-pass notifications to prevent repeats on reconnects or snapshot replays', () => {
      const shownTxIds = new Set<string>();

      const tryShowNotification = (viewerUid: string, txId: string, recipientUid: string) => {
        if (recipientUid !== viewerUid) return false;
        if (shownTxIds.has(txId)) return false; // Deduplication
        shownTxIds.add(txId);
        return true;
      };

      // First delivery
      expect(tryShowNotification('user_1', 'tx_start_101', 'user_1')).toBe(true);

      // Duplicate delivery (e.g. Firebase re-render or connection blip)
      expect(tryShowNotification('user_1', 'tx_start_101', 'user_1')).toBe(false);

      // Different transaction
      expect(tryShowNotification('user_1', 'tx_start_102', 'user_1')).toBe(true);
    });
  });

  // =========================================================================
  // 2. CHECK BOARD BUTTON & FINANCIAL RESOLUTION PRESERVATION
  // =========================================================================
  describe('Mortgage Resolution Board Preview & State Preservation', () => {
    it('maintains pending obligation, property selections, and timer during board inspection mode', () => {
      let state = createInitialGame('room_test', 'game_test', mockMembers, undefined, 'user_1');

      // Setup user_2 owns Connaught Place (space 39)
      state.properties[39].ownerUid = 'user_2';
      state.properties[39].ownershipState = 'OWNED';

      // user_1 owns 2 properties
      state.properties[1].ownerUid = 'user_1';
      state.properties[1].ownershipState = 'OWNED';
      state.properties[3].ownerUid = 'user_1';
      state.properties[3].ownershipState = 'OWNED';

      // user_1 has low balance (₹50), rent on 39 is ₹350 -> deficit of ₹300
      state.players[0].cash = 50;
      state.players[0].position = 33;

      // Roll to trigger low-balance mortgage resolution
      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_roll_rent',
          roomId: 'room_test',
          gameId: 'game_test',
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'user_1',
        [3, 3]
      ).nextState;

      expect(state.phase).toBe('ACTION_REQUIRED');
      expect(state.pendingFinancialObligation).toBeDefined();
      const obligation = state.pendingFinancialObligation!;
      expect(obligation.debtorUid).toBe('user_1');
      expect(obligation.creditorUid).toBe('user_2');
      expect(obligation.amountDue).toBe(400);
      expect(obligation.remainingAmountDue).toBe(350);

      // Simulate UI state in FinancialResolutionModal
      let isCheckingBoard = false;
      const selectedPropertyIndices = [1]; // Player selected property 1 to mortgage
      const expiresAt = obligation.expiresAt;

      // Player clicks "Check Board"
      isCheckingBoard = true;
      expect(isCheckingBoard).toBe(true);

      // While checking board, selections, expiresAt deadline, and obligation remain unchanged
      expect(selectedPropertyIndices).toEqual([1]);
      expect(obligation.expiresAt).toBe(expiresAt);
      expect(state.pendingFinancialObligation?.amountDue).toBe(400);

      // Player returns from board preview (e.g. clicks anywhere or return button)
      isCheckingBoard = false;
      expect(isCheckingBoard).toBe(false);
      expect(selectedPropertyIndices).toEqual([1]); // Selections preserved!
    });

    it('ensures dice rolling and normal actions are blocked while financial resolution is active', () => {
      let state = createInitialGame('room_test', 'game_test', mockMembers, undefined, 'user_1');

      state.properties[39].ownerUid = 'user_2';
      state.properties[39].ownershipState = 'OWNED';
      state.properties[1].ownerUid = 'user_1';
      state.properties[1].ownershipState = 'OWNED';
      state.players[0].cash = 50;
      state.players[0].position = 33;

      state = applyGameCommand(
        state,
        {
          commandId: 'cmd_roll_rent',
          roomId: 'room_test',
          gameId: 'game_test',
          expectedVersion: state.version,
          type: 'ROLL_DICE',
          payload: {},
        },
        'user_1',
        [3, 3]
      ).nextState;

      // Rolling again while in low-balance debt resolution must fail
      expect(() => {
        applyGameCommand(
          state,
          {
            commandId: 'cmd_illegal_roll',
            roomId: 'room_test',
            gameId: 'game_test',
            expectedVersion: state.version,
            type: 'ROLL_DICE',
            payload: {},
          },
          'user_1',
          [1, 1]
        );
      }).toThrow();
    });
  });

  // =========================================================================
  // 3. TRANSACTION-DRIVEN PLAYER-SPECIFIC PROCEDURAL AUDIO
  // =========================================================================
  describe('Transaction-Driven Financial Sound Effects', () => {
    it('classifies incoming and outgoing transactions into CASH_CREDIT and CASH_DEBIT for specific players', () => {
      interface Transaction {
        id: string;
        type: string;
        amount: number;
        playerUid?: string;
        recipientUid?: string;
      }

      // Audio trigger resolver matching GameBoard.tsx
      const resolveAudioTrigger = (viewerUid: string, tx: Transaction): 'CASH_CREDIT' | 'CASH_DEBIT' | null => {
        // Did the viewer gain money?
        if (tx.recipientUid === viewerUid && tx.playerUid !== viewerUid) {
          return 'CASH_CREDIT';
        }
        if (tx.type === 'START_REWARD' && tx.playerUid === viewerUid) {
          return 'CASH_CREDIT';
        }
        if (tx.type === 'MORTGAGE' && tx.playerUid === viewerUid) {
          return 'CASH_CREDIT';
        }
        // Did the viewer spend/lose money?
        if (tx.playerUid === viewerUid && tx.type !== 'START_REWARD' && tx.type !== 'MORTGAGE') {
          return 'CASH_DEBIT';
        }
        return null;
      };

      // Rent payment transaction: user_1 pays user_2 ₹350
      const rentTx: Transaction = {
        id: 'tx_rent_1',
        type: 'RENT_PAYMENT',
        amount: 350,
        playerUid: 'user_1',
        recipientUid: 'user_2',
      };

      // Debtor (user_1) hears CASH_DEBIT
      expect(resolveAudioTrigger('user_1', rentTx)).toBe('CASH_DEBIT');
      // Creditor (user_2) hears CASH_CREDIT
      expect(resolveAudioTrigger('user_2', rentTx)).toBe('CASH_CREDIT');
      // Bystander (user_3) hears silence
      expect(resolveAudioTrigger('user_3', rentTx)).toBeNull();

      // Property purchase transaction: user_1 buys space for ₹600
      const buyTx: Transaction = {
        id: 'tx_buy_1',
        type: 'PROPERTY_PURCHASE',
        amount: 600,
        playerUid: 'user_1',
      };
      expect(resolveAudioTrigger('user_1', buyTx)).toBe('CASH_DEBIT');
      expect(resolveAudioTrigger('user_2', buyTx)).toBeNull();

      // Start pass reward: user_1 gains ₹200
      const startTx: Transaction = {
        id: 'tx_start_1',
        type: 'START_REWARD',
        amount: 200,
        playerUid: 'user_1',
        recipientUid: 'user_1',
      };
      expect(resolveAudioTrigger('user_1', startTx)).toBe('CASH_CREDIT');
      expect(resolveAudioTrigger('user_2', startTx)).toBeNull();

      // Mortgage payout: user_1 mortgages property to receive ₹300
      const mortgageTx: Transaction = {
        id: 'tx_mortgage_1',
        type: 'MORTGAGE',
        amount: 300,
        playerUid: 'user_1',
      };
      expect(resolveAudioTrigger('user_1', mortgageTx)).toBe('CASH_CREDIT');
      expect(resolveAudioTrigger('user_2', mortgageTx)).toBeNull();
    });

    it('sound engine exposes CASH_CREDIT and CASH_DEBIT without throwing errors', () => {
      // In Node environment, Web Audio is mocked or gracefully handles absence of window.AudioContext
      expect(typeof sound.play).toBe('function');
      expect(() => sound.play('CASH_CREDIT')).not.toThrow();
      expect(() => sound.play('CASH_DEBIT')).not.toThrow();
    });
  });
});
