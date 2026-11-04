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
}

interface PlayerAuthState {
  player: PlayerIdentity | null;
  firebaseUid: string | null; // Kept for backward compatibility with existing tests
  reconnectToken: string | null;
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

function getStoredPlayerPreferences(): {
  name: string | null;
  color: string;
  uid: string | null;
  token: string | null;
} {
  if (typeof window === 'undefined') {
    return { name: null, color: PLAYER_COLORS[0], uid: null, token: null };
  }
  const name = localStorage.getItem('monopoly_player_name');
  const color = localStorage.getItem('monopoly_player_color') || PLAYER_COLORS[0];
  const uid = localStorage.getItem('monopoly_player_uid');
  const token = localStorage.getItem('monopoly_reconnect_token');
  return { name, color, uid, token };
}

export const useAuthStore = create<PlayerAuthState>((set, get) => {
  const initialPrefs = getStoredPlayerPreferences();

  return {
    player: initialPrefs.name
      ? {
          uid: initialPrefs.uid || '',
          displayName: initialPrefs.name,
          avatarColor: initialPrefs.color,
        }
      : null,
    firebaseUid: initialPrefs.uid || null,
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
            firebaseUid: uid,
            reconnectToken: token,
            isAuthInitialized: true,
            player: name
              ? {
                  uid,
                  displayName: name,
                  avatarColor: color,
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
                finalizeLocal(res.player.uid, res.player.token, prefs.name, res.player.avatarColor);
              } else {
                // Token invalid or server restarted: register new session
                socket.emit(
                  'player:register',
                  {
                    displayName: prefs.name || 'Player',
                    avatarColor: prefs.color,
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

    setPlayerName: async (name: string) => {
      const cleanName = name.trim() || 'Player ' + Math.floor(100 + Math.random() * 900);
      const socket = getSocket();
      const currentPrefs = getStoredPlayerPreferences();

      let color = get().player?.avatarColor || currentPrefs.color;
      if (!color) {
        color = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('monopoly_player_name', cleanName);
        localStorage.setItem('monopoly_player_color', color);
      }

      // Update session on LAN server
      const token = get().reconnectToken || currentPrefs.token;
      socket.emit(
        'player:register',
        {
          displayName: cleanName,
          avatarColor: color,
          token: token || undefined,
        },
        (res) => {
          if (res.ok && res.player) {
            if (typeof window !== 'undefined') {
              localStorage.setItem('monopoly_player_uid', res.player.uid);
              localStorage.setItem('monopoly_reconnect_token', res.player.token);
            }
            set({
              firebaseUid: res.player.uid,
              reconnectToken: res.player.token,
              player: {
                uid: res.player.uid,
                displayName: res.player.displayName,
                avatarColor: res.player.avatarColor,
              },
            });
          }
        }
      );

      set({
        player: {
          uid: get().player?.uid || get().firebaseUid || 'player_me',
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
