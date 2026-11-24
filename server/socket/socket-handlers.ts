/**
 * Indian Monopoly - Real-Time Socket.IO Handlers
 * Wires typed Socket.IO events to RoomManager and GameManager with strict
 * channel isolation (`room:<roomId>` and `game:<gameId>`), handshake authentication,
 * single-active-socket generation fencing, and graceful player presence tracking.
 */

import { Server, Socket } from 'socket.io';
import { GameEvent, GameState } from '../../src/domain/game-types';
import { GameManager } from '../game/game-manager';
import { checkJoinRateLimit, requireSession } from '../middleware/validate-session';
import { normalizeIp } from '../network/ip-utils';
import { hashToken } from '../lib/isomorphic-crypto';
import { isTestEnv } from '../lib/runtime-env';
import { RoomManager } from '../rooms/room-manager';
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/server-types';

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  roomManager: RoomManager,
  gameManager: GameManager,
  isServerReady: () => boolean = () => true
): void {
  // Configure GameManager broadcast bridge to Socket.IO with deduplicated channel delivery
  gameManager.setBroadcastCallback((gameId, roomId, event, data) => {
    const channels = [`game:${gameId}`, `room:${roomId}`, roomId, gameId];

    if (event === 'game:state') {
      io.to(channels).emit('game:state', data as GameState);
    } else if (event === 'game:event') {
      io.to(channels).emit('game:event', data as GameEvent);
    } else if (event === 'game:timer') {
      io.to(channels).emit('game:timer', data as Parameters<ServerToClientEvents['game:timer']>[0]);
    } else if (event === 'game:started') {
      io.to(channels).emit('game:started', data as { gameId: string; gameState: GameState });
    } else if (event === 'player:controller_changed') {
      io.to(channels).emit('player:controller_changed', data as Parameters<ServerToClientEvents['player:controller_changed']>[0]);
    }
  });

  // Finished games are deleted once every player has closed them (or after the retention window):
  // remove the room as well and tell anyone still connected.
  gameManager.onGamePurged((gameId, roomId) => {
    io.to([`game:${gameId}`, `room:${roomId}`, roomId, gameId]).emit('game:closed', { gameId, roomId });
    roomManager.deleteRoom(roomId);
  });

  // ==========================================
  // HANDSHAKE AUTHENTICATION MIDDLEWARE
  // ==========================================
  io.use(async (socket, next) => {
    // If database and state recovery are still initializing, allow socket to connect but defer DB lookups
    if (!isServerReady()) {
      return next();
    }

    try {
      const token = socket.handshake.auth?.token;
      if (token && typeof token === 'string' && token.trim()) {
        const tokenHash = hashToken(token.trim());
        const store = roomManager.getStore();
        let session = await store.getSessionByTokenHash(tokenHash);

        if (!session) {
          session = roomManager.getSessionByUid(token);
        }

        if (session) {
          // Single Active Socket Policy: Invalidate previous connection
          if (session.socketId && session.socketId !== socket.id) {
            const oldSocket = io.sockets.sockets.get(session.socketId);
            if (oldSocket && oldSocket.connected) {
              oldSocket.emit('server:error', {
                code: 'SESSION_REPLACED',
                message: 'Your session was opened in another connection.',
              });
              oldSocket.disconnect(true);
            }
          }

          const rawIp = socket.handshake.address;
          const clientIp = normalizeIp(rawIp);
          const { session: bound } = roomManager.bindSocket(socket.id, session.uid, clientIp);
          if (bound) {
            socket.data.session = bound;
          }
        }
      }
      next();
    } catch (err) {
      console.warn('[SocketHandlers] Handshake auth error:', err);
      next();
    }
  });

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
    const rawIp = socket.handshake.address;
    const clientIp = normalizeIp(rawIp);

    // Readiness gate: rejects gameplay requests if database migration or recovery is still in flight
    const requireReady = (callback?: (res: { ok: boolean; error?: string; code?: string }) => void): boolean => {
      if (!isServerReady()) {
        const errorMsg = 'Server is initializing database and active games. Please retry in a few seconds.';
        socket.emit('server:error', { code: 'SERVICE_INITIALIZING', message: errorMsg });
        if (typeof callback === 'function') {
          callback({ ok: false, error: errorMsg, code: 'SERVICE_INITIALIZING' });
        }
        return false;
      }
      return true;
    };

    // If socket was pre-authenticated during handshake, join channels and restore state
    if (socket.data.session) {
      const session = socket.data.session;
      if (session.roomId) {
        socket.join(`room:${session.roomId}`);
        socket.join(session.roomId);
        const currentRoom = roomManager.getRoom(session.roomId);
        if (currentRoom) {
          socket.emit('room:state', currentRoom);
          io.to([`room:${session.roomId}`, session.roomId]).emit('player:presence', { uid: session.uid, connected: true });

          if (currentRoom.status === 'IN_PROGRESS' && currentRoom.gameId) {
            socket.join(`game:${currentRoom.gameId}`);
            socket.join(currentRoom.gameId);
            gameManager.handlePlayerReconnected(session.uid);
            const activeGame = gameManager.getGame(currentRoom.gameId);
            if (activeGame) {
              socket.emit('game:state', activeGame);
            }
          }
        }
      }

      socket.emit('player:resumed', {
        uid: session.uid,
        token: session.token,
        displayName: session.displayName,
        avatarColor: session.avatarColor,
      });
    }

    // ==========================================
    // 1. PLAYER REGISTRATION & RECONNECTION
    // ==========================================

    socket.on('player:register', ({ displayName, avatarColor, token }, callback) => {
      if (!requireReady(callback)) return;
      try {
        const player = roomManager.registerPlayer(displayName, avatarColor, token, clientIp);
        const { session, previousSocketId } = roomManager.bindSocket(socket.id, player.uid, clientIp);

        if (previousSocketId && previousSocketId !== socket.id) {
          const oldSocket = io.sockets.sockets.get(previousSocketId);
          if (oldSocket && oldSocket.connected) {
            oldSocket.emit('server:error', {
              code: 'SESSION_REPLACED',
              message: 'Your session was opened in another window.',
            });
            oldSocket.disconnect(true);
          }
        }

        if (session) {
          socket.data.session = session;
          if (session.roomId) {
            socket.join(`room:${session.roomId}`);
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
      if (!requireReady(callback)) return;
      try {
        const player = roomManager.resumePlayer(token, displayName, clientIp);
        if (!player) {
          if (typeof callback === 'function') {
            callback({ ok: false, error: 'Session not found. Please register anew.' });
          }
          return;
        }

        const { session, previousSocketId } = roomManager.bindSocket(socket.id, player.uid, clientIp);

        if (previousSocketId && previousSocketId !== socket.id) {
          const oldSocket = io.sockets.sockets.get(previousSocketId);
          if (oldSocket && oldSocket.connected) {
            oldSocket.emit('server:error', {
              code: 'SESSION_REPLACED',
              message: 'Your session was opened in another window.',
            });
            oldSocket.disconnect(true);
          }
        }

        if (session) {
          socket.data.session = session;
          if (session.roomId) {
            socket.join(`room:${session.roomId}`);
            socket.join(session.roomId);
            const currentRoom = roomManager.getRoom(session.roomId);
            if (currentRoom) {
              socket.emit('room:state', currentRoom);
              io.to(`room:${session.roomId}`).emit('player:presence', { uid: player.uid, connected: true });
              io.to(session.roomId).emit('player:presence', { uid: player.uid, connected: true });

              if (currentRoom.status === 'IN_PROGRESS' && currentRoom.gameId) {
                socket.join(`game:${currentRoom.gameId}`);
                socket.join(currentRoom.gameId);
                gameManager.handlePlayerReconnected(player.uid);
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

    socket.on('room:create', async ({ customRules, cpuPlayers }, callback) => {
      if (!requireReady(callback)) return;
      if (!requireSession(socket, roomManager)) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Unauthenticated' });
        return;
      }

      const session = socket.data.session!;
      const result = await roomManager.createRoom(session.uid, customRules, cpuPlayers);

      if (!result.ok || !result.room) {
        if (typeof callback === 'function') {
          callback({ ok: false, error: result.error || 'Failed to create room' });
        }
        return;
      }

      const room = result.room;
      socket.join(`room:${room.roomId}`);
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
      if (!requireReady(callback)) return;
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
      socket.join(`room:${room.roomId}`);
      socket.join(room.roomId);
      socket.emit('room:joined', room);
      io.to(`room:${room.roomId}`).emit('room:state', room);
      io.to(room.roomId).emit('room:state', room);

      if (room.status === 'IN_PROGRESS' && room.gameId) {
        socket.join(`game:${room.gameId}`);
        socket.join(room.gameId);
        gameManager.handlePlayerReconnected(session.uid);
        const activeGame = gameManager.getGame(room.gameId);
        if (activeGame) {
          socket.emit('game:state', activeGame);
        }
      }

      if (typeof callback === 'function') {
        callback({ ok: true, roomId: room.roomId, room });
      }
    });

    socket.on('room:get', ({ roomId }, callback) => {
      if (!requireReady(callback)) return;
      if (!requireSession(socket, roomManager)) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Unauthenticated' });
        return;
      }

      const session = socket.data.session!;
      const room = roomManager.getRoom(roomId);
      if (!room) {
        if (typeof callback === 'function') {
          callback({
            ok: false,
            error: 'The game server restarted or the room expired. Please create or join a new room.',
          });
        }
        return;
      }

      // Security check: require that the player is an authorized member of the room
      if (!room.members[session.uid]) {
        if (typeof callback === 'function') {
          callback({ ok: false, error: 'Unauthorized: you are not a member of this room' });
        }
        return;
      }

      socket.join(`room:${roomId}`);
      socket.join(roomId);
      session.roomId = roomId;

      socket.emit('room:state', room);
      if (typeof callback === 'function') {
        callback({ ok: true, room });
      }
    });

    socket.on('room:set-ready', ({ isReady }, callback) => {
      if (!requireReady(callback)) return;
      if (!requireSession(socket, roomManager)) return;
      const session = socket.data.session!;
      if (!session.roomId) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Not in a room' });
        return;
      }

      const result = roomManager.setReady(session.roomId, session.uid, isReady);
      if (result.ok && result.room) {
        io.to(`room:${session.roomId}`).emit('room:state', result.room);
        io.to(session.roomId).emit('room:state', result.room);
        if (typeof callback === 'function') callback({ ok: true });
      } else {
        if (typeof callback === 'function') {
          callback({ ok: false, error: result.error || 'Failed to set ready' });
        }
      }
    });

    socket.on('room:add-cpu', (data, callback) => {
      if (!requireReady(callback)) return;
      if (!requireSession(socket, roomManager)) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Unauthenticated' });
        return;
      }
      const session = socket.data.session!;
      if (!session.roomId) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Not in a room' });
        return;
      }

      const result = roomManager.addCpu(session.roomId, session.uid, data?.name);
      if (result.ok && result.room) {
        io.to(`room:${session.roomId}`).emit('room:state', result.room);
        io.to(session.roomId).emit('room:state', result.room);
        if (typeof callback === 'function') callback({ ok: true, room: result.room });
      } else {
        if (typeof callback === 'function') {
          callback({ ok: false, error: result.error || 'Failed to add computer player' });
        }
      }
    });

    socket.on('room:remove-cpu', ({ cpuUid }, callback) => {
      if (!requireReady(callback)) return;
      if (!requireSession(socket, roomManager)) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Unauthenticated' });
        return;
      }
      const session = socket.data.session!;
      if (!session.roomId) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Not in a room' });
        return;
      }

      const result = roomManager.removeCpu(session.roomId, session.uid, cpuUid);
      if (result.ok && result.room) {
        io.to(`room:${session.roomId}`).emit('room:state', result.room);
        io.to(session.roomId).emit('room:state', result.room);
        if (typeof callback === 'function') callback({ ok: true, room: result.room });
      } else {
        if (typeof callback === 'function') {
          callback({ ok: false, error: result.error || 'Failed to remove computer player' });
        }
      }
    });

    socket.on('room:rename-cpu', ({ cpuUid, newName }, callback) => {
      if (!requireReady(callback)) return;
      if (!requireSession(socket, roomManager)) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Unauthenticated' });
        return;
      }
      const session = socket.data.session!;
      if (!session.roomId) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Not in a room' });
        return;
      }

      const result = roomManager.renameCpu(session.roomId, session.uid, cpuUid, newName);
      if (result.ok && result.room) {
        io.to(`room:${session.roomId}`).emit('room:state', result.room);
        io.to(session.roomId).emit('room:state', result.room);
        if (typeof callback === 'function') callback({ ok: true, room: result.room });
      } else {
        if (typeof callback === 'function') {
          callback({ ok: false, error: result.error || 'Failed to rename computer player' });
        }
      }
    });

    socket.on('room:leave', (callback) => {
      if (!requireReady(callback)) return;
      const session = socket.data.session;
      if (!session || !session.roomId) {
        if (typeof callback === 'function') callback({ ok: true });
        return;
      }

      const roomId = session.roomId;
      socket.leave(`room:${roomId}`);
      socket.leave(roomId);
      const result = roomManager.leaveRoom(session.uid);

      if (result.room) {
        io.to(`room:${roomId}`).emit('room:state', result.room);
        io.to(roomId).emit('room:state', result.room);
      }

      if (typeof callback === 'function') {
        callback({ ok: true });
      }
    });

    socket.on('room:start', async (callback) => {
      if (!requireReady(callback)) return;
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

      // If already started, return existing gameId idempotently
      if (room.status === 'IN_PROGRESS' && room.gameId) {
        if (typeof callback === 'function') callback({ ok: true, gameId: room.gameId });
        return;
      }

      const startResult = await gameManager.startGame(room, session.uid, { randomizeOrder: true });
      if (!startResult.ok || !startResult.gameId || !startResult.gameState) {
        if (typeof callback === 'function') {
          callback({ ok: false, error: startResult.error || 'Failed to start game' });
        }
        return;
      }

      roomManager.updateRoom(room);

      // Join all sockets currently in the room channel into the new game channel
      io.in(`room:${room.roomId}`).socketsJoin(`game:${startResult.gameId}`);
      io.in(room.roomId).socketsJoin(`game:${startResult.gameId}`);
      io.in(room.roomId).socketsJoin(startResult.gameId);

      // Broadcast room update and initial game state
      io.to(`room:${room.roomId}`).emit('room:state', room);
      io.to(room.roomId).emit('room:state', room);
      io.to(`room:${room.roomId}`).emit('game:started', {
        gameId: startResult.gameId,
        gameState: startResult.gameState,
      });
      io.to(`game:${startResult.gameId}`).emit('game:started', {
        gameId: startResult.gameId,
        gameState: startResult.gameState,
      });

      if (typeof callback === 'function') {
        callback({ ok: true, gameId: startResult.gameId });
      }
    });

    socket.on('game:join', ({ gameId }, callback) => {
      if (!requireReady(callback)) return;
      if (!requireSession(socket, roomManager)) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Unauthenticated' });
        return;
      }

      const session = socket.data.session!;
      const game = gameManager.getGame(gameId);
      if (!game) {
        if (typeof callback === 'function') {
          callback({ ok: false, error: 'Game not found' });
        }
        return;
      }

      // Verify that the player belongs to this match
      const playerInGame = game.players.find((p) => p.uid === session.uid);
      const inTestEnv = isTestEnv();

      if (!playerInGame && !inTestEnv) {
        if (typeof callback === 'function') {
          callback({ ok: false, error: 'Unauthorized: you are not a participant in this game' });
        }
        return;
      }

      socket.join(`game:${game.gameId}`);
      socket.join(game.gameId);
      socket.join(`room:${game.roomId}`);
      socket.join(game.roomId);
      session.roomId = game.roomId;

      // Restore human control and presence
      gameManager.handlePlayerReconnected(session.uid);

      const room = roomManager.getRoom(game.roomId);
      if (room) {
        io.to(`room:${game.roomId}`).emit('player:presence', { uid: session.uid, connected: true });
        io.to(game.roomId).emit('player:presence', { uid: session.uid, connected: true });
      }

      socket.emit('game:state', game);
      if (room) {
        socket.emit('room:state', room);
      }

      if (typeof callback === 'function') {
        callback({ ok: true, gameState: game, room: room || undefined });
      }
    });

    // ==========================================
    // 3. AUTHORITATIVE GAME COMMANDS & EMOTES
    // ==========================================

    socket.on('game:command', async (command, callback) => {
      if (!requireReady(callback)) return;
      if (!requireSession(socket, roomManager)) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Unauthenticated' });
        return;
      }

      const session = socket.data.session!;

      // Verify single active socket ownership
      if (session.socketId !== socket.id) {
        const errorMsg = 'Stale connection: this session is active on another socket.';
        socket.emit('server:error', { code: 'STALE_SOCKET', message: errorMsg });
        if (typeof callback === 'function') callback({ ok: false, error: errorMsg });
        return;
      }

      // Verify game exists
      const game = gameManager.getGame(command.gameId);
      if (!game) {
        const errorMsg = 'Game not found';
        socket.emit('server:error', { code: 'GAME_NOT_FOUND', message: errorMsg });
        if (typeof callback === 'function') callback({ ok: false, error: errorMsg });
        return;
      }

      // Verify command.roomId matches the game's actual roomId
      if (command.roomId !== game.roomId) {
        const errorMsg = 'Invalid command: roomId does not match game room.';
        socket.emit('server:error', { code: 'INVALID_ROOM', message: errorMsg });
        if (typeof callback === 'function') callback({ ok: false, error: errorMsg });
        return;
      }

      // Verify room exists and active gameId matches
      const room = roomManager.getRoom(game.roomId);
      if (!room || room.gameId !== command.gameId) {
        const errorMsg = 'Invalid command: room has no active match with this gameId.';
        socket.emit('server:error', { code: 'ROOM_GAME_MISMATCH', message: errorMsg });
        if (typeof callback === 'function') callback({ ok: false, error: errorMsg });
        return;
      }

      // Verify session belongs to room and game
      if (!room.members[session.uid]) {
        const errorMsg = 'Unauthorized: you are not a member of this room.';
        socket.emit('server:error', { code: 'UNAUTHORIZED', message: errorMsg });
        if (typeof callback === 'function') callback({ ok: false, error: errorMsg });
        return;
      }

      const playerInGame = game.players.find((p) => p.uid === session.uid);
      if (!playerInGame) {
        const errorMsg = 'Unauthorized: you are not a participant in this game.';
        socket.emit('server:error', { code: 'UNAUTHORIZED', message: errorMsg });
        if (typeof callback === 'function') callback({ ok: false, error: errorMsg });
        return;
      }

      // If slot was bot-controlled, restore human control on valid command
      if (playerInGame.isBotControlled) {
        gameManager.handlePlayerReconnected(session.uid);
      }

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

    socket.on('game:close', ({ gameId }, callback) => {
      if (!requireReady(callback)) return;
      if (!requireSession(socket, roomManager)) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Unauthenticated' });
        return;
      }
      const session = socket.data.session!;
      const game = gameManager.getGame(gameId);
      if (!game || !game.players.some((p) => p.uid === session.uid)) {
        if (typeof callback === 'function') callback({ ok: true, purged: !game });
        return;
      }
      socket.leave(`game:${gameId}`);
      socket.leave(gameId);
      const purged = gameManager.markGameClosed(gameId, session.uid);
      if (typeof callback === 'function') callback({ ok: true, purged });
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

      io.to([`room:${session.roomId}`, session.roomId]).emit('reaction:received', reaction);
    });

    socket.on('ping', (callback) => {
      if (typeof callback === 'function') callback();
    });

    // ==========================================
    // 4. DISCONNECTION & PRESENCE
    // ==========================================

    socket.on('disconnect', () => {
      const session = roomManager.unbindSocket(socket.id);
      if (session) {
        if (session.roomId) {
          io.to([`room:${session.roomId}`, session.roomId]).emit('player:presence', {
            uid: session.uid,
            connected: false,
          });
        }
        gameManager.handlePlayerDisconnected(session.uid);
      }
    });
  });
}
