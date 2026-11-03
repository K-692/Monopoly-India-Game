import { create } from 'zustand';
import { subscribeAuthState, signInWithGoogle, logOut } from '@/lib/firebase/firebase-auth';

export interface AuthUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  email: string | null;
  friendCode: string;
  isGuest?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginAsGuest: (name?: string) => void;
  signOutUser: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

function generateFriendCode(uid: string): string {
  // Generate short readable 6-character code
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return clean.slice(0, 6).padEnd(6, 'X');
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      const fbUser = await signInWithGoogle();
      if (fbUser) {
        set({
          user: {
            uid: fbUser.uid,
            displayName: fbUser.displayName || 'Indian Tycoon',
            photoURL: fbUser.photoURL || null,
            email: fbUser.email || null,
            friendCode: generateFriendCode(fbUser.uid),
            isGuest: false,
          },
          isLoading: false,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      set({ error: message, isLoading: false });
    }
  },

  loginAsGuest: (name: string = 'Maharaja Player') => {
    const guestUid = 'guest_' + Math.random().toString(36).substring(2, 9);
    set({
      user: {
        uid: guestUid,
        displayName: name,
        photoURL: null,
        email: null,
        friendCode: generateFriendCode(guestUid),
        isGuest: true,
      },
      isLoading: false,
      error: null,
    });
  },

  signOutUser: async () => {
    try {
      await logOut();
    } catch {
      // Ignored
    }
    set({ user: null, isLoading: false });
  },

  setUser: (user) => set({ user, isLoading: false }),
}));

// Initialize reactive listener
if (typeof window !== 'undefined') {
  subscribeAuthState((fbUser) => {
    if (fbUser) {
      useAuthStore.getState().setUser({
        uid: fbUser.uid,
        displayName: fbUser.displayName || 'Indian Tycoon',
        photoURL: fbUser.photoURL || null,
        email: fbUser.email || null,
        friendCode: generateFriendCode(fbUser.uid),
        isGuest: false,
      });
    } else {
      // If currently not a guest, mark as null
      const current = useAuthStore.getState().user;
      if (!current?.isGuest) {
        useAuthStore.getState().setUser(null);
      }
    }
  });
}
