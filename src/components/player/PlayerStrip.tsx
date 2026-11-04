import React, { useState, useEffect, useRef } from 'react';
import { PlayerState, PropertyState } from '@/domain/game-types';
import { BOARD_SPACES } from '@/domain/board-config';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IndianRupee, Building2, ShieldAlert, Clock, MapPin } from 'lucide-react';
import { GROUP_COLOR_MAP } from '../board/board-layout-utils';
import { cn } from '@/lib/utils/cn';

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
  onSelectSpace,
}) => {
  // Selected player state for click-to-view details (No hovering)
  const [selectedPlayerUid, setSelectedPlayerUid] = useState<string>(
    players[0]?.uid || currentPlayerUid
  );

  // Keep selected player valid if players list changes
  useEffect(() => {
    if (!players.some((p) => p.uid === selectedPlayerUid)) {
      setSelectedPlayerUid(players[0]?.uid || currentPlayerUid);
    }
  }, [players, selectedPlayerUid, currentPlayerUid]);

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

  const selectedPlayer = players.find((p) => p.uid === selectedPlayerUid) || players[0];
  const selectedPlayerSpace = selectedPlayer ? BOARD_SPACES[selectedPlayer.position] : null;

  // Properties owned by selected player
  const selectedPlayerProps = selectedPlayer
    ? Object.entries(properties)
        .filter(([_, p]) => p.ownerUid === selectedPlayer.uid)
        .map(([idx, p]) => ({
          spaceIndex: Number(idx),
          space: BOARD_SPACES[Number(idx)],
          state: p,
        }))
    : [];

  return (
    <div className="flex flex-col gap-1 w-full select-none overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[10px] font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider">
          Players ({players.length})
        </h2>
        <span className="text-[8.5px] text-gray-500 font-medium">
          Select to inspect
        </span>
      </div>

      {/* Compact Player Cards List (Decreased Width, Non-Scrollable) */}
      <div className="grid grid-cols-1 gap-1">
        {players.map((player) => {
          const isTurn = player.uid === currentPlayerUid;
          const isSelected = player.uid === selectedPlayerUid;
          const flash = cashFlash[player.uid];
          const timerVal = turnTimeRemaining ?? turnTimeLimit;
          const isTimerLow = timerVal <= 10;

          return (
            <Card
              key={player.uid}
              onClick={() => {
                setSelectedPlayerUid(player.uid);
                onSelectPlayer?.(player.uid);
              }}
              className={cn(
                'relative px-1.5 py-1 transition-all duration-200 cursor-pointer rounded-lg border flex items-center justify-between gap-1 shadow-2xs',
                isSelected
                  ? 'border-indian-terracotta-500 bg-amber-50/90 dark:bg-indian-navy-800 ring-2 ring-indian-terracotta-400/50 scale-[1.01]'
                  : isTurn
                  ? 'border-amber-400 bg-amber-50/40 dark:bg-indian-navy-800/80'
                  : 'border-indian-parchment-300 dark:border-indian-navy-700 bg-white dark:bg-indian-navy-900 hover:border-indian-terracotta-300',
                flash === 'up' && 'ring-2 ring-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 scale-105 shadow-md',
                flash === 'down' && 'ring-2 ring-red-400 bg-red-50 dark:bg-red-950/40 scale-105 shadow-md',
                player.isBankrupt && 'opacity-40 grayscale pointer-events-none'
              )}
            >
              {/* Left: Avatar & Name */}
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  style={{ backgroundColor: player.colorToken }}
                  className="w-4.5 h-4.5 rounded-full border border-white text-white font-black text-[8.5px] flex items-center justify-center shrink-0 shadow-2xs"
                >
                  {player.displayName.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10.5px] font-bold text-indian-navy-900 dark:text-white truncate max-w-[85px] sm:max-w-[100px]">
                      {player.displayName}
                    </span>

                    {player.inJail && (
                      <span title="In Jail">
                        <ShieldAlert className="w-2.5 h-2.5 text-red-600 shrink-0" />
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Turn Timer & Cash Amount */}
              <div className="flex items-center gap-1 shrink-0">
                {isTurn && (
                  <div
                    className={cn(
                      'flex items-center gap-0.5 px-1 py-0.2 rounded-full text-[8px] font-mono font-bold shadow-2xs',
                      isTimerLow
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-indian-terracotta-100 text-indian-terracotta-800 border border-indian-terracotta-300'
                    )}
                  >
                    <Clock className="w-2 h-2" />
                    <span>{timerVal}s</span>
                  </div>
                )}

                <div
                  className={cn(
                    'flex items-center text-[10px] font-black transition-all px-1 py-0.5 rounded',
                    flash === 'up' && 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 font-black scale-110',
                    flash === 'down' && 'text-red-700 bg-red-100 dark:bg-red-900/60 font-black scale-110',
                    !flash && 'text-emerald-700 dark:text-emerald-400'
                  )}
                >
                  <IndianRupee className="w-2.5 h-2.5 -mr-0.5" />
                  <span>{player.cash.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Selected Player Detailed Info (Ultra-Compact, Non-Scrollable) */}
      {selectedPlayer && (
        <Card className="p-2 border-indian-terracotta-400 dark:border-indian-navy-700 bg-white dark:bg-indian-navy-900 shadow-sm rounded-lg text-xs space-y-1.5 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-1 border-b border-indian-parchment-300 dark:border-indian-navy-700">
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                style={{ backgroundColor: selectedPlayer.colorToken }}
                className="w-4 h-4 rounded-full border border-white text-white font-black text-[8px] flex items-center justify-center shrink-0"
              >
                {selectedPlayer.displayName.charAt(0).toUpperCase()}
              </div>
              <span className="font-extrabold text-[10.5px] text-indian-navy-900 dark:text-white truncate">
                {selectedPlayer.displayName}
              </span>
            </div>

            <Badge
              variant={selectedPlayer.uid === currentPlayerUid ? 'terracotta' : 'neutral'}
              className="text-[8px] py-0 px-1 font-bold"
            >
              {selectedPlayer.uid === currentPlayerUid ? 'Active' : 'Waiting'}
            </Badge>
          </div>

          {/* Financial Breakdown: 2 Columns */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded bg-indian-parchment-100 dark:bg-indian-navy-800 text-[9.5px]">
            <div>
              <span className="text-gray-500 block text-[8px]">Cash</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400 flex items-center text-[10px]">
                <IndianRupee className="w-2.5 h-2.5 -mr-0.5" />
                {selectedPlayer.cash.toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-[8px]">Net Worth</span>
              <span className="font-bold text-indian-navy-800 dark:text-indian-parchment-200 text-[10px]">
                ₹{selectedPlayer.netWorth.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Location & Status: 2 Columns */}
          <div className="grid grid-cols-2 gap-1 text-[9px] text-gray-700 dark:text-gray-300">
            <div
              onClick={() => onSelectSpace?.(selectedPlayer.position)}
              className="flex items-center gap-0.5 truncate cursor-pointer hover:text-indian-terracotta-600"
              title="Click to focus space on board"
            >
              <MapPin className="w-2.5 h-2.5 text-indian-terracotta-500 shrink-0" />
              <span className="truncate font-semibold">{selectedPlayerSpace?.name || 'Board'} (#{selectedPlayer.position})</span>
            </div>

            <div className="flex items-center gap-0.5 truncate">
              <ShieldAlert className="w-2.5 h-2.5 text-amber-600 shrink-0" />
              <span>
                {selectedPlayer.inJail ? (
                  <strong className="text-red-600">Jail ({selectedPlayer.jailTurns}/3)</strong>
                ) : (
                  <span className="text-emerald-600 font-medium">Free</span>
                )}
              </span>
            </div>
          </div>

          {/* Properties Owned Summary (Compact Chips, No Inner Scrollbar) */}
          <div className="pt-1 border-t border-indian-parchment-200 dark:border-indian-navy-700">
            <div className="flex items-center justify-between text-[9px] font-bold text-gray-600 dark:text-gray-400 mb-0.5">
              <span className="flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5 text-indian-navy-700 dark:text-indian-parchment-300" />
                Properties ({selectedPlayerProps.length})
              </span>
            </div>

            {selectedPlayerProps.length === 0 ? (
              <span className="text-[8.5px] text-gray-400 italic block">
                No properties owned yet.
              </span>
            ) : (
              <div className="flex flex-wrap gap-0.5 max-h-16 overflow-hidden">
                {selectedPlayerProps.map(({ spaceIndex, space, state }) => {
                  const groupColor = 'group' in space && space.group ? GROUP_COLOR_MAP[space.group] : '#888888';
                  return (
                    <button
                      key={spaceIndex}
                      type="button"
                      onClick={() => onSelectSpace?.(spaceIndex)}
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded border bg-white dark:bg-indian-navy-800 shadow-2xs text-[8px] font-bold cursor-pointer hover:bg-amber-50 dark:hover:bg-indian-navy-700 transition-colors"
                      style={{ borderLeftColor: groupColor, borderLeftWidth: '3px' }}
                      title={`Inspect ${space.name}`}
                    >
                      <span className="truncate max-w-[65px]">{space.name}</span>
                      {state.buildings > 0 && (
                        <span className="text-[7.5px] text-amber-700">
                          {state.buildings === 5 ? '🏢' : `🏠${state.buildings}`}
                        </span>
                      )}
                      {state.isMortgaged && (
                        <span className="text-red-500 font-bold">[M]</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
