/**
 * Indian Monopoly - Real-Time Socket.IO Handlers
 * Wires typed Socket.IO events to RoomManager and GameManager.
 */

import { Server, Socket } from 'socket.io';
import { GameManager } from '../game/game-manager';
import { RoomManager } from '../rooms/room-manager';
import { normalizeIp } from '../network/get-lan-addresses';
import { checkJoinRateLimit, requireSession } from '../middleware/validate-session';
import { GameEvent, GameState } from '../../src/domain/game-types';
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/server-types';

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  roomManager: RoomManager,
  gameManager: GameManager
): void {
  // Configure GameManager broadcast bridge to Socket.IO rooms with strict typing
  gameManager.setBroadcastCallback((roomId, event, data) => {
    if (event === 'game:state') {
      io.to(roomId).emit('game:state', data as GameState);
    } else if (event === 'game:event') {
      io.to(roomId).emit('game:event', data as GameEvent);
    } else if (event === 'game:timer') {
      io.to(roomId).emit('game:timer', data as { remaining: number; activeUid: string });
    } else if (event === 'game:started') {
      io.to(roomId).emit('game:started', data as { gameId: string; gameState: GameState });
    }
  });

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
    const rawIp = socket.handshake.address;
    const clientIp = normalizeIp(rawIp);

    // ==========================================
    // 1. PLAYER REGISTRATION & RECONNECTION
    // ==========================================

    socket.on('player:register', ({ displayName, avatarColor, token }, callback) => {
      try {
        const player = roomManager.registerPlayer(displayName, avatarColor, token, clientIp);
        const session = roomManager.bindSocket(socket.id, player.uid, clientIp);
        if (session) {
          socket.data.session = session;
          if (session.roomId) {
            socket.join(session.roomId);
            const currentRoom = roomManager.getRoom(session.roomId);
            if (currentRoom) {
              socket.emit('room:state', currentRoom);
            }
          }
        }
        socket.emit('player:registered', player);
        if (typeof callback === 'function') {
          callback({ ok: true, player });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Registration failed';
        if (typeof callback === 'function') {
          callback({ ok: false, error: msg });
        }
      }
    });

    socket.on('player:resume', ({ token, displayName }, callback) => {
      try {
        const player = roomManager.resumePlayer(token, displayName, clientIp);
        if (!player) {
          if (typeof callback === 'function') {
            callback({ ok: false, error: 'Session not found. Please register anew.' });
          }
          return;
        }

        const session = roomManager.bindSocket(socket.id, player.uid, clientIp);
        if (session) {
          socket.data.session = session;
          if (session.roomId) {
            socket.join(session.roomId);
            const currentRoom = roomManager.getRoom(session.roomId);
            if (currentRoom) {
              socket.emit('room:state', currentRoom);
              io.to(session.roomId).emit('player:presence', { uid: player.uid, connected: true });

              // If a game is actively running, send current game state immediately
              if (currentRoom.status === 'IN_PROGRESS' && currentRoom.gameId) {
                const game = gameManager.getGame(currentRoom.gameId);
                if (game) {
                  socket.emit('game:state', game);
                }
              }
            }
          }
        }

        socket.emit('player:resumed', player);
        if (typeof callback === 'function') {
          callback({ ok: true, player });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Reconnection failed';
        if (typeof callback === 'function') {
          callback({ ok: false, error: msg });
        }
      }
    });

    // ==========================================
    // 2. ROOM CREATION, JOINING, & LOBBY
    // ==========================================

    socket.on('room:create', ({ customRules }, callback) => {
      if (!requireSession(socket, roomManager)) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Unauthenticated' });
        return;
      }

      const session = socket.data.session!;
      const result = roomManager.createRoom(session.uid, customRules);

      if (!result.ok || !result.room) {
        if (typeof callback === 'function') {
          callback({ ok: false, error: result.error || 'Failed to create room' });
        }
        return;
      }

      const room = result.room;
      socket.join(room.roomId);
      socket.emit('room:created', room);

      if (typeof callback === 'function') {
        callback({
          ok: true,
          roomId: room.roomId,
          inviteCode: room.inviteCode,
          room,
        });
      }
    });

    socket.on('room:join', ({ inviteCode }, callback) => {
      if (!requireSession(socket, roomManager)) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Unauthenticated' });
        return;
      }

      if (!checkJoinRateLimit(clientIp)) {
        const errorMsg = 'Too many join attempts. Please wait a minute before retrying.';
        socket.emit('server:error', { code: 'RATE_LIMIT_EXCEEDED', message: errorMsg });
        if (typeof callback === 'function') callback({ ok: false, error: errorMsg });
        return;
      }

      const session = socket.data.session!;
      const result = roomManager.joinRoom(inviteCode, session.uid);

      if (!result.ok || !result.room) {
        if (typeof callback === 'function') {
          callback({ ok: false, error: result.error || 'Failed to join room' });
        }
        return;
      }

      const room = result.room;
      socket.join(room.roomId);
      socket.emit('room:joined', room);
      io.to(room.roomId).emit('room:state', room);

      // If rejoining an active match, also push active game state
      if (room.status === 'IN_PROGRESS' && room.gameId) {
        const activeGame = gameManager.getGame(room.gameId);
        if (activeGame) {
          socket.emit('game:state', activeGame);
        }
      }

      if (typeof callback === 'function') {
        callback({ ok: true, roomId: room.roomId, room });
      }
    });

    socket.on('room:set-ready', ({ isReady }, callback) => {
      if (!requireSession(socket, roomManager)) return;
      const session = socket.data.session!;
      if (!session.roomId) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Not in a room' });
        return;
      }

      const result = roomManager.setReady(session.roomId, session.uid, isReady);
      if (result.ok && result.room) {
        io.to(session.roomId).emit('room:state', result.room);
        if (typeof callback === 'function') callback({ ok: true });
      } else {
        if (typeof callback === 'function') {
          callback({ ok: false, error: result.error || 'Failed to set ready' });
        }
      }
    });

    socket.on('room:leave', (callback) => {
      const session = socket.data.session;
      if (!session || !session.roomId) {
        if (typeof callback === 'function') callback({ ok: true });
        return;
      }

      const roomId = session.roomId;
      socket.leave(roomId);
      const result = roomManager.leaveRoom(session.uid);

      if (result.room) {
        io.to(roomId).emit('room:state', result.room);
      }

      if (typeof callback === 'function') {
        callback({ ok: true });
      }
    });

    socket.on('room:start', (callback) => {
      if (!requireSession(socket, roomManager)) return;
      const session = socket.data.session!;
      if (!session.roomId) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Not in a room' });
        return;
      }

      const room = roomManager.getRoom(session.roomId);
      if (!room) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Room not found' });
        return;
      }

      const startResult = gameManager.startGame(room, session.uid);
      if (!startResult.ok || !startResult.gameId || !startResult.gameState) {
        if (typeof callback === 'function') {
          callback({ ok: false, error: startResult.error || 'Failed to start game' });
        }
        return;
      }

      roomManager.updateRoom(room);

      // Broadcast room update and initial game state
      io.to(room.roomId).emit('room:state', room);
      io.to(room.roomId).emit('game:started', {
        gameId: startResult.gameId,
        gameState: startResult.gameState,
      });

      if (typeof callback === 'function') {
        callback({ ok: true, gameId: startResult.gameId });
      }
    });

    // ==========================================
    // 3. AUTHORITATIVE GAME COMMANDS & EMOTES
    // ==========================================

    socket.on('game:command', async (command, callback) => {
      if (!requireSession(socket, roomManager)) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Unauthenticated' });
        return;
      }

      const session = socket.data.session!;

      try {
        await gameManager.processCommand(command.gameId, command, session.uid);
        if (typeof callback === 'function') {
          callback({ ok: true });
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Command execution failed';
        socket.emit('server:error', { code: 'COMMAND_ERROR', message: errorMsg });
        if (typeof callback === 'function') {
          callback({ ok: false, error: errorMsg });
        }
      }
    });

    socket.on('reaction:send', ({ emote }) => {
      const session = socket.data.session;
      if (!session || !session.roomId) return;

      const reaction = {
        id: 'reaction_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        roomId: session.roomId,
        senderUid: session.uid,
        senderName: session.displayName,
        emote: (emote || '').slice(0, 10),
        timestamp: Date.now(),
      };

      io.to(session.roomId).emit('reaction:received', reaction);
    });

    socket.on('ping', (callback) => {
      if (typeof callback === 'function') callback();
    });

    // ==========================================
    // 4. DISCONNECTION & PRESENCE
    // ==========================================

    socket.on('disconnect', () => {
      const session = roomManager.unbindSocket(socket.id);
      if (session && session.roomId) {
        io.to(session.roomId).emit('player:presence', {
          uid: session.uid,
          connected: false,
        });
      }
    });
  });
}
