import React, { useState, useEffect, useRef } from 'react';
import { FinancialTransaction, PlayerState, PropertyState, PendingFinancialObligation } from '@/domain/game-types';
import { Card } from '@/components/ui/Card';
import { IndianRupee, Clock, Flag } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { PlayerDetailModal } from './PlayerDetailModal';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { calculateNetWorth } from '@/domain/ruleset';

interface PlayerStripProps {
  players: PlayerState[];
  currentPlayerUid: string;
  properties: Record<number, PropertyState>;
  pendingFinancialObligation?: PendingFinancialObligation | null;
  transactions?: FinancialTransaction[];
  turnTimeRemaining?: number;
  turnTimeLimit?: number;
  isTimerPaused?: boolean;
  userUid?: string;
  onSelectPlayer?: (uid: string) => void;
  onSelectSpace?: (spaceIndex: number) => void;
  onGiveUp?: () => void;
}

export const PlayerStrip: React.FC<PlayerStripProps> = ({
  players,
  currentPlayerUid,
  properties,
  pendingFinancialObligation,
  transactions = [],
  turnTimeRemaining,
  turnTimeLimit = 30,
  isTimerPaused = false,
  userUid,
  onSelectPlayer,
  onGiveUp,
}) => {
  // Modal state when clicking a player name/card
  const [inspectedPlayerUid, setInspectedPlayerUid] = useState<string | null>(null);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);

  const { player: authPlayer } = useAuthStore();
  const effectiveUid = userUid || authPlayer?.uid || 'player_1';
  const viewerPlayer = players.find((p) => p.uid === effectiveUid) || players[0];

  // Track cash updates for animated glowing effect
  const prevCashRef = useRef<Record<string, number>>({});
  const [cashFlash, setCashFlash] = useState<Record<string, 'up' | 'down'>>({});

  useEffect(() => {
    const newFlashes: Record<string, 'up' | 'down'> = {};
    let hasChanges = false;

    players.forEach((p) => {
      const prev = prevCashRef.current[p.uid];
      if (prev !== undefined && prev !== p.cash) {
        newFlashes[p.uid] = p.cash > prev ? 'up' : 'down';
        hasChanges = true;
      }
      prevCashRef.current[p.uid] = p.cash;
    });

    if (hasChanges) {
      setCashFlash((prev) => ({ ...prev, ...newFlashes }));
      const timer = setTimeout(() => {
        setCashFlash({});
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [players]);

  const inspectedPlayer = players.find((p) => p.uid === inspectedPlayerUid) || null;

  return (
    <div className="flex flex-col gap-1 w-full select-none overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[10px] font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider">
          Players ({players.length})
        </h2>
        <span className="text-[8px] text-gray-500 font-medium">
          Click info
        </span>
      </div>

      {/* Slim, Compact Player Cards List */}
      <div className="flex flex-col gap-1 w-full">
        {players.map((player) => {
          const isTurn = player.uid === currentPlayerUid;
          const flash = cashFlash[player.uid];
          const timerVal = turnTimeRemaining ?? turnTimeLimit;
          const isTimerLow = timerVal <= 10;
          const computedNetWorth = calculateNetWorth(
            player.uid,
            player.cash,
            properties,
            pendingFinancialObligation
          );

          return (
            <Card
              key={player.uid}
              data-testid={`player-card-${player.uid}`}
              onClick={() => {
                setInspectedPlayerUid(player.uid);
                onSelectPlayer?.(player.uid);
              }}
              className={cn(
                'p-1.5 cursor-pointer transition-all duration-200 select-none overflow-hidden relative shadow-2xs',
                isTurn
                  ? 'border-indian-terracotta-500 bg-amber-50/90 dark:bg-indian-navy-800 ring-1.5 ring-indian-terracotta-400'
                  : 'border-indian-parchment-300 dark:border-indian-navy-700 bg-white dark:bg-indian-navy-900 hover:border-indian-terracotta-300'
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {/* Avatar with Player Token Color */}
                <div
                  style={{ backgroundColor: player.colorToken }}
                  className="w-5 h-5 rounded-full border-1.5 border-white shadow-token-glow flex items-center justify-center text-[9px] text-white font-black shrink-0"
                >
                  {player.displayName.charAt(0).toUpperCase()}
                </div>

                {/* Name, Status & Turn Timer Header */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0 truncate">
                      <span className="text-[9px] sm:text-[9.5px] font-bold text-indian-navy-900 dark:text-white truncate block">
                        {player.displayName}
                      </span>
                      {(player.isCpu || player.playerType === 'COMPUTER') && (
                        <span className="px-1 py-0.2 rounded text-[7px] font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shrink-0">
                          CPU
                        </span>
                      )}
                    </div>

                    {/* Requirement 2: Active Player's Turn Timer Countdown inside card header */}
                    {isTurn && (
                      <div
                        data-testid={`active-timer-${player.uid}`}
                        className={cn(
                          'flex items-center gap-0.5 px-1 py-0.2 rounded-full text-[7.5px] font-bold shrink-0 shadow-2xs',
                          isTimerPaused
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                            : isTimerLow
                            ? 'bg-red-500 text-white animate-pulse'
                            : 'bg-indian-terracotta-100 dark:bg-indian-terracotta-950 text-indian-terracotta-800 dark:text-indian-terracotta-200 border border-indian-terracotta-300 dark:border-indian-terracotta-800'
                        )}
                        title={isTimerPaused ? 'Timer Paused During Movement' : `${timerVal}s remaining in turn`}
                      >
                        <Clock className="w-2 h-2 shrink-0" />
                        <span>{isTimerPaused ? 'PAUSED' : `${timerVal}s`}</span>
                      </div>
                    )}
                  </div>

                  {/* Requirement 1.A: Prominent Bold Liquid Cash Balance */}
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <div
                      data-testid={`player-balance-${player.uid}`}
                      className={cn(
                        'flex items-center text-[11px] sm:text-[12px] font-black transition-all rounded leading-tight',
                        flash === 'up' && 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/50 scale-105',
                        flash === 'down' && 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/50 scale-105',
                        !flash && 'text-emerald-700 dark:text-emerald-400'
                      )}
                    >
                      <IndianRupee className="w-2.5 h-2.5 -mr-0.5 shrink-0" />
                      <span>{player.cash.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Requirement 1.A & 1.B: Separate Distinct Gold NET WORTH Display with Increased Amount Font Size */}
                  <div
                    data-testid={`player-networth-${player.uid}`}
                    className="flex items-center justify-between gap-1 text-amber-600 dark:text-amber-400 mt-0.5 pt-0.5 border-t border-amber-200/50 dark:border-amber-900/40 leading-tight"
                  >
                    <span className="text-[6.5px] sm:text-[7px] font-bold text-amber-700/80 dark:text-amber-400/80 uppercase tracking-wider shrink-0">
                      NET WORTH
                    </span>
                    <span
                      data-testid={`player-networth-amount-${player.uid}`}
                      className="font-mono font-bold text-[9px] sm:text-[10px] truncate"
                    >
                      ₹{computedNetWorth.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Requirement 7: Give Up Button Below Player Cards in Left Panel */}
      {viewerPlayer && !viewerPlayer.isBankrupt && !viewerPlayer.isDisqualified && (
        <button
          type="button"
          onClick={() => setShowGiveUpConfirm(true)}
          className="w-full mt-1.5 py-1.5 px-2 rounded-lg font-bold text-[10px] sm:text-xs text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 border border-red-300 dark:border-red-800 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Give Up</span>
        </button>
      )}

      {/* Confirmation Modal for Give Up (Requirement 7) */}
      {showGiveUpConfirm && (
        <div className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-md w-full p-5 rounded-2xl bg-white dark:bg-indian-navy-900 border-2 border-red-500 shadow-2xl text-left flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center shrink-0 border border-red-300">
                <Flag className="w-4 h-4" />
              </div>
              <h3 className="font-serif font-black text-base text-indian-navy-900 dark:text-white">
                Give Up & Surrender Match
              </h3>
            </div>

            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
              You are about to give up and leave this game. This will immediately end the match for all players! The winner will be decided among the remaining eligible players based on highest Net Worth. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-indian-navy-800">
              <button
                type="button"
                onClick={() => setShowGiveUpConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-indian-navy-800 hover:bg-gray-200 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGiveUpConfirm(false);
                  onGiveUp?.();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-md active:scale-95 cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Confirm Give Up</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Window for Detailed Player Info when Clicked */}
      {inspectedPlayer && (
        <PlayerDetailModal
          player={inspectedPlayer}
          properties={properties}
          pendingFinancialObligation={pendingFinancialObligation}
          transactions={transactions}
          onClose={() => setInspectedPlayerUid(null)}
          activePlayerName={players.find((p) => p.uid === currentPlayerUid)?.displayName}
          activePlayerColor={players.find((p) => p.uid === currentPlayerUid)?.colorToken}
          turnTimeRemaining={turnTimeRemaining}
          isMyTurn={currentPlayerUid === 'player_human'}
        />
      )}
    </div>
  );
};
