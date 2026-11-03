import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from 'firebase/functions';
import { app } from './firebase-app';
import { isEmulatorEnabled } from './firebase-config';

export const functions = getFunctions(app, 'asia-south1');

if (isEmulatorEnabled && typeof window !== 'undefined') {
  try {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  } catch {
    // Emulator already connected
  }
}

export function getCallable<TReq, TRes>(functionName: string) {
  return httpsCallable<TReq, TRes>(functions, functionName);
}
