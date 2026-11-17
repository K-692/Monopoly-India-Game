/**
 * Indian Monopoly - Latency Fix & Ping Indicator Suite
 *
 * 1. Write-behind persistence: commands broadcast immediately even when the database is slow
 *    (e.g. a cross-region DB round-trip), while writes still reach the store in order.
 * 2. Background persistence failures never break gameplay.
 * 3. Ping indicator renders and classifies latency quality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameManager } from '../../server/game/game-manager';
import { MemoryStore } from '../../server/persistence/memory-store';
import { RoomManager } from '../../server/rooms/room-manager';
import { CommandCommitParams } from '../../server/persistence/types';
import { GameCommand } from '../domain/game-types';
import { DEFAULT_HOST_RULES } from '../domain/ruleset';
import { PingIndicator, getLatencyQuality } from '../components/feedback/PingIndicator';
import { useConnectionStore, useLatencyStore } from '../lib/socket/socket-client';

class SlowStore extends MemoryStore {
  public commitOrder: number[] = [];
  public failNext = false;
  constructor(private delayMs: number) {
    super();
  }
  async commitCommandExecution(params: CommandCommitParams) {
    await new Promise((r) => setTimeout(r, this.delayMs));
    if (this.failNext) {
      this.failNext = false;
      throw new Error('simulated network blip');
    }
    this.commitOrder.push(params.nextState.version);
    return super.commitCommandExecution(params);
  }
}

async function setupGame(store: MemoryStore) {
  await store.init();
  const roomManager = new RoomManager(store);
  const gameManager = new GameManager(store);
  const host = roomManager.registerPlayer('Alice');
  const guest = roomManager.registerPlayer('Bob');
  const room = (await roomManager.createRoom(host.uid, DEFAULT_HOST_RULES)).room!;
  roomManager.joinRoom(room.inviteCode, guest.uid);
  roomManager.setReady(room.roomId, host.uid, true);
  roomManager.setReady(room.roomId, guest.uid, true);
  const start = await gameManager.startGame(room, host.uid, { forcedPlayerOrder: [host.uid, guest.uid] });
  return { gameManager, room, host, gameId: start.gameId! };
}

describe('Write-behind persistence (latency fix)', () => {
  it('broadcasts and resolves a command without waiting for a slow database', async () => {
    const store = new SlowStore(400);
    const { gameManager, room, host, gameId } = await setupGame(store);
    const broadcasts: string[] = [];
    gameManager.setBroadcastCallback((_g, _r, event, _data) => { void _data; broadcasts.push(event); });

    const cmd: GameCommand = {
      commandId: 'cmd_latency_1',
      roomId: room.roomId,
      gameId,
      expectedVersion: 1,
      type: 'ROLL_DICE',
      payload: {},
    };
    const t0 = performance.now();
    const result = await gameManager.processCommand(gameId, cmd, host.uid);
    const elapsed = performance.now() - t0;

    expect(result.nextState.version).toBe(2);
    expect(elapsed).toBeLessThan(200); // DB takes 400ms; gameplay must not wait on it
    expect(broadcasts).toContain('game:state');
    expect(store.commitOrder).toEqual([]); // not yet durable

    await gameManager.flushPersistence(gameId);
    expect(store.commitOrder).toEqual([2]);
    const persisted = await store.getGame(gameId);
    expect(persisted?.version).toBe(2);
    await store.close();
  });

  it('retries a transient database failure in the background without surfacing an error', async () => {
    const store = new SlowStore(5);
    const { gameManager, room, host, gameId } = await setupGame(store);
    store.failNext = true;

    const result = await gameManager.processCommand(
      gameId,
      { commandId: 'cmd_latency_2', roomId: room.roomId, gameId, expectedVersion: 1, type: 'ROLL_DICE', payload: {} },
      host.uid
    );
    expect(result.nextState.version).toBe(2);

    await gameManager.flushPersistence(gameId);
    expect(store.commitOrder).toEqual([2]);
    await store.close();
  });
});

describe('Ping indicator', () => {
  beforeEach(() => {
    useLatencyStore.setState({ latencyMs: null, smoothedMs: null, lastSampleAt: null, isTimedOut: false });
  });
  afterEach(() => {
    useConnectionStore.setState({ status: 'idle' });
  });

  it('classifies latency quality thresholds', () => {
    expect(getLatencyQuality(null)).toBe('unknown');
    expect(getLatencyQuality(40)).toBe('good');
    expect(getLatencyQuality(180)).toBe('fair');
    expect(getLatencyQuality(400)).toBe('poor');
  });

  it('shows the measured round-trip time when connected', () => {
    render(<PingIndicator />);
    useConnectionStore.setState({ status: 'connected' });
    useLatencyStore.setState({ latencyMs: 92, smoothedMs: 87, lastSampleAt: Date.now(), isTimedOut: false });
    return screen.findByText('87 ms').then((el) => {
      expect(screen.getByTestId('ping-indicator').getAttribute('data-quality')).toBe('good');
      expect(el).toBeTruthy();
    });
  });

  it('shows Offline when the socket is disconnected', async () => {
    render(<PingIndicator />);
    useConnectionStore.setState({ status: 'disconnected' });
    expect(await screen.findByText('Offline')).toBeTruthy();
  });
});
