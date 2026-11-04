/**
 * Indian Monopoly - Lightweight Anonymous Auth Service
 * Google Authentication removed as per user requirements.
 * Frictionless name-based identity with optional anonymous Firebase auth.
 */

import { getAuth, signInAnonymously, type Auth, type User } from 'firebase/auth';
import { app } from './firebase-app';

let auth: Auth | null = null;

if (app) {
  try {
    auth = getAuth(app);
  } catch {
    auth = null;
  }
}

export async function ensureAnonymousSession(): Promise<User | null> {
  if (!auth) return null;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch {
    return null;
  }
}

export { auth };
