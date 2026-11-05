import React from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info, IndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToastStore } from './toast-store';

/**
 * Section 7: Bottom-left floating toast notification container.
 * - Non-blocking: never obstructs board spaces, dice, player actions or controls.
 * - Zero acknowledgment buttons: acknowledgment button is completely removed.
 * - Small cross ('×') button to dismiss manually.
 * - Automatically dismisses after exactly 3 seconds.
 * - Smooth entry (slideInLeft) and smooth exit (slideOutLeft) animations.
 * - Multiple notifications stack vertically without overlapping.
 * - Per-player independent notification state (purely local client state).
 */
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-xs sm:max-w-sm pointer-events-none select-none">
      {toasts.map((toast) => {
        const isCivic = toast.deck === 'CIVIC';
        const isMarket = toast.deck === 'MARKET';
        const isSuccess = toast.type === 'success' && !isCivic && !isMarket;
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning' && !isCivic && !isMarket;

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto relative overflow-hidden flex flex-col p-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs transition-all duration-200',
              toast.isExiting ? 'animate-slide-out-left' : 'animate-slide-in-left',
              isCivic && 'bg-gradient-to-br from-[#3b1208]/95 via-[#541c0a]/95 to-[#1a0a05]/95 border-amber-400 text-white',
              isMarket && 'bg-gradient-to-br from-[#062c26]/95 via-[#094137]/95 to-[#041714]/95 border-emerald-400 text-white',
              isSuccess && 'bg-[#0B1E17]/95 border-emerald-500/60 text-white',
              isError && 'bg-[#2A0E0E]/95 border-red-500/60 text-white',
              isWarning && 'bg-[#2A1D08]/95 border-amber-500/60 text-white',
              !isCivic && !isMarket && !isSuccess && !isError && !isWarning && 'bg-[#0C1222]/95 border-blue-500/60 text-white'
            )}
          >
            <div className="flex items-start gap-2.5">
              {/* Type / Deck Icon */}
              <div className="shrink-0 mt-0.5">
                {isCivic && <span className="text-base">🏛️</span>}
                {isMarket && <span className="text-base">📈</span>}
                {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {isError && <AlertCircle className="w-4 h-4 text-red-400" />}
                {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                {!isCivic && !isMarket && !isSuccess && !isError && !isWarning && (
                  <Info className="w-4 h-4 text-blue-400" />
                )}
              </div>

              {/* Message Body */}
              <div className="flex-1 min-w-0 pr-1">
                {toast.title && (
                  <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-amber-300 mb-0.5">
                    <span>{toast.title}</span>
                    {toast.ruleIndex !== undefined && (
                      <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[9px] font-mono text-white">
                        #{toast.ruleIndex}
                      </span>
                    )}
                  </div>
                )}
                <div className="font-medium text-gray-100 leading-snug break-words">
                  {toast.message}
                </div>

                {/* Amount Indicator if applicable */}
                {toast.amount !== undefined && (
                  <div className="mt-1.5 flex items-center">
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

              {/* Small unobtrusive cross ('×') button to dismiss manually */}
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 w-5 h-5 rounded-md hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3-Second Countdown Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 overflow-hidden">
              <div
                className={cn(
                  'h-full animate-toast-progress',
                  isCivic ? 'bg-amber-400' : isMarket ? 'bg-emerald-400' : 'bg-white/70'
                )}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
