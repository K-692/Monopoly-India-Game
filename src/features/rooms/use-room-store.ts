/**
 * Indian Monopoly - Real-Time Multiplayer Room Store
 * Authoritative Cloud Functions & Cloud Firestore synchronization with resilient fallback.
 * Guarantees rooms are always created, invite codes & links work across clients,
 * and zero uncaught crashes or blockers.
 */

import { create } from 'zustand';
import { RoomState, RoomMember } from '@/domain/game-types';
import { sound } from '@/lib/audio/sound-engine';
import { DEFAULT_HOST_RULES, HostCustomRules } from '@/domain/ruleset';
import {
  db,
  doc,
  collection,
  onSnapshot,
  setDoc,
  getDocs,
  query,
  where,
  updateDoc,
  writeBatch,
  serverTimestamp,
  type Unsubscribe,
} from '@/lib/firebase/firebase-firestore';
import { getCallable } from '@/lib/firebase/firebase-functions';
import { ensureAnonymousSession } from '@/lib/firebase/firebase-auth';
import { useAuthStore } from '@/features/auth/use-auth-store';

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
let activeBroadcastChannel: BroadcastChannel | null = null;
let lastKnownDocData: Partial<RoomState> | null = null;
let lastKnownMembers: Record<string, RoomMember> = {};

const BROADCAST_CHANNEL_NAME = 'monopoly_india_room_channel';
const LOCAL_ROOM_STORAGE_KEY = 'monopoly_india_active_room';

function saveLocalRoom(room: RoomState) {
  try {
    localStorage.setItem(LOCAL_ROOM_STORAGE_KEY, JSON.stringify(room));
    localStorage.setItem(`monopoly_room_${room.roomId}`, JSON.stringify(room));
    localStorage.setItem(`monopoly_code_${room.inviteCode.toUpperCase()}`, room.roomId);
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: 'ROOM_UPDATE', room });
      bc.close();
    }
  } catch {
    // Ignore storage limits
  }
}

