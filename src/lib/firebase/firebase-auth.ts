/**
 * Indian Monopoly - Lightweight Anonymous Auth Service
 * Frictionless name-based identity powered by real Firebase Anonymous Authentication.
 * Ensures stable canonical UID across page refreshes and devices.
 */

import {
  getAuth,
  signInAnonymously,
  connectAuthEmulator,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import { app } from './firebase-app';
import { isEmulatorEnabled } from './firebase-config';

let auth: Auth | null = null;

if (app) {
  try {
    auth = getAuth(app);
    if (isEmulatorEnabled && typeof window !== 'undefined') {
      try {
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      } catch {
        // Emulator already connected
      }
    }
  } catch (err) {
    console.error('Failed to initialize Firebase Auth:', err);
    auth = null;
  }
}

/**
 * Ensures an authenticated anonymous Firebase session.
 * Reuses existing persisted session if present to preserve consistent UID.
 */
export async function ensureAnonymousSession(): Promise<User | null> {
  if (!auth) return null;

  try {
    // Wait for initial auth state rehydration from persistence
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }

    if (auth.currentUser) {
      return auth.currentUser;
    }

    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    console.error('Anonymous sign-in error:', err);
    return null;
  }
}

/**
 * Register a callback when authentication state changes.
 */
export function onAuthUserChanged(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export { auth };
