import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config';

/**
 * Singleton Firebase App initialization.
 * Falls back safely when running in offline/sandbox mode.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;

  if (getApps().length > 0) {
    return getApp();
  }

  if (isFirebaseConfigured) {
    try {
      return initializeApp(firebaseConfig);
    } catch {
      return null;
    }
  }

  // Fallback dummy app for sandbox and local testing without live Firebase
  try {
    return initializeApp({
      apiKey: 'dummy-api-key',
      authDomain: 'dummy.firebaseapp.com',
      projectId: 'dummy-project',
      appId: 'dummy-app-id',
    });
  } catch {
    return null;
  }
}

export const app = getFirebaseApp();
