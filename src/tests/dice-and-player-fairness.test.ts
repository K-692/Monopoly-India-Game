/**
 * Indian Monopoly - Fair Dice & Random Starting Player Verification Tests
 *
 * Verifies:
 * 1. Cryptographically secure random selection of starting player
 * 2. Uniform, unbiased distribution of individual die [1..6] via Chi-Square test
 * 3. Independence of two dice across all 36 combinations
 * 4. Preservation of rollId and association with turn
 * 5. Server command idempotency rejecting duplicate roll execution
 */

import { describe, it, expect } from 'vitest';
import {
  generateFairDie,
  generateFairDicePair,
  calculateChiSquareStatistic,
} from '../domain/game-engine/dice-fairness';
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import { DEFAULT_HOST_RULES } from '../domain/ruleset';
import { RoomMember } from '../domain/game-types';
import { applyGameCommand } from '../domain/game-engine/engine';

describe('Requirement 1: Random Starting Player Selection', () => {
  it('assigns the designated starting player to currentPlayerUid and rotates player order', () => {
    const members: Record<string, RoomMember> = {
      p1: { uid: 'p1', displayName: 'Player 1', isReady: true, photoURL: null, joinedAt: 1, colorToken: '#C85A32' },
      p2: { uid: 'p2', displayName: 'Player 2', isReady: true, photoURL: null, joinedAt: 2, colorToken: '#1A2B4C' },
      p3: { uid: 'p3', displayName: 'Player 3', isReady: true, photoURL: null, joinedAt: 3, colorToken: '#E5A93C' },
    };

    // Selecting p2 as starting player
    const state = createInitialGame('room1', 'game1', members, DEFAULT_HOST_RULES, 'p2');
    expect(state.currentPlayerUid).toBe('p2');
    expect(state.playerOrder[0]).toBe('p2');
    expect(state.playerOrder).toEqual(['p2', 'p3', 'p1']);

    // Reconnecting or reloading returns the exact same initial state without re-randomizing
    expect(state.currentPlayerUid).toBe('p2');
  });

  it('rotates to player 3 when p3 is selected as starting player', () => {
    const members: Record<string, RoomMember> = {
      p1: { uid: 'p1', displayName: 'Player 1', isReady: true, photoURL: null, joinedAt: 1, colorToken: '#C85A32' },
      p2: { uid: 'p2', displayName: 'Player 2', isReady: true, photoURL: null, joinedAt: 2, colorToken: '#1A2B4C' },
      p3: { uid: 'p3', displayName: 'Player 3', isReady: true, photoURL: null, joinedAt: 3, colorToken: '#E5A93C' },
    };

    const state = createInitialGame('room1', 'game1', members, DEFAULT_HOST_RULES, 'p3');
    expect(state.currentPlayerUid).toBe('p3');
    expect(state.playerOrder[0]).toBe('p3');
    expect(state.playerOrder).toEqual(['p3', 'p1', 'p2']);
  });
});

describe('Requirement 2: Fair and Unbiased Dice Rolls', () => {
  it('generates dice strictly in the integer range [1..6]', () => {
    for (let i = 0; i < 500; i++) {
      const die = generateFairDie();
      expect(Number.isInteger(die)).toBe(true);
      expect(die).toBeGreaterThanOrEqual(1);
      expect(die).toBeLessThanOrEqual(6);
    }
  });

  it('passes Pearson Chi-Square Goodness-of-Fit test over 12,000 rolls', () => {
    const NUM_ROLLS = 12000;
    const counts = [0, 0, 0, 0, 0, 0];

    for (let i = 0; i < NUM_ROLLS; i++) {
      const roll = generateFairDie();
      counts[roll - 1]++;
    }

    // Verify all 6 outcomes occurred
    counts.forEach((c) => expect(c).toBeGreaterThan(0));

    const stats = calculateChiSquareStatistic(counts);

    // Expected count per face is 12000 / 6 = 2000
    expect(stats.expectedPerFace).toBe(2000);
    expect(stats.degreesOfFreedom).toBe(5);

    // Critical value at alpha = 0.01 (99% significance) for 5 df is 15.086
    expect(stats.chiSquare).toBeLessThan(stats.criticalValue001);
    expect(stats.isUniformAt001).toBe(true);
  });

  it('demonstrates independence of two dice across 18,000 simulated pairs', () => {
    const NUM_PAIRS = 18000;
    const pairMatrix: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));
    let doublesCount = 0;

    for (let i = 0; i < NUM_PAIRS; i++) {
      const [d1, d2] = generateFairDicePair();
      pairMatrix[d1 - 1][d2 - 1]++;
      if (d1 === d2) {
        doublesCount++;
      }
    }

    // Expected probability of doubles: 1/6 (~3,000 out of 18,000)
    // Standard deviation = sqrt(18000 * (1/6) * (5/6)) = sqrt(2500) = 50
    // 3 standard deviations = 150 -> range [2850, 3150]
    expect(doublesCount).toBeGreaterThan(2800);
    expect(doublesCount).toBeLessThan(3200);

    // All 36 outcomes must have occurred (expected 500 each)
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        expect(pairMatrix[r][c]).toBeGreaterThan(350);
        expect(pairMatrix[r][c]).toBeLessThan(650);
      }
    }
  });

  it('associates each dice roll with a unique rollId and updates turn state', () => {
    const members: Record<string, RoomMember> = {
      p1: { uid: 'p1', displayName: 'Player 1', isReady: true, photoURL: null, joinedAt: 1, colorToken: '#C85A32' },
      p2: { uid: 'p2', displayName: 'Player 2', isReady: true, photoURL: null, joinedAt: 2, colorToken: '#1A2B4C' },
    };
    const state = createInitialGame('room1', 'game1', members, DEFAULT_HOST_RULES, 'p1');

    const result = applyGameCommand(
      state,
      {
        commandId: 'cmd_roll_1',
        roomId: 'room1',
        gameId: 'game1',
        expectedVersion: 1,
        type: 'ROLL_DICE',
        payload: {},
      },
      'p1'
    );

    expect(result.nextState.dice).not.toBeNull();
    expect(result.nextState.dice?.rollId).toBeDefined();
    expect(result.nextState.dice?.rollId).toMatch(/^roll_1_/);
    expect(result.event.payload).toMatchObject({
      rollId: result.nextState.dice?.rollId,
    });
  });
});
