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

/** How long a pop-up (or a stack of pop-ups that arrived together) stays on screen. */
export const TOAST_LIFETIME_MS = 3000;
const MAX_STACKED_TOASTS = 6;

/**
 * Which stacked pop-up is in front at `elapsedMs`: the stack goes back and forth through its pop-ups
 * (0,1,…,X-1,X-2,…,1,0,…), switching every TOAST_LIFETIME_MS / X.
 */
export function frontToastIndex(count: number, elapsedMs: number): number {
  if (count <= 1) return 0;
  const slice = TOAST_LIFETIME_MS / count;
  const step = Math.max(0, Math.floor(elapsedMs / slice));
  const period = 2 * count - 2;
  const k = step % period;
  return k < count ? k : period - k;
}

interface ToastStore {
  toasts: ToastItem[];
  /** When the current stack started (reset whenever a new pop-up arrives). */
  stackStartedAt: number;
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
  stackStartedAt: 0,
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

    // Pop-ups that arrive together are stacked (newest on top) and shown in turn by the container.
    // The whole stack stays for TOAST_LIFETIME_MS after the latest arrival, then exits together.
    if (activeToastTimer) clearTimeout(activeToastTimer);
    if (activeExitTimer) clearTimeout(activeExitTimer);

    set((state) => ({
      toasts: [...state.toasts.filter((t) => !t.isExiting), newToast].slice(-MAX_STACKED_TOASTS),
      stackStartedAt: now,
    }));

    // Consistent subtle alert tone (no harsh sounds or jail audio)
    if (!toast.silent) {
      sound.play('NOTIFICATION');
    }

    activeToastTimer = setTimeout(() => {
      set((state) => ({ toasts: state.toasts.map((t) => ({ ...t, isExiting: true })) }));
      activeExitTimer = setTimeout(() => set({ toasts: [] }), 250);
    }, TOAST_LIFETIME_MS - 250);
  },

  removeToast: (id) => {
    // Dismiss just this pop-up; the rest of the stack keeps cycling
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, isExiting: true } : t)),
    }));
    setTimeout(() => {
      set((state) => {
        const toasts = state.toasts.filter((t) => t.id !== id);
        if (toasts.length === 0 && activeToastTimer) {
          clearTimeout(activeToastTimer);
          activeToastTimer = null;
        }
        return { toasts };
      });
    }, 200);
  },

  clearAll: () => {
    if (activeToastTimer) clearTimeout(activeToastTimer);
    if (activeExitTimer) clearTimeout(activeExitTimer);
    set({ toasts: [], stackStartedAt: 0 });
  },
}));
