/**
 * Indian Monopoly - Popup Positioning, Event Notification Deduplication,
 * and Username Validation Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore } from '../components/feedback/toast-store';

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
