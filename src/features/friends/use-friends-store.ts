import { create } from 'zustand';
import { sound } from '@/lib/audio/sound-engine';

export interface FriendItem {
  uid: string;
  displayName: string;
  photoURL: string | null;
  friendCode: string;
  isOnline: boolean;
}

export interface FriendRequestItem {
  id: string;
  senderUid: string;
  senderName: string;
  senderFriendCode: string;
  createdAt: number;
}

interface FriendsStoreState {
  friends: FriendItem[];
  pendingRequests: FriendRequestItem[];
  isLoading: boolean;
  error: string | null;

  sendRequest: (friendCode: string) => Promise<boolean>;
  acceptRequest: (requestId: string) => void;
  rejectRequest: (requestId: string) => void;
  removeFriend: (uid: string) => void;
}

export const useFriendsStore = create<FriendsStoreState>((set, get) => ({
  friends: [
    {
      uid: 'friend_1',
      displayName: 'Kabir Sharma',
      photoURL: null,
      friendCode: 'KABIR8',
      isOnline: true,
    },
    {
      uid: 'friend_2',
      displayName: 'Meera Iyer',
      photoURL: null,
      friendCode: 'MEERA4',
      isOnline: false,
    },
  ],
  pendingRequests: [
    {
      id: 'req_1',
      senderUid: 'friend_3',
      senderName: 'Rohan Gupta',
      senderFriendCode: 'ROHAN9',
      createdAt: Date.now() - 3600000,
    },
  ],
  isLoading: false,
  error: null,

  sendRequest: async (code: string) => {
    sound.play('BUTTON_CLICK');
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      set({ error: 'Please enter a valid friend code.' });
      return false;
    }

    // Check if already in friend list
    if (get().friends.some((f) => f.friendCode === clean)) {
      set({ error: 'Already in your friends list.' });
      return false;
    }

    set({ error: null });
    return true;
  },

  acceptRequest: (requestId: string) => {
    sound.play('BUTTON_CLICK');
    const req = get().pendingRequests.find((r) => r.id === requestId);
    if (!req) return;

    const newFriend: FriendItem = {
      uid: req.senderUid,
      displayName: req.senderName,
      photoURL: null,
      friendCode: req.senderFriendCode,
      isOnline: true,
    };

    set((s) => ({
      friends: [...s.friends, newFriend],
      pendingRequests: s.pendingRequests.filter((r) => r.id !== requestId),
    }));
  },

  rejectRequest: (requestId: string) => {
    sound.play('BUTTON_CLICK');
    set((s) => ({
      pendingRequests: s.pendingRequests.filter((r) => r.id !== requestId),
    }));
  },

  removeFriend: (uid: string) => {
    sound.play('BUTTON_CLICK');
    set((s) => ({
      friends: s.friends.filter((f) => f.uid !== uid),
    }));
  },
}));
