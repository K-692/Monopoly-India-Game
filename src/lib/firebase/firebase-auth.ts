import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
  connectAuthEmulator,
  User,
} from 'firebase/auth';
import { app } from './firebase-app';
import { isEmulatorEnabled } from './firebase-config';

export const auth = getAuth(app);

if (isEmulatorEnabled && typeof window !== 'undefined') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  } catch {
    // Emulator already connected
  }
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Intelligent Google Sign-In with mobile/Safari popup fallback to redirect.
 */
export async function signInWithGoogle(): Promise<User | null> {
  const isMobile =
    typeof navigator !== 'undefined' &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  try {
    if (isMobile) {
      // Use redirect directly on mobile to prevent Safari/Chrome popup blocks
      await signInWithRedirect(auth, googleProvider);
      return null;
    } else {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
  } catch (error: unknown) {
    const err = error as { code?: string };
    // If popup was blocked by browser, fallback to redirect
    if (
      err.code === 'auth/popup-blocked' ||
      err.code === 'auth/popup-closed-by-user' ||
      err.code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export { onAuthStateChanged };
