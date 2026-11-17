/**
 * Indian Monopoly - Persistence Store Factory & Security Utilities
 *
 * The LAN host keeps all state in memory. Online games are hosted in the room creator's
 * browser and snapshotted to Supabase (see src/lib/online/online-host.ts).
 */

import { MemoryStore } from './memory-store';
import { PersistenceStore } from './types';

export { hashToken } from '../lib/isomorphic-crypto';

export function createPersistenceStore(): PersistenceStore {
  return new MemoryStore();
}

export * from './types';
export { MemoryStore };
