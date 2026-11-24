/**
 * CPU money planning: CPU players keep a cash reserve sized to upcoming risk
 * (opponent rents ahead, taxes, board danger) before buying or building.
 */
import { describe, it, expect } from 'vitest';
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import {
  assessCpuFinancialOutlook,
  decideBuildingAction,
  decidePropertyAction,
  evaluateAcquisitionTier,
} from '../domain/game-engine/cpu-decision-engine';
import { GameState, RoomMember } from '../domain/game-types';
import { DEFAULT_HOST_RULES } from '../domain/ruleset';

function makeGame(): GameState {
  const members: Record<string, RoomMember> = {
    cpu: { uid: 'cpu', displayName: 'CPU', photoURL: null, isReady: true, joinedAt: 1, colorToken: 'red', isCpu: true },
    human: { uid: 'human', displayName: 'Human', photoURL: null, isReady: true, joinedAt: 2, colorToken: 'blue' },
  };
  return createInitialGame('room', 'game', members, DEFAULT_HOST_RULES, 'cpu', { forcedPlayerOrder: ['cpu', 'human'] });
}

function cpuOf(state: GameState) {
  return state.players.find((p) => p.uid === 'cpu')!;
}

describe('CPU money planning', () => {
  it('buys a city early in the game when cash is healthy', () => {
    const state = makeGame();
    const cpu = cpuOf(state);
    cpu.position = 6; // Agra ₹1,000
    state.phase = 'PROPERTY_DECISION';
    expect(decidePropertyAction(state, cpu).type).toBe('BUY_PROPERTY');
  });

  it('skips an ordinary city when an opponent tower lies just ahead', () => {
    const state = makeGame();
    const cpu = cpuOf(state);
    cpu.position = 31; // Chandigarh ₹3,000
    cpu.cash = 6000;
    // Human owns developed Navi Mumbai / New Delhi / Mumbai right ahead
    for (const idx of [36, 38, 39]) {
      state.properties[idx].ownerUid = 'human';
      state.properties[idx].ownershipState = 'OWNED';
      state.properties[idx].buildings = 5;
    }
    const outlook = assessCpuFinancialOutlook(state, cpu);
    expect(outlook.nextRollWorstCost).toBeGreaterThanOrEqual(15000);
    expect(decidePropertyAction(state, cpu).type).toBe('DECLINE_PROPERTY');
  });

  it('still buys the city that completes its own colour set with a thinner reserve', () => {
    const state = makeGame();
    const cpu = cpuOf(state);
    state.properties[6].ownerUid = 'cpu';
    state.properties[7].ownerUid = 'cpu';
    cpu.position = 9; // Varanasi completes LIGHTBLUE
    cpu.cash = 2400;
    expect(evaluateAcquisitionTier(state, cpu, 9)).toBe('CRITICAL');
    expect(decidePropertyAction(state, cpu).type).toBe('BUY_PROPERTY');
  });

  it('does not keep building until the money runs out', () => {
    const state = makeGame();
    const cpu = cpuOf(state);
    for (const idx of [36, 38, 39]) {
      state.properties[idx].ownerUid = 'cpu';
      state.properties[idx].boughtOnTurn = 0;
    }
    state.turnNumber = 10;
    cpu.position = 39; // Mumbai, first house costs ₹2,000
    cpu.cash = 3000;
    expect(decideBuildingAction(state, cpu)).toBeNull();
    cpu.cash = 20000;
    expect(decideBuildingAction(state, cpu)).not.toBeNull();
  });

  it('stops at 4 houses on a city without the full colour set', () => {
    const state = makeGame();
    const cpu = cpuOf(state);
    state.properties[1].ownerUid = 'cpu';
    state.properties[1].boughtOnTurn = 0;
    state.properties[1].buildings = 4;
    state.turnNumber = 10;
    cpu.position = 1;
    cpu.cash = 40000;
    expect(decideBuildingAction(state, cpu)).toBeNull();
  });
});
