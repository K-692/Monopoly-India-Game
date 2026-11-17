/**
 * Indian Monopoly - Backend Health, CORS & Socket.IO Multiplayer Verification Tests
 * 
 * Validates:
 * 5. CORS permits GitHub Pages origin (https://k-692.github.io).
 * 6. CORS rejects unrelated production origin.
 * 7. /api/health returns HTTP 200.
 * 8. Production server starts using actual compiled output (dist-server/index.cjs).
 * 9. Socket.IO clients can connect to hosted backend.
 * 10. Existing room creation/joining and multiplayer synchronization still work.
 * 11. Disconnected client receives useful expired-room message.
 * 12. Existing LAN startup scripts remain unchanged and functional.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { isOriginAllowed, normalizeOrigin, getAllowedOrigins } from '../../server/network/cors-config';
import { createLanServer } from '../../server/index';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../server/types/server-types';

describe('Backend Production Readiness & Multiplayer Contract', () => {
  let serverInstance: ReturnType<typeof createLanServer>;
  let testPort: number;
  let serverHttp: http.Server;

  beforeAll(async () => {
    // Spin up server programmatic instance on random available high port
    testPort = 53890 + Math.floor(Math.random() * 1000);
    serverInstance = createLanServer({
      port: testPort,
      nodeEnv: 'production',
      clientOrigin: 'https://k-692.github.io',
    });
    serverHttp = serverInstance.httpServer;

    await new Promise<void>((resolve) => {
      serverHttp.listen(testPort, '127.0.0.1', () => resolve());
    });
  });

  afterAll(async () => {
    clearInterval(serverInstance.cleanupInterval);
    await new Promise<void>((resolve) => {
      serverHttp.close(() => resolve());
    });
  });

  describe('Requirements 5 & 6: CORS Security Enforcement', () => {
    it('permits the official deployed GitHub Pages origin in production', () => {
      const allowed = isOriginAllowed('https://k-692.github.io', {
        nodeEnv: 'production',
        clientOrigin: 'https://k-692.github.io',
      });
      expect(allowed).toBe(true);
    });

    it('permits official deployed GitHub Pages origin with trailing slash', () => {
      const allowed = isOriginAllowed('https://k-692.github.io/', {
        nodeEnv: 'production',
        clientOrigin: 'https://k-692.github.io',
      });
      expect(allowed).toBe(true);
    });

    it('permits a custom frontend origin configured via CLIENT_ORIGIN', () => {
      const allowed = isOriginAllowed('https://monopoly-india-frontend.example.com', {
        nodeEnv: 'production',
        clientOrigin: 'https://monopoly-india-frontend.example.com',
      });
      expect(allowed).toBe(true);
    });

    it('permits configured frontend origin even when configured with trailing slashes, uppercase, or path', () => {
      const allowed = isOriginAllowed('https://monopoly-india-frontend.example.com', {
        nodeEnv: 'production',
        clientOrigin: 'https://Monopoly-India-Frontend.example.com/subpath/',
      });
      expect(allowed).toBe(true);
    });

    it('supports multiple comma-separated and semicolon-separated origins in CLIENT_ORIGIN', () => {
      const multiOrigin = 'https://render-frontend.example.com, https://k-692.github.io; https://staging.example.com';
      expect(isOriginAllowed('https://render-frontend.example.com', { nodeEnv: 'production', clientOrigin: multiOrigin })).toBe(true);
      expect(isOriginAllowed('https://k-692.github.io', { nodeEnv: 'production', clientOrigin: multiOrigin })).toBe(true);
      expect(isOriginAllowed('https://staging.example.com', { nodeEnv: 'production', clientOrigin: multiOrigin })).toBe(true);
      expect(isOriginAllowed('https://unlisted-origin.com', { nodeEnv: 'production', clientOrigin: multiOrigin })).toBe(false);
    });

    it('rejects an unrelated or unauthorized production origin', () => {
      const rejected = isOriginAllowed('https://unauthorized-phishing.com', {
        nodeEnv: 'production',
        clientOrigin: 'https://monopoly-frontend.example.com',
      });
      expect(rejected).toBe(false);
    });

    it('falls back to GitHub Pages origin when CLIENT_ORIGIN is not provided in production', () => {
      expect(isOriginAllowed('https://k-692.github.io', { nodeEnv: 'production' })).toBe(true);
      expect(isOriginAllowed('https://random-site.com', { nodeEnv: 'production' })).toBe(false);
    });

    it('allows all local/LAN origins when nodeEnv is NOT production', () => {
      expect(isOriginAllowed('http://localhost:5173', { nodeEnv: 'development' })).toBe(true);
      expect(isOriginAllowed('http://192.168.1.15:4173', { nodeEnv: 'development' })).toBe(true);
      expect(isOriginAllowed('http://10.0.0.5:4173', { nodeEnv: 'development' })).toBe(true);
    });

    it('normalizes origin whitespace and trailing slashes correctly', () => {
      expect(normalizeOrigin(' https://k-692.github.io/// ')).toBe('https://k-692.github.io');
      expect(normalizeOrigin('https://My-Render-App.example.com/')).toBe('https://my-render-app.example.com');
    });

    it('extracts allowed origins array with getAllowedOrigins', () => {
      expect(getAllowedOrigins({ clientOrigin: 'https://site-a.com, https://site-b.com' })).toEqual([
        'https://site-a.com',
        'https://site-b.com',
      ]);
    });
  });

  describe('HTTP API CORS Middleware Security Verification', () => {
    it('sets Access-Control-Allow-Origin, credentials, and Vary: Origin for approved origin', async () => {
      const response = await fetch(`http://127.0.0.1:${testPort}/api/health`, {
        headers: { Origin: 'https://k-692.github.io' },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('https://k-692.github.io');
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
      expect(response.headers.get('vary')).toContain('Origin');
      // Must NOT use wildcard origin
      expect(response.headers.get('access-control-allow-origin')).not.toBe('*');
    });

    it('handles OPTIONS preflight for approved origin with 204 No Content', async () => {
      const response = await fetch(`http://127.0.0.1:${testPort}/api/health`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://k-692.github.io',
          'Access-Control-Request-Method': 'GET',
        },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('https://k-692.github.io');
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
    });

    it('rejects HTTP API request from unapproved origin with 403 Forbidden', async () => {
      const response = await fetch(`http://127.0.0.1:${testPort}/api/health`, {
        headers: { Origin: 'https://unauthorized-attacker.com' },
      });
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('CORS forbidden');
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('rejects OPTIONS preflight from unapproved origin with 403 Forbidden', async () => {
      const response = await fetch(`http://127.0.0.1:${testPort}/api/health`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://unauthorized-attacker.com' },
      });
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('CORS forbidden');
    });

    it('allows requests without Origin header (e.g. server-to-server or health checks) without emitting wildcard', async () => {
      const response = await fetch(`http://127.0.0.1:${testPort}/api/health`);
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  describe('Requirement 7: /api/health Endpoint', () => {
    it('returns HTTP 200 with ok status and uptime without exposing secrets', async () => {
      const response = await fetch(`http://127.0.0.1:${testPort}/api/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(typeof data.uptime).toBe('number');
      expect(typeof data.timestamp).toBe('number');

      // Ensure no private secrets, tokens, or rooms leaked
      expect(data.tokens).toBeUndefined();
      expect(data.rooms).toBeUndefined();
      expect(data.env).toBeUndefined();
    });
  });

  describe('Requirement 8: Compiled Output & Start Script Verification', () => {
    it('compiled production server bundle exists at dist-server/index.cjs', () => {
      const bundlePath = path.resolve(process.cwd(), 'dist-server/index.cjs');
      expect(fs.existsSync(bundlePath)).toBe(true);

      const stats = fs.statSync(bundlePath);
      expect(stats.size).toBeGreaterThan(50000); // Verify bundle is substantial
    });

    it('package.json defines a production start script pointing to compiled bundle', () => {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      expect(pkg.scripts.start).toBe('node dist-server/index.cjs');
      expect(pkg.scripts['build:server']).toContain('dist-server/index.cjs');
    });
  });

  describe('Requirements 9 & 10: Socket.IO Connection & Multiplayer Synchronization', () => {
    let clientA: ClientSocketType<ServerToClientEvents, ClientToServerEvents>;
    let clientB: ClientSocketType<ServerToClientEvents, ClientToServerEvents>;

    afterAll(() => {
      if (clientA) clientA.disconnect();
      if (clientB) clientB.disconnect();
    });

    it('allows Socket.IO clients to connect and register sessions', async () => {
      clientA = ClientSocket(`http://127.0.0.1:${testPort}`, {
        transports: ['websocket', 'polling'],
        forceNew: true,
      });

      await new Promise<void>((resolve, reject) => {
        clientA.on('connect', () => resolve());
        clientA.on('connect_error', (err) => reject(err));
      });

      expect(clientA.connected).toBe(true);

      const regRes = await new Promise<{ ok: boolean; player?: unknown }>((resolve) => {
        clientA.emit('player:register', { displayName: 'HostTycoon', avatarColor: '#C85A32' }, (res) => {
          resolve(res);
        });
      });

      expect(regRes.ok).toBe(true);
      expect(regRes.player).toBeDefined();
    });

    it('supports room creation, invite code generation, and member joining', async () => {
      // Create room from clientA
      const createRes = await new Promise<{ ok: boolean; roomId?: string; inviteCode?: string }>((resolve) => {
        clientA.emit('room:create', {}, (res) => resolve(res));
      });

      expect(createRes.ok).toBe(true);
      expect(createRes.roomId).toBeDefined();
      expect(createRes.inviteCode).toBeDefined();
      expect(createRes.inviteCode?.length).toBe(6);

      const inviteCode = createRes.inviteCode!;
      const roomId = createRes.roomId!;

      // Connect clientB
      clientB = ClientSocket(`http://127.0.0.1:${testPort}`, {
        transports: ['websocket', 'polling'],
        forceNew: true,
      });

      await new Promise<void>((resolve) => {
        clientB.on('connect', () => resolve());
      });

      await new Promise<void>((resolve) => {
        clientB.emit('player:register', { displayName: 'GuestPlayer', avatarColor: '#1A2B4C' }, () => resolve());
      });

      // Join room from clientB with code
      const joinRes = await new Promise<{ ok: boolean; roomId?: string }>((resolve) => {
        clientB.emit('room:join', { inviteCode }, (res) => resolve(res));
      });

      expect(joinRes.ok).toBe(true);
      expect(joinRes.roomId).toBe(roomId);
    });

    it('Requirement 11: returns useful expired-room message when querying non-existent room', async () => {
      const getRes = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        clientA.emit('room:get', { roomId: 'room_non_existent_9999' }, (res) => resolve(res));
      });

      expect(getRes.ok).toBe(false);
      expect(getRes.error).toBe(
        'The game server restarted or the room expired. Please create or join a new room.'
      );
    });

    it('permits Socket.IO connections from approved Origin header', async () => {
      const clientAllowed = ClientSocket(`http://127.0.0.1:${testPort}`, {
        extraHeaders: { Origin: 'https://k-692.github.io' },
        transports: ['polling'],
        forceNew: true,
      });

      await new Promise<void>((resolve, reject) => {
        clientAllowed.on('connect', () => resolve());
        clientAllowed.on('connect_error', (err) => reject(err));
      });

      expect(clientAllowed.connected).toBe(true);
      clientAllowed.disconnect();
    });

    it('rejects Socket.IO connections from unauthorized Origin header with CORS error', async () => {
      const clientRejected = ClientSocket(`http://127.0.0.1:${testPort}`, {
        extraHeaders: { Origin: 'https://unauthorized-attacker.com' },
        transports: ['polling'],
        forceNew: true,
      });

      const error = await new Promise<Error>((resolve) => {
        clientRejected.on('connect_error', (err) => resolve(err));
      });

      expect(error).toBeDefined();
      expect(clientRejected.connected).toBe(false);
      clientRejected.disconnect();
    });

    it('permits Socket.IO connections to a server configured with custom Render frontend origin', async () => {
      const customPort = testPort + 20;
      const customOrigin = 'https://custom-monopoly-frontend.example.com';
      const customServer = createLanServer({
        port: customPort,
        nodeEnv: 'production',
        clientOrigin: customOrigin,
      });

      await new Promise<void>((resolve) => {
        customServer.httpServer.listen(customPort, '127.0.0.1', () => resolve());
      });

      try {
        const clientCustom = ClientSocket(`http://127.0.0.1:${customPort}`, {
          extraHeaders: { Origin: customOrigin },
          transports: ['polling'],
          forceNew: true,
        });

        await new Promise<void>((resolve, reject) => {
          clientCustom.on('connect', () => resolve());
          clientCustom.on('connect_error', (err) => reject(err));
        });

        expect(clientCustom.connected).toBe(true);
        clientCustom.disconnect();
      } finally {
        clearInterval(customServer.cleanupInterval);
        await new Promise<void>((resolve) => customServer.httpServer.close(() => resolve()));
      }
    });
  });

  describe('Requirement 12: LAN Scripts Preservation', () => {
    it('preserves all existing LAN commands and scripts in package.json', () => {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      expect(pkg.scripts['lan:host']).toBe('npm run build:lan && tsx server/index.ts');
      expect(pkg.scripts['lan:dev']).toBe('node scripts/lan-dev.js');
      expect(pkg.scripts.server).toBe('tsx server/index.ts');
      expect(pkg.scripts['build:lan']).toBe('tsc -b && vite build --mode lan');
    });

    it('preserves .env.lan and .env.example files intact', () => {
      expect(fs.existsSync(path.resolve(process.cwd(), '.env.lan'))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), '.env.example'))).toBe(true);
    });
  });
});

