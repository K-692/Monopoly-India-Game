/**
 * Indian Monopoly - Authoritative LAN Player Identity Store
 * Replaces Firebase Authentication with a cryptographically secure,
 * zero-cloud local network session and token-based identity system.
 */

import { create } from 'zustand';
import { getSocket } from '@/lib/socket/socket-client';

export interface PlayerIdentity {
  uid: string;
  displayName: string;
  avatarColor: string;
  /** Emoji avatar (null = first letter of the name). */
  avatarEmoji?: string | null;
}

interface PlayerAuthState {
  player: PlayerIdentity | null;
  reconnectToken: string | null;
  isAuthInitialized: boolean;
  isNamePromptOpen: boolean;
  pendingRedirectUrl: string | null;

  initializeAuth: () => Promise<string | null>;
  /** Sets name, colour and emoji avatar. Resolves with an error (e.g. name taken in the lobby) instead of throwing. */
  setPlayerName: (name: string, color?: string, avatarEmoji?: string | null) => Promise<{ ok: boolean; error?: string }>;
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

function getStoredPlayerPreferences(): {
  name: string | null;
  color: string;
  uid: string | null;
  token: string | null;
  avatarEmoji: string | null;
} {
  if (typeof window === 'undefined') {
    return { name: null, color: PLAYER_COLORS[0], uid: null, token: null, avatarEmoji: null };
  }
  const name = localStorage.getItem('monopoly_player_name');
  const color = localStorage.getItem('monopoly_player_color') || PLAYER_COLORS[0];
  const uid = localStorage.getItem('monopoly_player_uid');
  const token = localStorage.getItem('monopoly_reconnect_token');
  const avatarEmoji = localStorage.getItem('monopoly_player_avatar') || null;
  return { name, color, uid, token, avatarEmoji };
}

export const useAuthStore = create<PlayerAuthState>((set, get) => {
  const initialPrefs = getStoredPlayerPreferences();

  return {
    player: initialPrefs.name
      ? {
          uid: initialPrefs.uid || '',
          displayName: initialPrefs.name,
          avatarColor: initialPrefs.color,
          avatarEmoji: initialPrefs.avatarEmoji,
        }
      : null,
    reconnectToken: initialPrefs.token || null,
    isAuthInitialized: false,
    isNamePromptOpen: false,
    pendingRedirectUrl: null,

    /**
     * Initializes LAN player session with the server.
     * Uses saved reconnection token if available to resume existing identity.
     */
    initializeAuth: async () => {
      const prefs = getStoredPlayerPreferences();
      const socket = getSocket();

      return new Promise<string | null>((resolve) => {
        const finalizeLocal = (uid: string, token: string, name: string | null, color: string) => {
          if (typeof window !== 'undefined') {
            localStorage.setItem('monopoly_player_uid', uid);
            localStorage.setItem('monopoly_reconnect_token', token);
            if (name) localStorage.setItem('monopoly_player_name', name);
            localStorage.setItem('monopoly_player_color', color);
          }

          set({
            reconnectToken: token,
            isAuthInitialized: true,
            player: name
              ? {
                  uid,
                  displayName: name,
                  avatarColor: color,
                  avatarEmoji: prefs.avatarEmoji,
                }
              : null,
          });
          resolve(uid);
        };

        const performServerHandshake = () => {
          if (prefs.token) {
            // Attempt to resume existing session
            socket.emit('player:resume', { token: prefs.token, displayName: prefs.name || undefined }, (res) => {
              if (res.ok && res.player) {
                // Make sure the session carries this device's avatar
                socket.emit('player:update-profile', { avatarEmoji: prefs.avatarEmoji }, () => {});
                finalizeLocal(res.player.uid, res.player.token, prefs.name, res.player.avatarColor);
              } else {
                // Token invalid or server restarted: register new session
                socket.emit(
                  'player:register',
                  {
                    displayName: prefs.name || 'Player',
                    avatarColor: prefs.color,
                    avatarEmoji: prefs.avatarEmoji,
                  },
                  (regRes) => {
                    if (regRes.ok && regRes.player) {
                      finalizeLocal(regRes.player.uid, regRes.player.token, prefs.name, regRes.player.avatarColor);
                    } else {
                      fallbackOffline();
                    }
                  }
                );
              }
            });
          } else {
            // Register brand new player session
            socket.emit(
              'player:register',
              {
                displayName: prefs.name || 'Player',
                avatarColor: prefs.color,
                avatarEmoji: prefs.avatarEmoji,
              },
              (regRes) => {
                if (regRes.ok && regRes.player) {
                  finalizeLocal(regRes.player.uid, regRes.player.token, prefs.name, regRes.player.avatarColor);
                } else {
                  fallbackOffline();
                }
              }
            );
          }
        };

        const fallbackOffline = () => {
          const fallbackUid = prefs.uid || 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
          const fallbackToken = prefs.token || 'tok_' + Math.random().toString(36).substring(2, 9);
          finalizeLocal(fallbackUid, fallbackToken, prefs.name, prefs.color);
        };

        // If socket is already connected or connects soon
        if (socket.connected) {
          performServerHandshake();
        } else {
          socket.once('connect', () => {
            performServerHandshake();
          });

          // Timeout fallback in case server is not immediately running
          setTimeout(() => {
            if (!get().isAuthInitialized) {
              fallbackOffline();
            }
          }, 1500);
        }
      });
    },

    setPlayerName: async (name: string, chosenColor?: string, chosenEmoji?: string | null) => {
      const cleanName = name.trim() || 'Player ' + Math.floor(100 + Math.random() * 900);
      const socket = getSocket();
      const currentPrefs = getStoredPlayerPreferences();

      let color = chosenColor || get().player?.avatarColor || currentPrefs.color;
      if (!color) {
        color = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
      }
      const avatarEmoji = chosenEmoji === undefined ? (get().player?.avatarEmoji ?? currentPrefs.avatarEmoji) : chosenEmoji;

      const persist = (uid: string, token?: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('monopoly_player_name', cleanName);
          localStorage.setItem('monopoly_player_color', color);
          if (avatarEmoji) localStorage.setItem('monopoly_player_avatar', avatarEmoji);
          else localStorage.removeItem('monopoly_player_avatar');
          if (uid) localStorage.setItem('monopoly_player_uid', uid);
          if (token) localStorage.setItem('monopoly_reconnect_token', token);
        }
        set((st) => ({
          reconnectToken: token || st.reconnectToken,
          player: { uid: uid || st.player?.uid || 'player_me', displayName: cleanName, avatarColor: color, avatarEmoji },
          isNamePromptOpen: false,
        }));
      };

      const register = () =>
        new Promise<{ ok: boolean; error?: string }>((resolve) => {
          const token = get().reconnectToken || currentPrefs.token;
          socket.emit(
            'player:register',
            { displayName: cleanName, avatarColor: color, token: token || undefined, avatarEmoji },
            (res) => {
              if (res.ok && res.player) {
                persist(res.player.uid, res.player.token);
                resolve({ ok: true });
              } else {
                resolve({ ok: false, error: res.error || 'Could not save your profile.' });
              }
            }
          );
        });

      // Update the live session (and the lobby, if in one). Falls back to registering a new session.
      const result = await new Promise<{ ok: boolean; error?: string; needsRegister?: boolean }>((resolve) => {
        const timer = setTimeout(() => resolve({ ok: false, needsRegister: true }), 4000);
        socket.emit('player:update-profile', { displayName: cleanName, avatarEmoji, avatarColor: color }, (res) => {
          clearTimeout(timer);
          if (res?.ok && res.player) {
            persist(res.player.uid);
            resolve({ ok: true });
          } else if (res?.error === 'Unauthenticated') {
            resolve({ ok: false, needsRegister: true });
          } else {
            resolve({ ok: false, error: res?.error || 'Could not save your profile.' });
          }
        });
      });
      if (result.ok) return { ok: true };
      if (result.needsRegister) {
        const reg = await register();
        if (!reg.ok) persist(get().player?.uid || currentPrefs.uid || '');
        return { ok: true };
      }
      return { ok: false, error: result.error };
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
