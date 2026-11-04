/**
 * Indian Monopoly - Frictionless Player Identity Store
 * No Google authentication required.
 * Players identify by display name, with UID persisted in localStorage.
 */

import { create } from 'zustand';

export interface PlayerIdentity {
  uid: string;
  displayName: string;
  avatarColor: string;
}

interface PlayerAuthState {
  player: PlayerIdentity | null;
  isNamePromptOpen: boolean;
  pendingRedirectUrl: string | null;

  setPlayerName: (name: string) => void;
  openNamePrompt: (redirectUrl?: string) => void;
  closeNamePrompt: () => void;
}

const PLAYER_COLORS = [
  '#C85A32', // Terracotta
  '#1A2B4C', // Navy
  '#E5A93C', // Gold
  '#2D6A4F', // Emerald
  '#9D0208', // Crimson
  '#5C2D5A', // Purple
];

function getStoredPlayer(): PlayerIdentity | null {
  if (typeof window === 'undefined') return null;
  const uid = localStorage.getItem('monopoly_player_uid');
  const name = localStorage.getItem('monopoly_player_name');
  const color = localStorage.getItem('monopoly_player_color');

  if (uid && name) {
    return {
      uid,
      displayName: name,
      avatarColor: color || PLAYER_COLORS[0],
    };
  }
  return null;
}

export const useAuthStore = create<PlayerAuthState>((set, get) => ({
  player: getStoredPlayer(),
  isNamePromptOpen: false,
  pendingRedirectUrl: null,

  setPlayerName: (name: string) => {
    const cleanName = name.trim() || 'Player ' + Math.floor(100 + Math.random() * 900);
    let uid = get().player?.uid;
    let color = get().player?.avatarColor;

    if (!uid) {
      uid = 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      color = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('monopoly_player_uid', uid);
      localStorage.setItem('monopoly_player_name', cleanName);
      localStorage.setItem('monopoly_player_color', color!);
    }

    set({
      player: {
        uid,
        displayName: cleanName,
        avatarColor: color!,
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
}));
