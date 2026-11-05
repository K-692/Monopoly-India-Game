import React from 'react';
import { create } from 'zustand';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info, IndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ToastItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  amount?: number;
  flow?: 'CREDIT' | 'DEBIT';
  createdAt: number;
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id' | 'createdAt'>) => void;
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
    };

    set((state) => ({
      // Limit to 4 toasts at a time on screen to prevent overflow
      toasts: [...state.toasts.slice(-3), newToast],
    }));

    // Auto-dismiss after exactly 3000ms (3 seconds)
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

/**
 * Bottom-left floating toast notification container.
 * Non-blocking, smooth animation, 3-second auto-dismiss with manual dismiss 'x' button.
 */
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none select-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 p-3 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-in-left text-xs',
              isSuccess && 'bg-[#0B1E17]/95 border-emerald-500/60 text-white',
              isError && 'bg-[#2A0E0E]/95 border-red-500/60 text-white',
              isWarning && 'bg-[#2A1D08]/95 border-amber-500/60 text-white',
              !isSuccess && !isError && !isWarning && 'bg-[#0C1222]/95 border-blue-500/60 text-white'
            )}
          >
            {/* Type Icon */}
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {isError && <AlertCircle className="w-4 h-4 text-red-400" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4 text-blue-400" />}
            </div>

            {/* Message Body */}
            <div className="flex-1 min-w-0 pr-1">
              {toast.title && (
                <div className="font-bold text-[11px] uppercase tracking-wider text-gray-300 mb-0.5">
                  {toast.title}
                </div>
              )}
              <div className="font-medium text-gray-100 leading-snug break-words">
                {toast.message}
              </div>
              {toast.amount !== undefined && (
                <div className="mt-1 flex items-center gap-1">
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-black text-[10px]',
                      toast.flow === 'CREDIT'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    )}
                  >
                    <IndianRupee className="w-2.5 h-2.5" />
                    <span>
                      {toast.flow === 'CREDIT' ? '+' : '-'}₹{toast.amount.toLocaleString('en-IN')}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Small unobtrusive dismiss button */}
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 w-5 h-5 rounded-md hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
