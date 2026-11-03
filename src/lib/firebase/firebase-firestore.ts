import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  collection,
  onSnapshot,
  setDoc,
  getDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { app } from './firebase-app';
import { isEmulatorEnabled } from './firebase-config';

export const db = getFirestore(app);

if (isEmulatorEnabled && typeof window !== 'undefined') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch {
    // Emulator already connected
  }
}

export { doc, collection, onSnapshot, setDoc, getDoc, serverTimestamp, type Unsubscribe };
