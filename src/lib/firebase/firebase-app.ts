import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { firebaseConfig } from './firebase-config';

/**
 * Singleton Firebase App initialization.
 */
export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

export const app = getFirebaseApp();
