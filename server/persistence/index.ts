/**
 * Indian Monopoly - Persistence Store Factory & Security Utilities
 */

import crypto from 'crypto';
import { MemoryStore } from './memory-store';
import { PostgresStore } from './postgres-store';
import { PersistenceStore } from './types';

/**
 * Computes a secure SHA-256 hash of a session token for safe database persistence.
 */
export function hashToken(token: string): string {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface PersistenceOptions {
  databaseUrl?: string;
  nodeEnv?: string;
  useMemoryOnly?: boolean;
}

export function createPersistenceStore(options?: PersistenceOptions): PersistenceStore {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV;
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  const isProduction = nodeEnv === 'production' && !isTest;
  const databaseUrl = options?.databaseUrl ?? process.env.DATABASE_URL;

  // In production hosted mode, PostgreSQL persistence is strictly mandatory
  if (isProduction && !options?.useMemoryOnly) {
    if (!databaseUrl) {
      throw new Error(
        'Production configuration error: DATABASE_URL environment variable is mandatory in production environment. Refusing to fall back to volatile in-memory storage.'
      );
    }
    return new PostgresStore(databaseUrl);
  }

  // If DATABASE_URL is explicitly provided even in non-production, use Postgres
  if (databaseUrl && !options?.useMemoryOnly) {
    return new PostgresStore(databaseUrl);
  }

  // Default to non-volatile in-memory store for local Wi-Fi LAN mode and unit testing
  return new MemoryStore();
}

export * from './types';
export { MemoryStore, PostgresStore };
