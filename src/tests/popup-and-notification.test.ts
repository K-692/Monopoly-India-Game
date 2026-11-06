/**
 * Indian Monopoly - Popup Positioning, Event Notification Deduplication,
 * and Username Validation Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore } from '../components/feedback/toast-store';
import { applyGameCommand } from '../domain/game-engine/engine';
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import { sound } from '../lib/audio/sound-engine';

describe('Requirement 4: Event Notification Deduplication & Single Active Toast', () => {
  beforeEach(() => {
    useToastStore.getState().clearAll();
  });

  it('maintains strictly only 1 active notification at a time', () => {
    const store = useToastStore.getState();

    store.addToast({
      eventId: 'evt_1',
      type: 'info',
      title: 'First Notification',
      message: 'Message 1',
      silent: true,
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].title).toBe('First Notification');

    // Add a second distinct notification
    store.addToast({
      eventId: 'evt_2',
      type: 'success',
      title: 'Second Notification',
      message: 'Message 2',
      silent: true,
    });

    // Exactly 1 active toast remains (the newer notification replaces the previous)
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].title).toBe('Second Notification');
  });

  it('deduplicates identical event IDs across channels', () => {
    const store = useToastStore.getState();

    store.addToast({
      eventId: 'tx_rent_player1_turn3',
      type: 'warning',
      title: 'Rent Payment',
      message: 'Paid ₹400 rent to Player 2',
      silent: true,
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);
    const toastId = useToastStore.getState().toasts[0].id;

    // Simulate same event arriving from state bridge
    store.addToast({
      eventId: 'tx_rent_player1_turn3',
      type: 'warning',
      title: 'Rent Payment',
      message: 'Paid ₹400 rent to Player 2',
      silent: true,
    });

    // Ignored, toast was not replaced
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].id).toBe(toastId);
  });

  it('deduplicates rapid notifications with identical dedupKey', () => {
    const store = useToastStore.getState();

    store.addToast({
      dedupKey: 'buy_insuff_turn4_pos5',
      type: 'error',
      title: 'Purchase Unavailable',
      message: 'Insufficient balance to purchase this property.',
      silent: true,
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);
    const toastId = useToastStore.getState().toasts[0].id;

    // Immediately trigger same dedupKey
    store.addToast({
      dedupKey: 'buy_insuff_turn4_pos5',
      type: 'error',
      title: 'Purchase Unavailable',
      message: 'Insufficient balance to purchase this property.',
      silent: true,
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].id).toBe(toastId);
  });
});

describe('Requirement 6: Username Validation Rules', () => {
  const isValidUsername = (name?: string | null): { valid: boolean; reason?: string } => {
    if (!name || !name.trim()) return { valid: false, reason: 'Player name is required.' };
    const trimmed = name.trim();
    if (trimmed.length < 2) return { valid: false, reason: 'Player name must be at least 2 characters.' };
    if (trimmed.length > 20) return { valid: false, reason: 'Player name cannot exceed 20 characters.' };
    if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
      return { valid: false, reason: 'Only letters, numbers, spaces, hyphens, and underscores allowed.' };
    }
    return { valid: true };
  };

  it('validates 2 to 20 trimmed characters with permitted symbols', () => {
    expect(isValidUsername('Priya').valid).toBe(true);
    expect(isValidUsername('Vikramaditya').valid).toBe(true);
    expect(isValidUsername('Rahul_D').valid).toBe(true);
    expect(isValidUsername('Player-99').valid).toBe(true);
    expect(isValidUsername('  Aditi Sharma  ').valid).toBe(true);
    expect(isValidUsername('12').valid).toBe(true);
  });

  it('rejects empty or whitespace-only names', () => {
    expect(isValidUsername('').valid).toBe(false);
    expect(isValidUsername('   ').valid).toBe(false);
    expect(isValidUsername(null).valid).toBe(false);
  });

  it('rejects names shorter than 2 characters or longer than 20 characters', () => {
    expect(isValidUsername('A').valid).toBe(false);
    expect(isValidUsername('  A  ').valid).toBe(false);
    expect(isValidUsername('ThisNameIsFarTooLongForATycoonGame').valid).toBe(false);
  });

  it('rejects invalid special characters and emojis', () => {
    expect(isValidUsername('Player!').valid).toBe(false);
    expect(isValidUsername('User@123').valid).toBe(false);
    expect(isValidUsername('<script>').valid).toBe(false);
    expect(isValidUsername('Tycoon👑').valid).toBe(false);
  });
});

describe('Requirement: Stale Version Conflict Tolerance & Mortgage Timer Renewal', () => {
  it('gracefully handles stale versions for DISMISS_MONEY_ACK and DISMISS_CARD_POPUP without throwing VERSION_CONFLICT', () => {
    const game = createInitialGame('room_1', 'game_1', {
      p1: { uid: 'p1', displayName: 'P1', photoURL: null, joinedAt: 1, colorToken: '#EF4444', isReady: true },
      p2: { uid: 'p2', displayName: 'P2', photoURL: null, joinedAt: 2, colorToken: '#3B82F6', isReady: true },
    });
    game.version = 5;
    game.activeMoneyTransaction = {
      id: 'tx_1',
      type: 'BUY_PROPERTY',
      payerName: 'P1',
      payerUid: 'p1',
      recipientName: 'Bank',
      recipientUid: 'BANK',
      amount: 600,
      description: 'Test buy',
    };

    // Client sends expectedVersion 4 when server is already at version 5
    const res = applyGameCommand(
      game,
      {
        commandId: 'cmd_dismiss_stale',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: 4,
        type: 'DISMISS_MONEY_ACK',
        payload: {},
      },
      'p1'
    );

    expect(res.nextState.activeMoneyTransaction).toBeNull();
  });

  it('restarts turn timer when player executes MORTGAGE', () => {
    const game = createInitialGame('room_1', 'game_1', {
      p1: { uid: 'p1', displayName: 'P1', photoURL: null, joinedAt: 1, colorToken: '#EF4444', isReady: true },
      p2: { uid: 'p2', displayName: 'P2', photoURL: null, joinedAt: 2, colorToken: '#3B82F6', isReady: true },
    });
    const currentUid = game.currentPlayerUid;
    // Give player an owned property
    game.properties[1] = {
      propertyId: 'prop_1',
      spaceIndex: 1,
      ownerUid: currentUid,
      ownershipState: 'OWNED',
      buildings: 0,
      isMortgaged: false,
    };
    // Simulate low turn time remaining (5 seconds)
    game.turnTimeRemaining = 5;

    const res = applyGameCommand(
      game,
      {
        commandId: 'cmd_mortgage_1',
        roomId: 'room_1',
        gameId: 'game_1',
        expectedVersion: game.version,
        type: 'MORTGAGE',
        payload: { spaceIndex: 1 },
      },
      currentUid
    );

    expect(res.nextState.properties[1].ownershipState).toBe('UNOWNED');
    expect(res.nextState.properties[1].ownerUid).toBeNull();
    expect(res.nextState.properties[1].soldToBankPayout).toBeGreaterThan(0);
    expect(res.nextState.turnTimeRemaining).toBe(30); // Restarted!
  });
});

describe('Requirement: Procedural Audio Engine Streamlining', () => {
  it('safely dispatches DICE_ROLL, PAWN_STEP, and NOTIFICATION without throwing', () => {
    expect(() => sound.play('DICE_ROLL')).not.toThrow();
    expect(() => sound.play('PAWN_STEP')).not.toThrow();
    expect(() => sound.play('NOTIFICATION')).not.toThrow();
  });

  it('safely handles silenced sounds without error', () => {
    expect(() => sound.play('BUY_PROPERTY')).not.toThrow();
    expect(() => sound.play('PAY_RENT')).not.toThrow();
    expect(() => sound.play('GO_TO_JAIL')).not.toThrow();
    expect(() => sound.play('BUTTON_CLICK')).not.toThrow();
  });
});

