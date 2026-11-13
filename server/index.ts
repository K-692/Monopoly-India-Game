/**
 * Indian Monopoly - Production & LAN Authoritative Server
 * Express + Socket.IO server hosting the production-built React app
 * and providing authoritative real-time multiplayer gameplay across
 * local Wi-Fi networks and public cloud deployments (Render).
 */

import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { GameManager } from './game/game-manager';
import { corsMiddleware, isOriginAllowed } from './network/cors-config';
import { getLanAddresses, getLanServerInfo } from './network/get-lan-addresses';
import { createPersistenceStore, PersistenceStore } from './persistence';
import { RoomManager } from './rooms/room-manager';
import { setupSocketHandlers } from './socket/socket-handlers';
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from './types/server-types';

const DEFAULT_PORT = parseInt(process.env.PORT || '4173', 10);
const HOST = '0.0.0.0';

export interface LanServerOptions {
  port?: number;
  distPath?: string;
  clientOrigin?: string;
  nodeEnv?: string;
  store?: PersistenceStore;
}

export function createLanServer(options?: LanServerOptions) {
  const PORT = options?.port ?? DEFAULT_PORT;
  const app = express();
  const httpServer = http.createServer(app);

  // Persistence Store initialization (PostgreSQL in production, In-Memory in LAN/tests)
  const store =
    options?.store ??
    createPersistenceStore({
      databaseUrl: process.env.DATABASE_URL,
      nodeEnv: options?.nodeEnv,
    });

  // Initialize Socket.IO with environment-aware CORS (strict in production, permissive in LAN/dev)
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: (requestOrigin, callback) => {
          if (isOriginAllowed(requestOrigin, { nodeEnv: options?.nodeEnv, clientOrigin: options?.clientOrigin })) {
            callback(null, true);
          } else {
            callback(new Error(`CORS origin not allowed: ${requestOrigin}`));
          }
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 10000,
      pingInterval: 5000,
      maxHttpBufferSize: 1e6, // 1MB payload limit
    }
  );

  const roomManager = new RoomManager(store);
  const gameManager = new GameManager(store);

  // Setup Socket.IO Event Handlers
  setupSocketHandlers(io, roomManager, gameManager);

  let isReady = false;
  let readyError: string | null = null;

  // Initialize store and recover active matches
  const readyPromise = store
    .init()
    .then(() => Promise.all([roomManager.loadActiveState(), gameManager.recoverActiveGames()]))
    .then(() => {
      isReady = true;
      console.log('[Server] Database store and active game state recovered and ready.');
    })
    .catch((err) => {
      readyError = err instanceof Error ? err.message : String(err);
      console.error('[Server] Critical persistence store initialization failure:', err);
    });

  // Setup periodic cleanup of abandoned rooms
  const cleanupInterval = setInterval(() => {
    roomManager.cleanupExpiredRooms();
  }, 15 * 60 * 1000);

  // Apply environment-aware CORS middleware enforcing allowed origin in production, open on LAN
  app.use(corsMiddleware({ nodeEnv: options?.nodeEnv, clientOrigin: options?.clientOrigin }));

  // Express middleware
  app.use(express.json());

  // API Health & Readiness Endpoint
  app.get('/api/health', async (_req, res) => {
    const health = await store.isHealthy();
    const ready = isReady && health.ok;
    const statusCode = ready ? 200 : 503;
    res.status(statusCode).json({
      status: ready ? 'ok' : 'degraded',
      ready,
      uptime: process.uptime(),
      timestamp: Date.now(),
      database: health.ok ? 'connected' : 'error',
      dbError: readyError || health.error,
      connectedClients: io.sockets.sockets.size,
    });
  });

  app.get('/api/lan-info', (_req, res) => {
    const info = getLanServerInfo(PORT);
    res.json(info);
  });

  // Serve production-built React frontend assets from 'dist' directory
  const distPath = options?.distPath ?? path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));

    // SPA fallback: Return index.html for all non-file / non-API routes so React HashRouter works
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.send(
        '<h1>Indian Monopoly Server</h1><p>Frontend dist directory not found. Run <code>npm run build</code> first.</p>'
      );
    });
  }

  return { app, httpServer, io, roomManager, gameManager, store, cleanupInterval, readyPromise };
}

// Start server directly when executed as main module
const isMain =
  (typeof require !== 'undefined' && require.main === module) ||
  Boolean(
    process.argv[1] &&
      (process.argv[1].endsWith('index.ts') ||
        process.argv[1].endsWith('index.js') ||
        process.argv[1].endsWith('index.cjs'))
  );

if (isMain) {
  const PORT = DEFAULT_PORT;
  const { httpServer, store, cleanupInterval, io } = createLanServer({
    port: PORT,
    clientOrigin: process.env.CLIENT_ORIGIN,
    nodeEnv: process.env.NODE_ENV,
  });

  httpServer.listen(PORT, HOST, () => {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      const allowedOriginsDisplay = process.env.CLIENT_ORIGIN
        ? process.env.CLIENT_ORIGIN
        : 'https://k-692.github.io (default fallback - set CLIENT_ORIGIN in Render dashboard for your frontend)';
      console.log(`
========================================
     INDIAN MONOPOLY HOSTED SERVER
========================================

Server Status: RUNNING
Environment: production
Port: ${PORT}
Host: ${HOST}
Health Check: http://localhost:${PORT}/api/health
Allowed Client Origin: ${allowedOriginsDisplay}

Multiplayer Backend: READY
Transport: Socket.IO (WebSocket + Polling)
State Engine: Persistent Store (PostgreSQL / ACID)

Waiting for worldwide players...
========================================
`);
    } else {
      const detected = getLanAddresses();
      const lanLines =
        detected.length > 0
          ? detected.map((d) => `http://${d.address}:${PORT}`).join('\n')
          : 'No external Wi-Fi / LAN interface detected (Local Only)';

      console.log(`
========================================
       INDIAN MONOPOLY LAN SERVER
========================================

Server Status: RUNNING

Local Access:
http://localhost:${PORT}

LAN Access:
${lanLines}

Multiplayer Backend: READY
Transport: Socket.IO

Waiting for players...
========================================
`);
    }
  });

  const handleShutdown = () => {
    console.log('\nStopping server gracefully...');
    clearInterval(cleanupInterval);
    io.close();
    httpServer.close(async () => {
      await store.close().catch(() => {});
      console.log('Server stopped cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}
