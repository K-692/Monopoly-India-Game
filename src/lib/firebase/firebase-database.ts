import {
  getDatabase,
  connectDatabaseEmulator,
  ref,
  onValue,
  set,
  onDisconnect,
  Database,
} from 'firebase/database';
import { app } from './firebase-app';
import { firebaseConfig, isEmulatorEnabled } from './firebase-config';

let rtdb: Database | null = null;

if (firebaseConfig.databaseURL) {
  try {
    rtdb = getDatabase(app, firebaseConfig.databaseURL);
    if (isEmulatorEnabled && typeof window !== 'undefined') {
      connectDatabaseEmulator(rtdb, 'localhost', 9000);
    }
  } catch {
    rtdb = null;
  }
}

export { rtdb, ref, onValue, set, onDisconnect };
