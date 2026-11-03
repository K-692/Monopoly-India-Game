/**
 * Indian Monopoly - Centralized Firebase Web Configuration
 * Safely resolves public client settings from Vite environment variables
 * with fallback to the project credentials.
 */

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
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'monopoly-india-f9700',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'monopoly-india-f9700.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '586286552065',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:586286552065:web:cba03900c4450b71245c00',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-SY3THZVCRF',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || undefined,
};

export const isEmulatorEnabled = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
