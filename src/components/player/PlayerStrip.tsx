import React, { useState, useEffect, useRef } from 'react';
import { PlayerState, PropertyState } from '@/domain/game-types';
import { Card } from '@/components/ui/Card';
import { IndianRupee, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { PlayerDetailModal } from './PlayerDetailModal';

interface PlayerStripProps {
  players: PlayerState[];
  currentPlayerUid: string;
  properties: Record<number, PropertyState>;
  turnTimeRemaining?: number;
  turnTimeLimit?: number;
  onSelectPlayer?: (uid: string) => void;
  onSelectSpace?: (spaceIndex: number) => void;
}

export const PlayerStrip: React.FC<PlayerStripProps> = ({
  players,
  currentPlayerUid,
  properties,
  turnTimeRemaining,
  turnTimeLimit = 30,
  onSelectPlayer,
}) => {
  // Modal state when clicking a player name/card
  const [inspectedPlayerUid, setInspectedPlayerUid] = useState<string | null>(null);

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

          return (
            <Card
              key={player.uid}
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

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-0.5">
                    <span className="text-[9.5px] font-bold text-indian-navy-900 dark:text-white truncate block">
                      {player.displayName}
                    </span>
                    {isTurn && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indian-terracotta-500 animate-ping shrink-0" />
                    )}
                  </div>

                  {/* Cash Balance */}
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <div
                      className={cn(
                        'flex items-center text-[9px] font-black transition-all rounded leading-none',
                        flash === 'up' && 'text-emerald-700 bg-emerald-100 font-black scale-105',
                        flash === 'down' && 'text-red-700 bg-red-100 font-black scale-105',
                        !flash && 'text-emerald-700 dark:text-emerald-400'
                      )}
                    >
                      <IndianRupee className="w-2.5 h-2.5 -mr-0.5" />
                      <span>{player.cash.toLocaleString('en-IN')}</span>
                    </div>

                    {isTurn && (
                      <div
                        className={cn(
                          'flex items-center gap-0.5 px-1 py-0.2 rounded-full text-[7.5px] font-bold shrink-0',
                          isTimerLow
                            ? 'bg-red-500 text-white animate-pulse'
                            : 'bg-indian-terracotta-100 text-indian-terracotta-800'
                        )}
                      >
                        <Clock className="w-2 h-2" />
                        <span>{timerVal}s</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Pop-up Window for Detailed Player Info when Clicked */}
      {inspectedPlayer && (
        <PlayerDetailModal
          player={inspectedPlayer}
          properties={properties}
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
