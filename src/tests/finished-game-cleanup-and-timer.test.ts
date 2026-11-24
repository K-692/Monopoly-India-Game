/**
 * Finished games are deleted once every human player closes the Game Over screen,
 * and rooms can be created with a 3-second turn timer.
 */

import { describe, it, expect } from 'vitest';
import { GameManager } from '../../server/game/game-manager';
import { MemoryStore } from '../../server/persistence/memory-store';
import { RoomManager } from '../../server/rooms/room-manager';
import { DEFAULT_HOST_RULES } from '../domain/ruleset';

async function setup(turnTimerSeconds = 30) {
  const store = new MemoryStore();
  await store.init();
  const roomManager = new RoomManager(store);
  const gameManager = new GameManager(store);
  gameManager.onGamePurged((_gameId, roomId) => roomManager.deleteRoom(roomId));
  const host = roomManager.registerPlayer('Alice');
  const guest = roomManager.registerPlayer('Bob');
  const room = (await roomManager.createRoom(host.uid, { ...DEFAULT_HOST_RULES, turnTimerSeconds })).room!;
  roomManager.joinRoom(room.inviteCode, guest.uid);
  roomManager.setReady(room.roomId, host.uid, true);
  roomManager.setReady(room.roomId, guest.uid, true);
  const start = await gameManager.startGame(room, host.uid, { forcedPlayerOrder: [host.uid, guest.uid] });
  return { store, roomManager, gameManager, room, host, guest, gameId: start.gameId! };
}

describe('Finished game cleanup', () => {
  it('keeps the game until every human closes it, then deletes game, room and history', async () => {
    const { store, roomManager, gameManager, room, host, guest, gameId } = await setup();
    const state = gameManager.getGame(gameId)!;
    state.status = 'COMPLETED';
    state.completedAt = Date.now();

    expect(gameManager.markGameClosed(gameId, host.uid)).toBe(false);
    expect(gameManager.getGame(gameId)).not.toBeNull();

    expect(gameManager.markGameClosed(gameId, guest.uid)).toBe(true);
    expect(gameManager.getGame(gameId)).toBeNull();
    expect(gameManager.getArchive(gameId)).toBeNull();
    expect(roomManager.getRoom(room.roomId)).toBeNull();
    expect(roomManager.getRoomByCode(room.inviteCode)).toBeNull();

    await gameManager.flushPersistence(gameId);
    expect(await store.getGame(gameId)).toBeNull();
    expect(await store.getRoom(room.roomId)).toBeNull();
    gameManager.stopTurnTimer(gameId);
  });

  it('ignores close requests for games still in progress', async () => {
    const { gameManager, host, gameId } = await setup();
    expect(gameManager.markGameClosed(gameId, host.uid)).toBe(false);
    expect(gameManager.getGame(gameId)).not.toBeNull();
    gameManager.purgeGame(gameId);
  });
});

describe('3-second turn timer', () => {
  it('creates rooms and games with a 3s turn limit', async () => {
    const { room, gameManager, gameId } = await setup(3);
    expect(room.turnTimerSeconds).toBe(3);
    expect(gameManager.getGame(gameId)!.rules?.turnTimerSeconds).toBe(3);
    gameManager.purgeGame(gameId);
  });
});
