import { create } from 'zustand';
import { RoomState, RoomMember } from '@/domain/game-types';
import { sound } from '@/lib/audio/sound-engine';
import { DEFAULT_HOST_RULES, HostCustomRules } from '@/domain/ruleset';

interface RoomStoreState {
  currentRoom: RoomState | null;
  isLoading: boolean;
  error: string | null;

  createRoom: (
    hostUser: { uid: string; displayName: string; photoURL: string | null },
    customRules?: HostCustomRules
  ) => Promise<string>;
  joinRoom: (code: string, user: { uid: string; displayName: string; photoURL: string | null }) => Promise<boolean>;
  toggleReady: (uid: string) => void;
  leaveRoom: () => void;
  setError: (err: string | null) => void;
}

// Generate unambiguous 6-character room invite code
function generateRoomCode(): string {
  const chars = '2345679ACDEFGHJKMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  currentRoom: null,
  isLoading: false,
  error: null,

  createRoom: async (hostUser, customRules = DEFAULT_HOST_RULES) => {
    set({ isLoading: true, error: null });
    sound.play('BUTTON_CLICK');

    const roomId = 'room_' + Date.now();
    const inviteCode = generateRoomCode();
    const hostMember: RoomMember = {
      uid: hostUser.uid,
      displayName: hostUser.displayName,
      photoURL: hostUser.photoURL,
      isReady: true,
      joinedAt: Date.now(),
      colorToken: '#C85A32',
    };

    const room: RoomState = {
      roomId,
      inviteCode,
      inviteCodeHash: inviteCode,
      hostUid: hostUser.uid,
      status: 'LOBBY',
      maxPlayers: customRules.maxPlayers || 4,
      turnTimerSeconds: (customRules.turnTimerSeconds as 0 | 30 | 45 | 60) || 30,
      gameMode: 'STANDARD',
      customRules,
      members: { [hostUser.uid]: hostMember },
      memberUids: [hostUser.uid],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };

    set({ currentRoom: room, isLoading: false });
    return roomId;
  },

  joinRoom: async (code, user) => {
    set({ isLoading: true, error: null });
    sound.play('BUTTON_CLICK');

    const cleanCode = code.trim().toUpperCase();
    const room = get().currentRoom;

    if (!room || room.inviteCode !== cleanCode) {
      // Simulate finding/joining or creating simulated lobby for valid codes
      if (cleanCode.length >= 4) {
        const simulatedRoom: RoomState = {
          roomId: 'room_' + cleanCode,
          inviteCode: cleanCode,
          inviteCodeHash: cleanCode,
          hostUid: 'host_p1',
          status: 'LOBBY',
          maxPlayers: 4,
          turnTimerSeconds: 45,
          gameMode: 'STANDARD',
          members: {
            host_p1: {
              uid: 'host_p1',
              displayName: 'Rajesh (Host)',
              photoURL: null,
              isReady: true,
              joinedAt: Date.now() - 30000,
              colorToken: '#C85A32',
            },
            [user.uid]: {
              uid: user.uid,
              displayName: user.displayName,
              photoURL: user.photoURL,
              isReady: false,
              joinedAt: Date.now(),
              colorToken: '#1A2B4C',
            },
          },
          memberUids: ['host_p1', user.uid],
          createdAt: Date.now() - 30000,
          updatedAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };
        set({ currentRoom: simulatedRoom, isLoading: false });
        return true;
      }
      set({ error: 'Room not found. Check the invite code and try again.', isLoading: false });
      return false;
    }

    if (room.status !== 'LOBBY') {
      set({ error: 'Game has already started in this room.', isLoading: false });
      return false;
    }

    if (room.memberUids.length >= room.maxPlayers) {
      set({ error: 'This room is currently full.', isLoading: false });
      return false;
    }

    const member: RoomMember = {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      isReady: false,
      joinedAt: Date.now(),
      colorToken: '#1A2B4C',
    };

    set({
      currentRoom: {
        ...room,
        members: { ...room.members, [user.uid]: member },
        memberUids: [...room.memberUids, user.uid],
        updatedAt: Date.now(),
      },
      isLoading: false,
    });
    return true;
  },

  toggleReady: (uid: string) => {
    sound.play('BUTTON_CLICK');
    const room = get().currentRoom;
    if (!room || !room.members[uid]) return;

    const currentMember = room.members[uid];
    const updatedMember = { ...currentMember, isReady: !currentMember.isReady };

    set({
      currentRoom: {
        ...room,
        members: { ...room.members, [uid]: updatedMember },
        updatedAt: Date.now(),
      },
    });
  },

  leaveRoom: () => {
    sound.play('BUTTON_CLICK');
    set({ currentRoom: null });
  },

  setError: (err) => set({ error: err }),
}));

