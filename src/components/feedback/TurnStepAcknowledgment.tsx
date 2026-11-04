import React from 'react';
import { GameState, GameEvent } from '@/domain/game-types';
import { Dices, MapPin, IndianRupee, CheckCircle2, ChevronRight, AlertCircle, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TurnStepAcknowledgmentProps {
  gameState: GameState;
  lastEvent?: GameEvent;
  className?: string;
}

export const TurnStepAcknowledgment: React.FC<TurnStepAcknowledgmentProps> = ({
  gameState,
  lastEvent,
  className,
}) => {
  const activePlayer = gameState.players.find((p) => p.uid === gameState.currentPlayerUid);

  // Determine current step index in the turn lifecycle
  // 1: Roll, 2: Landed/Move, 3: Decision/Action, 4: End Turn
  let currentStep = 1;

  if (gameState.phase === 'AWAIT_ROLL' || gameState.phase === 'JAIL_DECISION') {
    currentStep = 1;
  } else if (gameState.phase === 'PROPERTY_DECISION') {
    currentStep = 2;
  } else {
    currentStep = 3;
  }

  // Derive latest acknowledgment message from lastEvent or state
  const ackMessage = lastEvent?.summary || `${activePlayer?.displayName || 'Player'}'s turn to roll`;
  let ackIcon = <Dices className="w-3.5 h-3.5 text-indian-terracotta-600 shrink-0" />;

  if (lastEvent) {
    if (lastEvent.summary.includes('rolled')) {
      ackIcon = <Dices className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
    } else if (lastEvent.summary.includes('bought') || lastEvent.summary.includes('acquired')) {
      ackIcon = <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    } else if (lastEvent.summary.includes('START')) {
      ackIcon = <IndianRupee className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    } else if (lastEvent.summary.includes('rent') || lastEvent.summary.includes('paid')) {
      ackIcon = <IndianRupee className="w-3.5 h-3.5 text-red-600 shrink-0" />;
    } else if (lastEvent.summary.includes('Jail')) {
      ackIcon = <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />;
    } else if (lastEvent.summary.includes('turned') || lastEvent.summary.includes('ended')) {
      ackIcon = <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />;
    }
  }

  return (
    <div className={cn("w-full flex flex-col gap-1 text-xs select-none", className)}>
      {/* Step Breadcrumbs */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-0.5 rounded-full bg-white/80 border border-indian-parchment-300 text-[9px] sm:text-[10px] font-semibold text-indian-navy-800 shadow-2xs">
        <span
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full transition-all",
            currentStep === 1
              ? "bg-indian-terracotta-500 text-white font-bold shadow-xs scale-105"
              : currentStep > 1
              ? "text-emerald-700 font-bold"
              : "text-gray-400"
          )}
        >
          {currentStep > 1 ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> : <Dices className="w-2.5 h-2.5" />}
          <span>1. Roll</span>
        </span>

        <ChevronRight className="w-2.5 h-2.5 text-gray-400" />

        <span
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full transition-all",
            currentStep === 2
              ? "bg-indian-terracotta-500 text-white font-bold shadow-xs scale-105"
              : currentStep > 2
              ? "text-emerald-700 font-bold"
              : "text-gray-400"
          )}
        >
          {currentStep > 2 ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> : <MapPin className="w-2.5 h-2.5" />}
          <span>2. Action</span>
        </span>

        <ChevronRight className="w-2.5 h-2.5 text-gray-400" />

        <span
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full transition-all",
            currentStep === 3
              ? "bg-indian-terracotta-500 text-white font-bold shadow-xs scale-105"
              : "text-gray-400"
          )}
        >
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>3. Complete</span>
        </span>
      </div>

      {/* Live Acknowledgment Callout Banner */}
      <div className="flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50/90 border border-amber-200/80 shadow-xs text-center">
        {ackIcon}
        <span className="text-[10px] sm:text-[11px] font-bold text-indian-navy-900 truncate">
          {ackMessage}
        </span>
      </div>
    </div>
  );
};
