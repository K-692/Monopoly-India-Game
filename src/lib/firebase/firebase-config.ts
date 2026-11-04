/**
 * Indian Monopoly - Centralized Firebase Web Configuration
 * Safely resolves settings from Vite environment variables.
 * Enforces project ID monopoly-india-f9700 and asia-south1 region.
 * NO HARDCODED CREDENTIALS.
 */

export const EXPECTED_PROJECT_ID = 'monopoly-india-f9700';
export const FUNCTIONS_REGION = 'asia-south1';

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  databaseURL?: string;
}

export const firebaseConfig: FirebaseClientConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || undefined,
};

export const isEmulatorEnabled = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

export interface FirebaseConfigValidation {
  isValid: boolean;
  isEmulator: boolean;
  projectId: string;
  error: string | null;
}

export function validateFirebaseConfig(): FirebaseConfigValidation {
  if (isEmulatorEnabled) {
    return {
      isValid: true,
      isEmulator: true,
      projectId: firebaseConfig.projectId || EXPECTED_PROJECT_ID,
      error: null,
    };
  }

  const missing: string[] = [];
  if (!firebaseConfig.apiKey) missing.push('VITE_FIREBASE_API_KEY');
  if (!firebaseConfig.authDomain) missing.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.projectId) missing.push('VITE_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.appId) missing.push('VITE_FIREBASE_APP_ID');

  if (missing.length > 0) {
    return {
      isValid: false,
      isEmulator: false,
      projectId: firebaseConfig.projectId,
      error: `Missing required Firebase environment variables: ${missing.join(', ')}`,
    };
  }

  if (firebaseConfig.projectId !== EXPECTED_PROJECT_ID) {
    return {
      isValid: false,
      isEmulator: false,
      projectId: firebaseConfig.projectId,
      error: `Configured Firebase Project ID (${firebaseConfig.projectId}) does not match expected '${EXPECTED_PROJECT_ID}'.`,
    };
  }

  return {
    isValid: true,
    isEmulator: false,
    projectId: firebaseConfig.projectId,
    error: null,
  };
}

const validation = validateFirebaseConfig();
export const isFirebaseConfigured = validation.isValid;
export const firebaseConfigError = validation.error;
