/**
 * Indian Monopoly - Frictionless Firebase Anonymous Player Identity Store
 * Integrates Firebase Anonymous Auth as the canonical identity provider.
 * Keeps player display name and preferences persisted locally.
 */

import { create } from 'zustand';
import { ensureAnonymousSession, onAuthUserChanged } from '@/lib/firebase/firebase-auth';

export interface PlayerIdentity {
  uid: string;
  displayName: string;
  avatarColor: string;
}

interface PlayerAuthState {
  player: PlayerIdentity | null;
  firebaseUid: string | null;
  isAuthInitialized: boolean;
  isNamePromptOpen: boolean;
  pendingRedirectUrl: string | null;

  initializeAuth: () => Promise<string | null>;
  setPlayerName: (name: string) => Promise<void>;
  openNamePrompt: (redirectUrl?: string) => void;
  closeNamePrompt: () => void;
}

export const PLAYER_COLORS = [
  '#C85A32', // Terracotta
  '#1A2B4C', // Navy
  '#E5A93C', // Gold
  '#2D6A4F', // Emerald
  '#9D0208', // Crimson
  '#5C2D5A', // Purple
];

function getStoredPlayerPreferences(): { name: string | null; color: string } {
  if (typeof window === 'undefined') {
    return { name: null, color: PLAYER_COLORS[0] };
  }
  const name = localStorage.getItem('monopoly_player_name');
  const color = localStorage.getItem('monopoly_player_color') || PLAYER_COLORS[0];
  return { name, color };
}

export const useAuthStore = create<PlayerAuthState>((set, get) => {
  const initialPrefs = getStoredPlayerPreferences();

  return {
    player: initialPrefs.name
      ? {
          uid: (typeof window !== 'undefined' && localStorage.getItem('monopoly_player_uid')) || '',
          displayName: initialPrefs.name,
          avatarColor: initialPrefs.color,
        }
      : null,
    firebaseUid: (typeof window !== 'undefined' && localStorage.getItem('monopoly_player_uid')) || null,
    isAuthInitialized: false,
    isNamePromptOpen: false,
    pendingRedirectUrl: null,

    /**
     * Initializes the anonymous Firebase Authentication session on startup.
     * Guarantees canonical Firebase UID is obtained before room creation or joining.
     */
    initializeAuth: async () => {
      try {
        const user = await ensureAnonymousSession();
        if (user) {
          const canonicalUid = user.uid;
          if (typeof window !== 'undefined') {
            localStorage.setItem('monopoly_player_uid', canonicalUid);
          }

          const currentPrefs = getStoredPlayerPreferences();
          set({
            firebaseUid: canonicalUid,
            isAuthInitialized: true,
            player: currentPrefs.name
              ? {
                  uid: canonicalUid,
                  displayName: currentPrefs.name,
                  avatarColor: currentPrefs.color,
                }
              : null,
          });

          return canonicalUid;
        }
      } catch (err) {
        console.warn('Anonymous session initialization failed:', err);
      }

      // Offline / Sandbox fallback if Firebase is not reachable
      const fallbackUid =
        get().firebaseUid ||
        'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

      if (typeof window !== 'undefined' && !localStorage.getItem('monopoly_player_uid')) {
        localStorage.setItem('monopoly_player_uid', fallbackUid);
      }

      set({ firebaseUid: fallbackUid, isAuthInitialized: true });
      return fallbackUid;
    },

    setPlayerName: async (name: string) => {
      const cleanName = name.trim() || 'Player ' + Math.floor(100 + Math.random() * 900);

      // Ensure Firebase UID is resolved
      let uid = get().firebaseUid;
      if (!uid) {
        uid = await get().initializeAuth();
      }

      let color = get().player?.avatarColor;
      if (!color) {
        color = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
      }

      if (typeof window !== 'undefined') {
        if (uid) localStorage.setItem('monopoly_player_uid', uid);
        localStorage.setItem('monopoly_player_name', cleanName);
        localStorage.setItem('monopoly_player_color', color);
      }

      set({
        player: {
          uid: uid || 'player_anon',
          displayName: cleanName,
          avatarColor: color,
        },
        isNamePromptOpen: false,
      });
    },

    openNamePrompt: (redirectUrl) => {
      set({
        isNamePromptOpen: true,
        pendingRedirectUrl: redirectUrl || null,
      });
    },

    closeNamePrompt: () => {
      set({ isNamePromptOpen: false, pendingRedirectUrl: null });
    },
  };
});

// Auto-wire onAuthStateChanged listener to guarantee real-time session synchrony
if (typeof window !== 'undefined') {
  onAuthUserChanged((user) => {
    if (user) {
      const canonicalUid = user.uid;
      localStorage.setItem('monopoly_player_uid', canonicalUid);
      const state = useAuthStore.getState();
      useAuthStore.setState({
        firebaseUid: canonicalUid,
        isAuthInitialized: true,
        player: state.player
          ? {
              ...state.player,
              uid: canonicalUid,
            }
          : null,
      });
    }
  });
}
