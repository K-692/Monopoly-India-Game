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
  type Firestore,
} from 'firebase/firestore';
import { app } from './firebase-app';
import { isEmulatorEnabled } from './firebase-config';

let db: Firestore | null = null;

if (app) {
  try {
    db = getFirestore(app);
    if (isEmulatorEnabled && typeof window !== 'undefined') {
      try {
        connectFirestoreEmulator(db, '127.0.0.1', 8080);
      } catch {
        // Emulator already connected
      }
    }
  } catch (err) {
    console.error('Failed to initialize Firestore:', err);
    db = null;
  }
}

export { db, doc, collection, onSnapshot, setDoc, getDoc, serverTimestamp, type Unsubscribe };
