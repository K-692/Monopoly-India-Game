/**
 * Indian Monopoly - LAN Authoritative Server
 * Express + Socket.IO server hosting the production-built React app
 * and providing authoritative real-time multiplayer gameplay across the local network.
 */

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server } from 'socket.io';
import { getLanAddresses, getLanServerInfo } from './network/get-lan-addresses';
import { RoomManager } from './rooms/room-manager';
import { GameManager } from './game/game-manager';
import { setupSocketHandlers } from './socket/socket-handlers';
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from './types/server-types';

const PORT = parseInt(process.env.PORT || '4173', 10);
const HOST = '0.0.0.0';

export function createLanServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Initialize Socket.IO with CORS open for local LAN origins
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      pingTimeout: 10000,
      pingInterval: 5000,
      maxHttpBufferSize: 1e6, // 1MB payload limit
    }
  );

  const roomManager = new RoomManager();
  const gameManager = new GameManager();

  // Setup Socket.IO Event Handlers
  setupSocketHandlers(io, roomManager, gameManager);

  // Setup periodic cleanup of abandoned rooms
  const cleanupInterval = setInterval(() => {
    roomManager.cleanupExpiredRooms();
  }, 15 * 60 * 1000);

  // Enable CORS for LAN and local development origins
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // Express middleware
  app.use(express.json());

  // API Endpoints
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  });

  app.get('/api/lan-info', (_req, res) => {
    const info = getLanServerInfo(PORT);
    res.json(info);
  });

  // Serve production-built React frontend assets from 'dist' directory
  const distPath = path.resolve(process.cwd(), 'dist');
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
        '<h1>Indian Monopoly LAN Server</h1><p>Frontend dist directory not found. Run <code>npm run build:lan</code> first.</p>'
      );
    });
  }

  return { app, httpServer, io, roomManager, gameManager, cleanupInterval };
}

// Start server directly when executed as main module
const isMain = process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));
if (isMain) {
  const { httpServer } = createLanServer();

  httpServer.listen(PORT, HOST, () => {
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
  });

  const handleShutdown = () => {
    console.log('\nStopping LAN server and clearing in-memory rooms...');
    httpServer.close(() => {
      console.log('LAN Server stopped cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}
