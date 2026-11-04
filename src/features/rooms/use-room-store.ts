/**
 * Indian Monopoly - Real-Time LAN Multiplayer Room Store
 * Manages in-memory private rooms, invitation codes, member presence,
 * and lobby readiness using direct Socket.IO bidirectional communication.
 * Completely eliminates Firestore, Cloud Functions, and simulated storages.
 */

import { create } from 'zustand';
import { RoomState } from '@/domain/game-types';
import { sound } from '@/lib/audio/sound-engine';
import { HostCustomRules } from '@/domain/ruleset';
import { getSocket } from '@/lib/socket/socket-client';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { LanServerInfo } from '../../../server/types/server-types';

interface RoomStoreState {
  currentRoom: RoomState | null;
  isLoading: boolean;
  error: string | null;
  activeRoomId: string | null;
  lanInfo: LanServerInfo | null;
  selectedLanAddress: string | null;

  createRoom: (
    hostUser: { uid: string; displayName: string; photoURL: string | null },
    customRules?: HostCustomRules
  ) => Promise<string>;
  joinRoom: (
    code: string,
    user: { uid: string; displayName: string; photoURL: string | null }
  ) => Promise<{ ok: boolean; roomId?: string; error?: string }>;
  subscribeToRoom: (roomId: string) => () => void;
  toggleReady: (roomId: string, isReady: boolean) => Promise<boolean>;
  startGame: (roomId: string) => Promise<{ ok: boolean; gameId?: string; error?: string }>;
  leaveRoom: () => void;
  setError: (err: string | null) => void;
  fetchLanInfo: () => Promise<void>;
  setSelectedLanAddress: (address: string) => void;
}

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  currentRoom: null,
  isLoading: false,
  error: null,
  activeRoomId: null,
  lanInfo: null,
  selectedLanAddress: null,

  fetchLanInfo: async () => {
    try {
      let baseUrl = '';
      if (typeof window !== 'undefined') {
        if (window.location.port === '5173') {
          baseUrl = `${window.location.protocol}//${window.location.hostname}:4173`;
        }
      }
      const res = await fetch(`${baseUrl}/api/lan-info`);
      if (res.ok) {
        const data = (await res.json()) as LanServerInfo;
        set({
          lanInfo: data,
          selectedLanAddress: get().selectedLanAddress || data.primaryLanAddress,
        });
      }
    } catch (e) {
      console.warn('Could not fetch LAN info:', e);
    }
  },

  setSelectedLanAddress: (address: string) => {
    set({ selectedLanAddress: address });
  },

  createRoom: async (_hostUser, customRules) => {
    set({ isLoading: true, error: null });
    const socket = getSocket();
    const authStore = useAuthStore.getState();

    if (!authStore.isAuthInitialized) {
      await authStore.initializeAuth();
    }

    return new Promise<string>((resolve, reject) => {
      const doCreate = () => {
        socket.emit('room:create', { customRules }, (response) => {
          set({ isLoading: false });
          if (response && response.ok && response.roomId && response.room) {
            sound.play('BUTTON_CLICK');
            set({
              currentRoom: response.room,
              activeRoomId: response.roomId,
              error: null,
            });
            resolve(response.roomId);
          } else {
            const err = response?.error || 'Failed to create room';
            sound.play('GO_TO_JAIL');
            set({ error: err });
            reject(new Error(err));
          }
        });
      };

      if (!socket.connected) {
        socket.once('connect', doCreate);
        socket.connect();
      } else {
        doCreate();
      }
    });
  },

  joinRoom: async (code, _user) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 4) {
      const err = 'Invalid invitation code.';
      set({ error: err });
      return { ok: false, error: err };
    }

    set({ isLoading: true, error: null });
    const socket = getSocket();
    const authStore = useAuthStore.getState();

    if (!authStore.isAuthInitialized) {
      await authStore.initializeAuth();
    }

    return new Promise((resolve) => {
      const doJoin = () => {
        socket.emit('room:join', { inviteCode: cleanCode }, (response) => {
          set({ isLoading: false });
          if (response && response.ok && response.roomId && response.room) {
            sound.play('BUTTON_CLICK');
            set({
              currentRoom: response.room,
              activeRoomId: response.roomId,
              error: null,
            });
            resolve({ ok: true, roomId: response.roomId });
          } else {
            const err = response?.error || 'Room not found or unavailable.';
            sound.play('GO_TO_JAIL');
            set({ error: err });
            resolve({ ok: false, error: err });
          }
        });
      };

      if (!socket.connected) {
        socket.once('connect', doJoin);
        socket.connect();
      } else {
        doJoin();
      }
    });
  },

  subscribeToRoom: (roomId: string) => {
    const socket = getSocket();

    const handleRoomState = (room: RoomState) => {
      if (room.roomId === roomId) {
        set({ currentRoom: room, activeRoomId: roomId });
      }
    };

    const handlePresence = (presence: { uid: string; connected: boolean }) => {
      set((state) => {
        if (!state.currentRoom || state.currentRoom.roomId !== roomId) return state;
        const member = state.currentRoom.members[presence.uid];
        if (!member) return state;
        // Presence update
        return state;
      });
    };

    socket.on('room:state', handleRoomState);
    socket.on('player:presence', handlePresence);

    // Initial fetch of LAN info for invite link display
    get().fetchLanInfo();

    return () => {
      socket.off('room:state', handleRoomState);
      socket.off('player:presence', handlePresence);
    };
  },

  toggleReady: async (roomId: string, isReady: boolean) => {
    const socket = getSocket();
    sound.play('BUTTON_CLICK');

    return new Promise<boolean>((resolve) => {
      socket.emit('room:set-ready', { isReady }, (response) => {
        if (response && response.ok) {
          set((state) => {
            if (!state.currentRoom || state.currentRoom.roomId !== roomId) return state;
            const playerUid = useAuthStore.getState().player?.uid;
            if (!playerUid || !state.currentRoom.members[playerUid]) return state;

            const updatedMembers = {
              ...state.currentRoom.members,
              [playerUid]: {
                ...state.currentRoom.members[playerUid],
                isReady,
              },
            };
            return {
              currentRoom: {
                ...state.currentRoom,
                members: updatedMembers,
              },
            };
          });
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  },

  startGame: async (_roomId: string) => {
    set({ isLoading: true });
    const socket = getSocket();

    return new Promise((resolve) => {
      socket.emit('room:start', (response) => {
        set({ isLoading: false });
        if (response && response.ok && response.gameId) {
          sound.play('VICTORY');
          set((state) => ({
            currentRoom: state.currentRoom
              ? { ...state.currentRoom, status: 'IN_PROGRESS', gameId: response.gameId }
              : null,
          }));
          resolve({ ok: true, gameId: response.gameId });
        } else {
          const err = response?.error || 'Failed to start game';
          sound.play('GO_TO_JAIL');
          set({ error: err });
          resolve({ ok: false, error: err });
        }
      });
    });
  },

  leaveRoom: () => {
    const socket = getSocket();
    socket.emit('room:leave');
    set({ currentRoom: null, activeRoomId: null, error: null });
  },

  setError: (err) => set({ error: err }),
}));
