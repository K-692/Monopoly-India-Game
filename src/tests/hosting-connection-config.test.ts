/**
 * Indian Monopoly - Public Hosting & LAN Connection Configuration Tests
 * 
 * Validates:
 * 1. LAN mode still selects the LAN host URL.
 * 2. Public mode selects VITE_SERVER_URL.
 * 3. Production mode does not silently connect to localhost.
 * 4. Missing production backend URL produces a clear error.
 * 11. Disconnected client or missing room receives useful expired-room message.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveServerConfig,
  isPrivateNetworkHost,
  useConnectionStore,
  resetSocketForTesting,
  getSocket,
} from '@/lib/socket/socket-client';

describe('Multiplayer Hosting Connection Configuration', () => {
  beforeEach(() => {
    resetSocketForTesting();
  });

  afterEach(() => {
    resetSocketForTesting();
  });

  describe('Requirement 1: LAN Mode URL Resolution', () => {
    it('selects the LAN host URL when running on private Wi-Fi network host', () => {
      const config = resolveServerConfig(undefined, {
        protocol: 'http:',
        hostname: '192.168.1.100',
        port: '4173',
        origin: 'http://192.168.1.100:4173',
      });

      expect(config.mode).toBe('lan');
      expect(config.isConfigured).toBe(true);
      expect(config.url).toBe('http://192.168.1.100:4173');
      expect(config.error).toBeNull();
    });

    it('selects 10.x.x.x private LAN host origin', () => {
      const config = resolveServerConfig(undefined, {
        protocol: 'http:',
        hostname: '10.0.0.42',
        port: '4173',
        origin: 'http://10.0.0.42:4173',
      });

      expect(config.mode).toBe('lan');
      expect(config.url).toBe('http://10.0.0.42:4173');
    });

    it('selects 172.20.x.x private LAN host origin', () => {
      const config = resolveServerConfig(undefined, {
        protocol: 'http:',
        hostname: '172.20.10.5',
        port: '4173',
        origin: 'http://172.20.10.5:4173',
      });

      expect(config.mode).toBe('lan');
      expect(config.url).toBe('http://172.20.10.5:4173');
    });

    it('selects port 4173 on local machine when in Vite dev server (port 5173)', () => {
      const config = resolveServerConfig(undefined, {
        protocol: 'http:',
        hostname: 'localhost',
        port: '5173',
        origin: 'http://localhost:5173',
      });

      expect(config.mode).toBe('dev');
      expect(config.url).toBe('http://localhost:4173');
      expect(config.isConfigured).toBe(true);
    });
  });

  describe('Requirement 2: Public Mode VITE_SERVER_URL Selection', () => {
    it('selects VITE_SERVER_URL when configured', () => {
      const renderBackend = 'https://monopoly-india-server.onrender.com';
      const config = resolveServerConfig(renderBackend, {
        protocol: 'https:',
        hostname: 'k-692.github.io',
        port: '',
        origin: 'https://k-692.github.io',
      });

      expect(config.mode).toBe('public');
      expect(config.isConfigured).toBe(true);
      expect(config.url).toBe('https://monopoly-india-server.onrender.com');
      expect(config.error).toBeNull();
    });

    it('strips trailing slashes from VITE_SERVER_URL', () => {
      const config = resolveServerConfig('https://monopoly-backend.onrender.com///');
      expect(config.url).toBe('https://monopoly-backend.onrender.com');
    });
  });

  describe('Requirements 3 & 4: Production Guard & Missing Backend URL Error', () => {
    it('does NOT silently fall back to localhost on deployed public domain without VITE_SERVER_URL', () => {
      const config = resolveServerConfig('', {
        protocol: 'https:',
        hostname: 'k-692.github.io',
        port: '',
        origin: 'https://k-692.github.io',
      });

      expect(config.mode).toBe('public');
      expect(config.isConfigured).toBe(false);
      expect(config.url).toBeNull();
      expect(config.error).toContain('VITE_SERVER_URL');
      expect(config.error).toContain('not configured');
    });

    it('sets unconfigured status in connection store when backend URL is missing on public hosting', () => {
      // Mock window.location on GitHub Pages
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        configurable: true,
        value: {
          ...originalLocation,
          hostname: 'k-692.github.io',
          origin: 'https://k-692.github.io',
          port: '',
          protocol: 'https:',
        },
      });

      try {
        const socket = getSocket();
        expect(socket).toBeDefined();

        const state = useConnectionStore.getState();
        expect(state.status).toBe('unconfigured');
        expect(state.serverUrl).toBeNull();
        expect(state.error).toContain('VITE_SERVER_URL');
      } finally {
        Object.defineProperty(window, 'location', {
          writable: true,
          configurable: true,
          value: originalLocation,
        });
      }
    });
  });

  describe('Private Network Host Identification', () => {
    it('identifies localhost, loopback, and .local hosts as private', () => {
      expect(isPrivateNetworkHost('localhost')).toBe(true);
      expect(isPrivateNetworkHost('127.0.0.1')).toBe(true);
      expect(isPrivateNetworkHost('::1')).toBe(true);
      expect(isPrivateNetworkHost('macbook.local')).toBe(true);
    });

    it('identifies RFC 1918 private IPv4 ranges as private', () => {
      expect(isPrivateNetworkHost('192.168.0.1')).toBe(true);
      expect(isPrivateNetworkHost('192.168.1.150')).toBe(true);
      expect(isPrivateNetworkHost('10.0.0.1')).toBe(true);
      expect(isPrivateNetworkHost('10.255.0.1')).toBe(true);
      expect(isPrivateNetworkHost('172.16.0.1')).toBe(true);
      expect(isPrivateNetworkHost('172.31.255.255')).toBe(true);
    });

    it('identifies public domains as non-private', () => {
      expect(isPrivateNetworkHost('k-692.github.io')).toBe(false);
      expect(isPrivateNetworkHost('monopoly-india.onrender.com')).toBe(false);
      expect(isPrivateNetworkHost('8.8.8.8')).toBe(false);
      expect(isPrivateNetworkHost('172.32.0.1')).toBe(false);
    });
  });

  describe('Social Sharing & Open Graph Metadata', () => {
    it('verifies index.html contains all required Open Graph and Twitter metadata tags', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const htmlPath = path.resolve(process.cwd(), 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      // Open Graph Tags
      expect(html).toContain('property="og:type" content="website"');
      expect(html).toContain('property="og:title"');
      expect(html).toContain('property="og:description"');
      expect(html).toContain('property="og:url" content="https://k-692.github.io/Monopoly-India-Game/"');
      expect(html).toContain('property="og:image" content="https://k-692.github.io/Monopoly-India-Game/assets/game_logo.png"');
      expect(html).toContain('property="og:image:type" content="image/png"');
      expect(html).toContain('property="og:image:alt"');

      // Twitter / X Tags
      expect(html).toContain('name="twitter:card" content="summary"');
      expect(html).toContain('name="twitter:title"');
      expect(html).toContain('name="twitter:description"');
      expect(html).toContain('name="twitter:image" content="https://k-692.github.io/Monopoly-India-Game/assets/game_logo.png"');

      // Existing asset verification
      const logoPath = path.resolve(process.cwd(), 'public/assets/game_logo.png');
      expect(fs.existsSync(logoPath)).toBe(true);
    });
  });
});
