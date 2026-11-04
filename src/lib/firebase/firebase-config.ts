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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCa0XO5C_WTEVXoa3P1B1vL5hAHkJ3o0dI',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'monopoly-india-f9700.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || EXPECTED_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'monopoly-india-f9700.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '586286552065',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:586286552065:web:cba03900c4450b71245c00',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-SY3THZVCRF',
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
