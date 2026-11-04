import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface PopupTurnTimerProps {
  activePlayerName?: string;
  activePlayerColor?: string;
  timeRemaining?: number;
  isMyTurn?: boolean;
  className?: string;
}

export const PopupTurnTimer: React.FC<PopupTurnTimerProps> = ({
  activePlayerName = 'Player',
  activePlayerColor = '#C85A32',
  timeRemaining = 30,
  isMyTurn = false,
  className,
}) => {
  const isLow = timeRemaining <= 10;

  return (
    <div
      title={`Active Turn: ${activePlayerName} (${timeRemaining}s remaining)`}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs select-none border border-black transition-all shrink-0',
        isLow
          ? 'bg-red-500/20 text-red-400 animate-pulse'
          : 'bg-black/50 text-amber-200',
        className
      )}
    >
      <div
        style={{ backgroundColor: activePlayerColor }}
        className="w-4 h-4 rounded-full text-[8.5px] font-black text-white flex items-center justify-center border border-white shadow-xs shrink-0"
      >
        {activePlayerName.charAt(0).toUpperCase()}
      </div>
      <span className="truncate max-w-[90px] sm:max-w-[120px] text-[10.5px] sm:text-xs">
        {isMyTurn ? 'Your Turn' : activePlayerName}
      </span>
      <div className="flex items-center gap-1 font-mono text-[11px] font-black text-white ml-0.5">
        <Clock className={cn('w-3.5 h-3.5', isLow ? 'text-red-400' : 'text-amber-300')} />
        {/* Timer seconds container with thin black border per user specification */}
        <span
          data-testid="popup-timer-seconds"
          className="px-1.5 py-0.5 rounded-sm bg-black/60 border border-black text-white font-mono font-black text-[11px] leading-none inline-flex items-center justify-center shadow-xs"
        >
          {timeRemaining}s
        </span>
      </div>
    </div>
  );
};

