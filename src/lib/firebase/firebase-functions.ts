import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
  type Functions,
} from 'firebase/functions';
import { app } from './firebase-app';
import { isEmulatorEnabled } from './firebase-config';

let functions: Functions | null = null;

if (app) {
  try {
    functions = getFunctions(app, 'asia-south1');
    if (isEmulatorEnabled && typeof window !== 'undefined') {
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
  } catch {
    functions = null;
  }
}

export function getCallable<TReq, TRes>(functionName: string) {
  if (!functions) {
    throw new Error('Firebase Functions not configured');
  }
  return httpsCallable<TReq, TRes>(functions, functionName);
}
