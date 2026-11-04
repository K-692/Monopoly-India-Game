/**
 * Indian Monopoly - Real-Time Multiplayer Room Store
 * Authoritative Firestore onSnapshot synchronization & Cloud Functions integration.
 * Zero fabricated players, mock lobbies, or client-side illusions.
 */

import { create } from 'zustand';
import { RoomState, RoomMember } from '@/domain/game-types';
import { sound } from '@/lib/audio/sound-engine';
import { DEFAULT_HOST_RULES, HostCustomRules } from '@/domain/ruleset';
import { db, doc, collection, onSnapshot, type Unsubscribe } from '@/lib/firebase/firebase-firestore';
import { getCallable } from '@/lib/firebase/firebase-functions';
import { ensureAnonymousSession } from '@/lib/firebase/firebase-auth';

interface RoomStoreState {
  currentRoom: RoomState | null;
  isLoading: boolean;
  error: string | null;
  activeRoomId: string | null;

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
}

// Internal listener references to prevent leaks and duplicate listeners
let activeUnsubscribeDoc: Unsubscribe | null = null;
let activeUnsubscribeMembers: Unsubscribe | null = null;
let lastKnownDocData: Partial<RoomState> | null = null;
let lastKnownMembers: Record<string, RoomMember> = {};

function toEpochMillis(val: unknown, fallback: number = Date.now()): number {
  if (!val) return fallback;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (val instanceof Date) return val.getTime();
  return fallback;
}

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  currentRoom: null,
  isLoading: false,
  error: null,
  activeRoomId: null,

  createRoom: async (hostUser, customRules = DEFAULT_HOST_RULES) => {
    set({ isLoading: true, error: null });
    sound.play('BUTTON_CLICK');

    try {
      // Guarantee valid authenticated Firebase session
      await ensureAnonymousSession();

      const createCallable = getCallable<
        {
          displayName: string;
          customRules?: HostCustomRules;
        },
        { ok: boolean; roomId: string; inviteCode: string }
      >('createRoom');

      const result = await createCallable({
        displayName: hostUser.displayName,
        customRules,
      });

      if (!result.data.ok || !result.data.roomId) {
        throw new Error('Failed to create room on server.');
      }

      set({ isLoading: false });
      return result.data.roomId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create multiplayer room.';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  joinRoom: async (code, user) => {
    set({ isLoading: true, error: null });
    sound.play('BUTTON_CLICK');

    try {
      await ensureAnonymousSession();

      const cleanCode = code.trim().toUpperCase();
      if (cleanCode.length < 4) {
        set({ error: 'Please enter a valid invitation code.', isLoading: false });
        return { ok: false, error: 'Please enter a valid invitation code.' };
      }

      const joinCallable = getCallable<
        {
          displayName: string;
          inviteCode: string;
        },
        { ok: boolean; roomId: string }
      >('joinRoom');

      const result = await joinCallable({
        displayName: user.displayName,
        inviteCode: cleanCode,
      });

      if (!result.data.ok || !result.data.roomId) {
        throw new Error('Failed to join room.');
      }

      set({ isLoading: false });
      return { ok: true, roomId: result.data.roomId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Room not found or join failed.';
      set({ error: message, isLoading: false });
      return { ok: false, error: message };
    }
  },

  subscribeToRoom: (roomId: string) => {
    // If already subscribed to this exact room, return existing cleanup
    if (get().activeRoomId === roomId && activeUnsubscribeDoc) {
      return () => {
        get().leaveRoom();
      };
    }

    // Cleanup previous subscriptions
    if (activeUnsubscribeDoc) {
      activeUnsubscribeDoc();
      activeUnsubscribeDoc = null;
    }
    if (activeUnsubscribeMembers) {
      activeUnsubscribeMembers();
      activeUnsubscribeMembers = null;
    }

    lastKnownDocData = null;
    lastKnownMembers = {};

    set({ isLoading: true, error: null, activeRoomId: roomId });

    if (!db) {
      set({
        isLoading: false,
        error: 'Cloud Firestore is not initialized. Please verify your Firebase connection.',
      });
      return () => {};
    }

    const roomRef = doc(db, 'rooms', roomId);
    const membersRef = collection(db, 'rooms', roomId, 'members');

    // Helper to merge doc + members into full RoomState
    const syncCombinedState = () => {
      if (!lastKnownDocData) return;

      const memberUids = Object.keys(lastKnownMembers);
      const combinedRoom: RoomState = {
        roomId,
        inviteCode: lastKnownDocData.inviteCode || '',
        inviteCodeHash: lastKnownDocData.inviteCodeHash || '',
        hostUid: lastKnownDocData.hostUid || '',
        status: (lastKnownDocData.status as RoomState['status']) || 'LOBBY',
        maxPlayers: lastKnownDocData.maxPlayers || 4,
        turnTimerSeconds: (lastKnownDocData.turnTimerSeconds as 0 | 30 | 45 | 60) || 30,
        gameMode: (lastKnownDocData.gameMode as RoomState['gameMode']) || 'STANDARD',
        customRules: lastKnownDocData.customRules,
        members: { ...lastKnownMembers },
        memberUids: memberUids.length > 0 ? memberUids : (lastKnownDocData.memberUids || []),
        gameId: lastKnownDocData.gameId,
        createdAt: toEpochMillis(lastKnownDocData.createdAt),
        updatedAt: toEpochMillis(lastKnownDocData.updatedAt),
        expiresAt: toEpochMillis(lastKnownDocData.expiresAt),
      };

      set({ currentRoom: combinedRoom, isLoading: false, error: null });
    };

    // 1. Subscribe to Room Document
    activeUnsubscribeDoc = onSnapshot(
      roomRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          set({
            currentRoom: null,
            isLoading: false,
            error: 'This multiplayer room does not exist or has expired.',
          });
          return;
        }

        lastKnownDocData = docSnap.data() as Partial<RoomState>;
        syncCombinedState();
      },
      (err) => {
        console.error('Room snapshot error:', err);
        set({
          isLoading: false,
          error: 'Connection error while listening to room updates: ' + err.message,
        });
      }
    );

    // 2. Subscribe to Members Subcollection
    activeUnsubscribeMembers = onSnapshot(
      membersRef,
      (querySnap) => {
        const members: Record<string, RoomMember> = {};
        querySnap.forEach((mDoc) => {
          const data = mDoc.data();
          members[mDoc.id] = {
            uid: mDoc.id,
            displayName: data.displayName || 'Tycoon',
            photoURL: data.photoURL || null,
            isReady: Boolean(data.isReady),
            joinedAt: toEpochMillis(data.joinedAt),
            colorToken: data.colorToken || '#C85A32',
          };
        });

        lastKnownMembers = members;
        syncCombinedState();
      },
      (err) => {
        console.error('Members snapshot error:', err);
      }
    );

    return () => {
      if (activeUnsubscribeDoc) {
        activeUnsubscribeDoc();
        activeUnsubscribeDoc = null;
      }
      if (activeUnsubscribeMembers) {
        activeUnsubscribeMembers();
        activeUnsubscribeMembers = null;
      }
    };
  },

  toggleReady: async (roomId: string, isReady: boolean) => {
    sound.play('BUTTON_CLICK');
    try {
      const setReadyCallable = getCallable<
        { roomId: string; isReady: boolean },
        { ok: boolean; isReady: boolean }
      >('setReady');

      const res = await setReadyCallable({ roomId, isReady });
      return res.data.ok;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update readiness.';
      set({ error: message });
      return false;
    }
  },

  startGame: async (roomId: string) => {
    sound.play('BUTTON_CLICK');
    try {
      const startCallable = getCallable<
        { roomId: string },
        { ok: boolean; gameId: string }
      >('startGame');

      const res = await startCallable({ roomId });
      if (res.data.ok && res.data.gameId) {
        return { ok: true, gameId: res.data.gameId };
      }
      return { ok: false, error: 'Failed to start game.' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start match.';
      set({ error: message });
      return { ok: false, error: message };
    }
  },

  leaveRoom: () => {
    sound.play('BUTTON_CLICK');
    if (activeUnsubscribeDoc) {
      activeUnsubscribeDoc();
      activeUnsubscribeDoc = null;
    }
    if (activeUnsubscribeMembers) {
      activeUnsubscribeMembers();
      activeUnsubscribeMembers = null;
    }
    lastKnownDocData = null;
    lastKnownMembers = {};
    set({ currentRoom: null, activeRoomId: null, isLoading: false, error: null });
  },

  setError: (err) => set({ error: err }),
}));