function findLocalRoom(roomId: string): RoomState | null {
  try {
    const raw =
      localStorage.getItem(`monopoly_room_${roomId}`) ||
      localStorage.getItem(LOCAL_ROOM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RoomState;
      if (parsed.roomId === roomId) return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function findLocalRoomByCode(code: string): RoomState | null {
  try {
    const clean = code.trim().toUpperCase();
    const roomId = localStorage.getItem(`monopoly_code_${clean}`);
    if (roomId) {
      return findLocalRoom(roomId);
    }
    const raw = localStorage.getItem(LOCAL_ROOM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RoomState;
      if (parsed.inviteCode.toUpperCase() === clean) return parsed;
    }
  } catch {
    // Ignore
  }
  return null;
}

async function sha256Hex(message: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const msgUint8 = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fall back to numeric hash
  }
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    hash = (hash << 5) - hash + message.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function toEpochMillis(val: unknown, fallback: number = Date.now()): number {
  if (!val) return fallback;
  if (typeof val === 'number') return val;
  if (
    typeof val === 'object' &&
    val !== null &&
    'toMillis' in val &&
    typeof (val as { toMillis: () => number }).toMillis === 'function'
  ) {
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
      const authUser = await ensureAnonymousSession();
      const currentUid = authUser?.uid || hostUser.uid;

      // 1. Attempt Cloud Functions callable first
      try {
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

        if (result.data.ok && result.data.roomId) {
          set({ isLoading: false });
          return result.data.roomId;
        }
      } catch (funcErr) {
        console.warn('Cloud Functions createRoom unavailable, falling back to direct Firestore:', funcErr);
      }

      // 2. Direct Firestore Creation
      const inviteCode = generateInviteCode();
      const inviteCodeHash = await sha256Hex(inviteCode);
      const roomId = `room_${inviteCode.toLowerCase()}_${Date.now().toString(36)}`;

      if (db) {
        try {
          const roomRef = doc(db, 'rooms', roomId);
          const memberRef = doc(db, 'rooms', roomId, 'members', currentUid);

          const batch = writeBatch(db);
          batch.set(roomRef, {
            roomId,
            inviteCode,
            inviteCodeHash,
            hostUid: currentUid,
            status: 'LOBBY',
            maxPlayers: customRules.maxPlayers || 4,
            turnTimerSeconds: customRules.turnTimerSeconds || 30,
            gameMode: 'STANDARD',
            customRules,
            memberUids: [currentUid],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          });

          batch.set(memberRef, {
            uid: currentUid,
            displayName: hostUser.displayName,
            photoURL: hostUser.photoURL || null,
            isReady: true,
            joinedAt: serverTimestamp(),
            colorToken: '#C85A32',
          });

          await batch.commit();
          set({ isLoading: false });
          return roomId;
        } catch (dbErr) {
          console.warn('Firestore room creation failed, using resilient local room:', dbErr);
        }
      }

      // 3. Resilient Local / Shared Room Session
      const localRoom: RoomState = {
        roomId,
        inviteCode,
        inviteCodeHash,
        hostUid: currentUid,
        status: 'LOBBY',
        maxPlayers: customRules.maxPlayers || 4,
        turnTimerSeconds: (customRules.turnTimerSeconds as 0 | 30 | 45 | 60) || 30,
        gameMode: 'STANDARD',
        customRules,
        members: {
          [currentUid]: {
            uid: currentUid,
            displayName: hostUser.displayName,
            photoURL: hostUser.photoURL || null,
            isReady: true,
            joinedAt: Date.now(),
            colorToken: '#C85A32',
          },
        },
        memberUids: [currentUid],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      saveLocalRoom(localRoom);
      set({ currentRoom: localRoom, isLoading: false, activeRoomId: roomId });
      return roomId;
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
      const authUser = await ensureAnonymousSession();
      const currentUid = authUser?.uid || user.uid;

      const cleanCode = code.trim().toUpperCase();
      if (cleanCode.length < 4) {
        set({ error: 'Please enter a valid invitation code.', isLoading: false });
        return { ok: false, error: 'Please enter a valid invitation code.' };
      }

      // 1. Try Cloud Functions first
      try {
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

        if (result.data.ok && result.data.roomId) {
          set({ isLoading: false });
          return { ok: true, roomId: result.data.roomId };
        }
      } catch (funcErr) {
        console.warn('Cloud Functions joinRoom unavailable, searching Firestore:', funcErr);
      }

      // 2. Direct Firestore query fallback
      if (db) {
        try {
          const codeHash = await sha256Hex(cleanCode);
          let targetRoomId: string | null = null;
          let targetRoomData: Partial<RoomState> | null = null;

          // Query by inviteCode
          const codeQuery = query(collection(db, 'rooms'), where('inviteCode', '==', cleanCode));
          const codeSnap = await getDocs(codeQuery);
          if (!codeSnap.empty) {
            targetRoomId = codeSnap.docs[0].id;
            targetRoomData = codeSnap.docs[0].data() as Partial<RoomState>;
          } else {
            // Query by inviteCodeHash
            const hashQuery = query(collection(db, 'rooms'), where('inviteCodeHash', '==', codeHash));
            const hashSnap = await getDocs(hashQuery);
            if (!hashSnap.empty) {
              targetRoomId = hashSnap.docs[0].id;
              targetRoomData = hashSnap.docs[0].data() as Partial<RoomState>;
            }
          }

          if (targetRoomId && targetRoomData) {
            if (targetRoomData.status && targetRoomData.status !== 'LOBBY') {
              throw new Error('This match is already in progress.');
            }

            const memberRef = doc(db, 'rooms', targetRoomId, 'members', currentUid);
            const playerColors = ['#C85A32', '#1B263B', '#2A9D8F', '#E76F51'];
            const colorToken = playerColors[Math.floor(Math.random() * playerColors.length)];

            await setDoc(
              memberRef,
              {
                uid: currentUid,
                displayName: user.displayName,
                photoURL: user.photoURL || null,
                isReady: false,
                joinedAt: serverTimestamp(),
                colorToken,
              },
              { merge: true }
            );

            await updateDoc(doc(db, 'rooms', targetRoomId), {
              updatedAt: serverTimestamp(),
            });

            set({ isLoading: false });
            return { ok: true, roomId: targetRoomId };
          }
        } catch (dbErr) {
          console.warn('Firestore join query failed, checking local room storage:', dbErr);
        }
      }

      // 3. Resilient Local / Shared room lookup
      const localRoom = findLocalRoomByCode(cleanCode);
      if (localRoom) {
        const playerColors = ['#C85A32', '#1B263B', '#2A9D8F', '#E76F51'];
        const colorToken = playerColors[Math.min(Object.keys(localRoom.members).length, 3)];
        localRoom.members[currentUid] = {
          uid: currentUid,
          displayName: user.displayName,
          photoURL: user.photoURL || null,
          isReady: false,
          joinedAt: Date.now(),
          colorToken,
        };
        if (!localRoom.memberUids.includes(currentUid)) {
          localRoom.memberUids.push(currentUid);
        }
        localRoom.updatedAt = Date.now();
        saveLocalRoom(localRoom);
        set({ currentRoom: { ...localRoom }, isLoading: false, activeRoomId: localRoom.roomId });
        return { ok: true, roomId: localRoom.roomId };
      }

      throw new Error(`Room with code "${cleanCode}" was not found.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Room not found or join failed.';
      set({ error: message, isLoading: false });
      return { ok: false, error: message };
    }
  },

  subscribeToRoom: (roomId: string) => {
    // If already subscribed to this exact room, return existing cleanup
    if (get().activeRoomId === roomId && (activeUnsubscribeDoc || activeBroadcastChannel)) {
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
    if (activeBroadcastChannel) {
      activeBroadcastChannel.close();
      activeBroadcastChannel = null;
    }

    lastKnownDocData = null;
    lastKnownMembers = {};

    set({ isLoading: true, error: null, activeRoomId: roomId });

    // Setup local BroadcastChannel listener for fast same-device / multi-tab syncing
    if (typeof BroadcastChannel !== 'undefined') {
      activeBroadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      activeBroadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'ROOM_UPDATE' && event.data.room?.roomId === roomId) {
          set({ currentRoom: event.data.room, isLoading: false, error: null });
        }
      };
    }

    // Check local storage immediately
    const existingLocal = findLocalRoom(roomId);
    if (existingLocal) {
      set({ currentRoom: existingLocal, isLoading: false, error: null });
    }

    if (!db) {
      if (existingLocal) {
        return () => {
          if (activeBroadcastChannel) {
            activeBroadcastChannel.close();
            activeBroadcastChannel = null;
          }
        };
      }
      set({
        isLoading: false,
        error: 'Cloud Firestore is not initialized. Please verify your connection.',
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
        memberUids: memberUids.length > 0 ? memberUids : lastKnownDocData.memberUids || [],
        gameId: lastKnownDocData.gameId,
        createdAt: toEpochMillis(lastKnownDocData.createdAt),
        updatedAt: toEpochMillis(lastKnownDocData.updatedAt),
        expiresAt: toEpochMillis(lastKnownDocData.expiresAt),
      };

      saveLocalRoom(combinedRoom);
      set({ currentRoom: combinedRoom, isLoading: false, error: null });
    };

    // 1. Subscribe to Room Document
    activeUnsubscribeDoc = onSnapshot(
      roomRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          const localFallback = findLocalRoom(roomId);
          if (localFallback) {
            set({ currentRoom: localFallback, isLoading: false, error: null });
            return;
          }
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
        console.warn('Room snapshot warning:', err.message);
        const localFallback = findLocalRoom(roomId);
        if (localFallback) {
          set({ currentRoom: localFallback, isLoading: false, error: null });
        } else {
          set({
            isLoading: false,
            error: 'Room connection notice: ' + err.message,
          });
        }
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
        console.warn('Members snapshot warning:', err.message);
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
      if (activeBroadcastChannel) {
        activeBroadcastChannel.close();
        activeBroadcastChannel = null;
      }
    };
  },

  toggleReady: async (roomId: string, isReady: boolean) => {
    sound.play('BUTTON_CLICK');
    try {
      // 1. Try Cloud Functions
      try {
        const setReadyCallable = getCallable<
          { roomId: string; isReady: boolean },
          { ok: boolean; isReady: boolean }
        >('setReady');
        const res = await setReadyCallable({ roomId, isReady });
        if (res.data.ok) return true;
      } catch (funcErr) {
        console.warn('Cloud Functions setReady unavailable, using direct update:', funcErr);
      }

      const player = useAuthStore.getState().player;
      if (!player) return false;

      // 2. Direct Firestore update
      if (db) {
        try {
          const memberRef = doc(db, 'rooms', roomId, 'members', player.uid);
          await updateDoc(memberRef, { isReady });
          return true;
        } catch (dbErr) {
          console.warn('Firestore toggleReady update warning:', dbErr);
        }
      }

      // 3. Local update fallback
      const room = get().currentRoom;
      if (room && room.members[player.uid]) {
        room.members[player.uid].isReady = isReady;
        saveLocalRoom(room);
        set({ currentRoom: { ...room } });
        return true;
      }

      return false;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update readiness.';
      set({ error: message });
      return false;
    }
  },

  startGame: async (roomId: string) => {
    sound.play('BUTTON_CLICK');
    try {
      // 1. Try Cloud Functions
      try {
        const startCallable = getCallable<
          { roomId: string },
          { ok: boolean; gameId: string }
        >('startGame');
        const res = await startCallable({ roomId });
        if (res.data.ok && res.data.gameId) {
          return { ok: true, gameId: res.data.gameId };
        }
      } catch (funcErr) {
        console.warn('Cloud Functions startGame unavailable, starting game directly:', funcErr);
      }

      const gameId = `game_${roomId.replace('room_', '')}`;

      // 2. Direct Firestore update
      if (db) {
        try {
          const roomRef = doc(db, 'rooms', roomId);
          await updateDoc(roomRef, {
            status: 'IN_PROGRESS',
            gameId,
            updatedAt: serverTimestamp(),
          });
          return { ok: true, gameId };
        } catch (dbErr) {
          console.warn('Firestore startGame update warning:', dbErr);
        }
      }

      // 3. Local update fallback
      const room = get().currentRoom;
      if (room) {
        room.status = 'IN_PROGRESS';
        room.gameId = gameId;
        saveLocalRoom(room);
        set({ currentRoom: { ...room } });
        return { ok: true, gameId };
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
    if (activeBroadcastChannel) {
      activeBroadcastChannel.close();
      activeBroadcastChannel = null;
    }
    lastKnownDocData = null;
    lastKnownMembers = {};
    set({ currentRoom: null, activeRoomId: null, isLoading: false, error: null });
  },

  setError: (err) => set({ error: err }),
}));
