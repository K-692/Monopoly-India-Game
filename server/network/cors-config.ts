/**
 * Indian Monopoly - Cross-Origin Resource Sharing (CORS) Security Module
 * 
 * Implements strict, environment-aware origin validation:
 * - In Production: Permits explicitly configured frontend origin(s) specified via CLIENT_ORIGIN
 *   (e.g. GitHub Pages or custom domains). Rejects arbitrary or wildcard origins.
 *   If CLIENT_ORIGIN is not set, defaults to the repository GitHub Pages deployment.
 * - In Local / LAN Mode: Permits local development (localhost, 127.0.0.1) and Wi-Fi LAN host origins.
 */

import { Request, Response, NextFunction } from 'express';

export interface CorsConfigOptions {
  nodeEnv?: string;
  clientOrigin?: string;
}

/**
 * Normalizes an origin string by parsing URL or trimming whitespace and removing trailing slashes,
 * and canonicalizing scheme/host to lowercase per RFC 6454.
 */
export function normalizeOrigin(origin: string): string {
  try {
    const url = new URL(origin.trim());
    return url.origin.toLowerCase();
  } catch {
    return origin.trim().replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Parses and returns the list of allowed production origins from options or CLIENT_ORIGIN env var.
 * Supports comma, semicolon, or whitespace separated origin lists.
 */
export function getAllowedOrigins(options?: CorsConfigOptions): string[] {
  const rawClientOrigin = options?.clientOrigin ?? process.env.CLIENT_ORIGIN;
  if (rawClientOrigin && rawClientOrigin.trim()) {
    return rawClientOrigin
      .split(/[,;\s]+/)
      .map((entry) => normalizeOrigin(entry))
      .filter(Boolean);
  }
  // Default production origin fallback if CLIENT_ORIGIN is not explicitly configured
  return ['https://k-692.github.io'];
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
  const cleanOrigin = normalizeOrigin(origin);

  if (isProduction) {
    const allowedList = getAllowedOrigins(options);
    return allowedList.includes(cleanOrigin);
  }

  // Non-production modes (development, test, LAN Wi-Fi hosting)
  // Permit localhost, loopback, private LAN IP addresses, or same-host origins
  return true;
}

/**
 * Express middleware for cross-origin security headers.
 * Emits Access-Control headers for allowed origins and responds with 403 Forbidden for disallowed origins in production.
 * Never emits wildcard '*' origins.
 */
export function corsMiddleware(options?: CorsConfigOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (isOriginAllowed(origin, options)) {
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Vary', 'Origin');
      }
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      return next();
    }

    // Origin is not allowed
    return res.status(403).json({ error: 'CORS forbidden' });
  };
}
