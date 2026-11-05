import { create } from 'zustand';

export interface ToastItem {
  id: string;
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
  addToast: (toast: Omit<ToastItem, 'id' | 'createdAt' | 'isExiting'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const newToast: ToastItem = {
      ...toast,
      id,
      createdAt: Date.now(),
      isExiting: false,
    };

    set((state) => ({
      // Limit to 4 toasts at a time on screen to prevent viewport overflow
      toasts: [...state.toasts.filter((t) => !t.isExiting).slice(-3), newToast],
    }));

    // Trigger smooth exit animation at 2750ms and complete removal at 3000ms
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.map((t) => (t.id === id ? { ...t, isExiting: true } : t)),
      }));
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, 250);
    }, 2750);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, isExiting: true } : t)),
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 250);
  },
}));
