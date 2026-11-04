import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  firebaseConfig,
  isFirebaseConfigured,
  isEmulatorEnabled,
  EXPECTED_PROJECT_ID,
} from './firebase-config';

/**
 * Singleton Firebase App initialization.
 * Only initializes if valid credentials are present or local emulator mode is active.
 * Never silently initializes a dummy project without credentials.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;

  if (getApps().length > 0) {
    return getApp();
  }

  if (isEmulatorEnabled) {
    try {
      return initializeApp({
        apiKey: 'demo-api-key',
        authDomain: `${EXPECTED_PROJECT_ID}.firebaseapp.com`,
        projectId: firebaseConfig.projectId || EXPECTED_PROJECT_ID,
        appId: '1:1234567890:web:abcdef',
        storageBucket: `${EXPECTED_PROJECT_ID}.appspot.com`,
      });
    } catch (err) {
      console.error('Failed to initialize Firebase Emulator App:', err);
      return null;
    }
  }

  if (isFirebaseConfigured) {
    try {
      return initializeApp(firebaseConfig);
    } catch (err) {
      console.error('Failed to initialize Firebase App:', err);
      return null;
    }
  }

  // Not configured and not emulator: return null explicitly
  return null;
}

export const app = getFirebaseApp();
