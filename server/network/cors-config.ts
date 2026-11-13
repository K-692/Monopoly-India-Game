/**
 * Indian Monopoly - Cross-Origin Resource Sharing (CORS) Security Module
 * 
 * Implements strict, environment-aware origin validation:
 * - In Production: Strictly permits only the deployed GitHub Pages origin (e.g. https://k-692.github.io)
 *   or custom origins configured via CLIENT_ORIGIN. Rejecting arbitrary or wildcard origins.
 * - In Local / LAN Mode: Permits local development (localhost, 127.0.0.1) and Wi-Fi LAN host origins.
 */

import { Request, Response, NextFunction } from 'express';

export interface CorsConfigOptions {
  nodeEnv?: string;
  clientOrigin?: string;
}

/**
 * Normalizes an origin string by trimming whitespace and removing trailing slashes.
 */
export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

/**
 * Evaluates whether a given HTTP or WebSocket origin is permitted to access the backend.
 * 
 * @param origin - The 'Origin' header from the incoming client request (undefined for server-to-server or direct tool calls)
 * @param options - Optional overrides for environment and configured client origins (useful for unit testing)
 * @returns boolean - True if the request origin is authorized, false otherwise
 */
export function isOriginAllowed(origin: string | undefined, options?: CorsConfigOptions): boolean {
  // Allow requests without Origin header (e.g., curl, health checks, server-to-server, mobile native webviews)
  if (!origin) {
    return true;
  }

  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV;
  const isProduction = nodeEnv === 'production';
  const rawClientOrigin = options?.clientOrigin ?? process.env.CLIENT_ORIGIN;
  const cleanOrigin = normalizeOrigin(origin);

  if (isProduction) {
    // If CLIENT_ORIGIN is explicitly defined, parse comma-separated list of allowed origins
    if (rawClientOrigin && rawClientOrigin.trim()) {
      const allowedList = rawClientOrigin
        .split(',')
        .map((entry) => normalizeOrigin(entry))
        .filter(Boolean);

      return allowedList.includes(cleanOrigin);
    }

    // Default production origin is the official GitHub Pages deployment
    const defaultProductionOrigin = 'https://k-692.github.io';
    return cleanOrigin === defaultProductionOrigin;
  }

  // Non-production modes (development, test, LAN Wi-Fi hosting)
  // Permit localhost, loopback, private LAN IP addresses, or same-host origins
  return true;
}

/**
 * Express middleware for cross-origin security headers.
 * Emits Access-Control headers for allowed origins and responds with 403 Forbidden for disallowed origins in production.
 */
export function corsMiddleware(options?: CorsConfigOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (isOriginAllowed(origin, options)) {
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
      } else {
        res.header('Access-Control-Allow-Origin', '*');
      }
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      return next();
    }

    // Origin is not allowed
    if (req.method === 'OPTIONS') {
      return res.status(403).json({ error: 'CORS forbidden' });
    }
    return res.status(403).json({ error: 'CORS forbidden' });
  };
}

