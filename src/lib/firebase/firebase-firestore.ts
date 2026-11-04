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
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
  } catch {
    db = null;
  }
}

export { db, doc, collection, onSnapshot, setDoc, getDoc, serverTimestamp, type Unsubscribe };
