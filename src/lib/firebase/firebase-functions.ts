import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
  type Functions,
} from 'firebase/functions';
import { app } from './firebase-app';
import { isEmulatorEnabled, FUNCTIONS_REGION } from './firebase-config';

let functions: Functions | null = null;

if (app) {
  try {
    functions = getFunctions(app, FUNCTIONS_REGION);
    if (isEmulatorEnabled && typeof window !== 'undefined') {
      try {
        connectFunctionsEmulator(functions, '127.0.0.1', 5001);
      } catch {
        // Emulator already connected
      }
    }
  } catch (err) {
    console.error('Failed to initialize Firebase Functions:', err);
    functions = null;
  }
}

export function getCallable<TReq, TRes>(functionName: string) {
  if (!functions) {
    throw new Error('Firebase Functions not configured or offline');
  }
  return httpsCallable<TReq, TRes>(functions, functionName);
}

export { functions };
