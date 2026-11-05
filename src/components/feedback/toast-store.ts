import { create } from 'zustand';
import { sound } from '@/lib/audio/sound-engine';

export interface ToastItem {
  id: string;
  eventId?: string;
  dedupKey?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  amount?: number;
  flow?: 'CREDIT' | 'DEBIT';
  deck?: 'CIVIC' | 'MARKET';
  ruleIndex?: number;
  createdAt: number;
  isExiting?: boolean;
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (
    toast: Omit<ToastItem, 'id' | 'createdAt' | 'isExiting'> & {
      eventId?: string;
      dedupKey?: string;
      silent?: boolean;
    }
  ) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

// Global deduplication cache across channels (state change vs game event)
const seenEventIds = new Set<string>();
const recentDedupKeys = new Map<string, number>();
let activeToastTimer: ReturnType<typeof setTimeout> | null = null;
let activeExitTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const now = Date.now();

    // 1. Deduplicate by eventId across all channels
    if (toast.eventId) {
      if (seenEventIds.has(toast.eventId)) {
        return; // Suppress duplicate event notification
      }
      seenEventIds.add(toast.eventId);
      // Keep cache bounded to 150 items
      if (seenEventIds.size > 150) {
        const firstKey = seenEventIds.values().next().value;
        if (firstKey) seenEventIds.delete(firstKey);
      }
    }

    // 2. Deduplicate by logical key within 3.5 seconds
    if (toast.dedupKey) {
      const lastSeen = recentDedupKeys.get(toast.dedupKey);
      if (lastSeen && now - lastSeen < 3500) {
        return; // Suppress repeat notification
      }
      recentDedupKeys.set(toast.dedupKey, now);
      // Clean old entries
      for (const [key, ts] of recentDedupKeys.entries()) {
        if (now - ts > 10000) {
          recentDedupKeys.delete(key);
        }
      }
    }

    const id = 'toast_' + now + '_' + Math.random().toString(36).slice(2, 7);
    const newToast: ToastItem = {
      ...toast,
      id,
      createdAt: now,
      isExiting: false,
    };

    // Clear existing auto-dismiss timers
    if (activeToastTimer) clearTimeout(activeToastTimer);
    if (activeExitTimer) clearTimeout(activeExitTimer);

    // Requirement 4: Strictly only 1 active notification at a time
    set({ toasts: [newToast] });

    // Consistent subtle alert tone (no harsh sounds or jail audio)
    if (!toast.silent) {
      sound.play('NOTIFICATION');
    }

    // Trigger smooth exit animation at 2750ms and complete removal at 3000ms
    activeToastTimer = setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.map((t) => (t.id === id ? { ...t, isExiting: true } : t)),
      }));

      activeExitTimer = setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, 250);
    }, 2750);
  },

  removeToast: (id) => {
    if (activeToastTimer) clearTimeout(activeToastTimer);
    if (activeExitTimer) clearTimeout(activeExitTimer);

    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, isExiting: true } : t)),
    }));

    activeExitTimer = setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 200);
  },

  clearAll: () => {
    if (activeToastTimer) clearTimeout(activeToastTimer);
    if (activeExitTimer) clearTimeout(activeExitTimer);
    set({ toasts: [] });
  },
}));
