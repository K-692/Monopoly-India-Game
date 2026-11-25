import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info, IndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToastStore, frontToastIndex, TOAST_LIFETIME_MS } from './toast-store';

/**
 * Section 7: Toast notification stack — shown in the board centre below the dice during a game,
 * and in the bottom-left corner elsewhere.
 * - Non-blocking: never obstructs board spaces, dice, player actions or controls.
 * - Zero acknowledgment buttons: acknowledgment button is completely removed.
 * - Small cross ('×') button to dismiss manually.
 * - Automatically dismisses after exactly 3 seconds.
 * - Smooth entry (slideInLeft) and smooth exit (slideOutLeft) animations.
 * - Several pop-ups at once are stacked on top of each other and shown in turn (back and forth),
 *   each for 3s / X, so all of them are seen within the 3 seconds.
 * - Per-player independent notification state (purely local client state).
 */
export const ToastContainer: React.FC<{
  /** 'inline' renders inside the board centre (below the dice); 'floating' pins to the bottom-left corner. */
  variant?: 'floating' | 'inline';
}> = ({ variant = 'floating' }) => {
  const { toasts, removeToast, stackStartedAt } = useToastStore();
  const count = toasts.length;

  // Re-render on every slice so the front pop-up changes every 3s / X
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (count <= 1) return;
    const sliceMs = Math.max(150, Math.floor(TOAST_LIFETIME_MS / count));
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), sliceMs);
    return () => clearInterval(timer);
  }, [count, stackStartedAt]);

  if (count === 0) return null;

  // Newest first in the back-and-forth order
  const frontPos = frontToastIndex(count, Math.max(0, now - stackStartedAt));
  const frontId = toasts[count - 1 - frontPos]?.id;
  const ordered = [...toasts].reverse();

  return (
    <div
      data-testid={variant === 'inline' ? 'board-toast-stack' : 'floating-toast-stack'}
      data-count={count}
      className={cn(
        // All pop-ups occupy the same grid cell, i.e. they sit on top of each other
        'grid pointer-events-none select-none',
        variant === 'inline' ? 'w-full pt-1' : 'fixed bottom-4 left-4 z-50 max-w-xs sm:max-w-sm w-[calc(100vw-2rem)]'
      )}
    >
      {ordered.map((toast, depthFromNewest) => {
        const isFront = toast.id === frontId;
        const behindDepth = isFront ? 0 : Math.min(2, depthFromNewest + 1);
        const isCivic = toast.deck === 'CIVIC';
        const isMarket = toast.deck === 'MARKET';
        const isSuccess = toast.type === 'success' && !isCivic && !isMarket;
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning' && !isCivic && !isMarket;

        const isJail = toast.title === 'Central Jail';

        return (
          <div
            key={toast.id}
            data-testid={isJail ? 'jail-notification' : `toast-${toast.id}`}
            data-front={isFront ? 'true' : 'false'}
            style={{
              gridArea: '1 / 1',
              zIndex: isFront ? 20 : 10 - behindDepth,
              transform: isFront ? 'none' : `translateY(-${behindDepth * 5}px) scale(${1 - behindDepth * 0.04})`,
              opacity: isFront ? 1 : 0.85,
            }}
            className={cn(
              'relative overflow-hidden flex flex-col shrink-0 rounded-xl',
              isFront ? 'pointer-events-auto' : 'pointer-events-none',
              'border shadow-2xl backdrop-blur-md transition-all duration-200',
              variant === 'inline' ? 'p-2 text-[11px]' : 'p-3 text-xs',
              // Entry animation only for the pop-up in front (animations would override the stacking transform)
              isFront && (variant === 'inline' ? 'animate-scale-in' : toast.isExiting ? 'animate-slide-out-left' : 'animate-slide-in-left'),
              toast.isExiting && variant === 'inline' && 'opacity-0',
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
                    {count > 1 && isFront && (
                      <span data-testid="toast-stack-counter" className="ml-auto px-1.5 rounded-full bg-white/20 text-[9px] font-mono text-white normal-case">
                        {ordered.indexOf(toast) + 1}/{count}
                      </span>
                    )}
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
