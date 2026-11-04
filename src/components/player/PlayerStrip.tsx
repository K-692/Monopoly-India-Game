import React, { useState } from 'react';
import { PlayerState, PropertyState } from '@/domain/game-types';
import { BOARD_SPACES } from '@/domain/board-config';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IndianRupee, Building2, ShieldAlert, Clock, MapPin, KeyRound, Info } from 'lucide-react';
import { GROUP_COLOR_MAP } from '../board/board-layout-utils';
import { cn } from '@/lib/utils/cn';

interface PlayerStripProps {
  players: PlayerState[];
  currentPlayerUid: string;
  properties: Record<number, PropertyState>;
  turnTimeRemaining?: number;
  turnTimeLimit?: number;
  onSelectPlayer?: (uid: string) => void;
}

export const PlayerStrip: React.FC<PlayerStripProps> = ({
  players,
  currentPlayerUid,
  properties,
  turnTimeRemaining,
  turnTimeLimit = 30,
  onSelectPlayer,
}) => {
  const [hoveredPlayerUid, setHoveredPlayerUid] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5 w-full select-none">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[11px] font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider">
          Players ({players.length})
        </h2>
        <span className="text-[9px] text-gray-500 font-medium flex items-center gap-1">
          <Info className="w-2.5 h-2.5 text-gray-400" />
          Hover for info
        </span>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {players.map((player) => {
          const isTurn = player.uid === currentPlayerUid;
          const isHovered = hoveredPlayerUid === player.uid;

          // Properties owned by this player
          const ownedProps = Object.entries(properties)
            .filter(([_, p]) => p.ownerUid === player.uid)
            .map(([idx, p]) => ({
              spaceIndex: Number(idx),
              space: BOARD_SPACES[Number(idx)],
              state: p,
            }));

          const playerSpace = BOARD_SPACES[player.position];
          const timerVal = turnTimeRemaining ?? turnTimeLimit;
          const isTimerLow = timerVal <= 10;

          return (
            <div
              key={player.uid}
              className="relative group"
              onMouseEnter={() => setHoveredPlayerUid(player.uid)}
              onMouseLeave={() => setHoveredPlayerUid(null)}
            >
              {/* Compact Player Card */}
              <Card
                onClick={() => {
                  onSelectPlayer?.(player.uid);
                  setHoveredPlayerUid(isHovered ? null : player.uid);
                }}
                className={cn(
                  'relative px-2 py-1.5 transition-all cursor-pointer rounded-lg border flex items-center justify-between gap-1.5',
                  isTurn
                    ? 'border-indian-terracotta-500 bg-indian-terracotta-50/70 dark:bg-indian-terracotta-950/40 shadow-xs ring-1 ring-indian-terracotta-400'
                    : 'border-indian-parchment-300 dark:border-indian-navy-700 hover:border-indian-terracotta-300 bg-white dark:bg-indian-navy-800',
                  player.isBankrupt && 'opacity-40 grayscale pointer-events-none'
                )}
              >
                {/* Left: Avatar & Name */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    style={{ backgroundColor: player.colorToken }}
                    className="w-5 h-5 rounded-full border border-white text-white font-black text-[9px] flex items-center justify-center shrink-0 shadow-2xs"
                  >
                    {player.displayName.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-bold text-indian-navy-900 dark:text-white truncate">
                        {player.displayName}
                      </span>

                      {player.inJail && (
                        <span title="In Jail">
                          <ShieldAlert className="w-3 h-3 text-red-600 shrink-0" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Turn Timer (ONLY on Active Player) & Cash */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Turn Timer: ONLY on Active Player */}
                  {isTurn && (
                    <div
                      className={cn(
                        "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold shadow-2xs",
                        isTimerLow
                          ? "bg-red-500 text-white animate-pulse"
                          : "bg-indian-terracotta-100 text-indian-terracotta-800 border border-indian-terracotta-300"
                      )}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>{timerVal}s</span>
                    </div>
                  )}

                  {/* Cash */}
                  <div className="flex items-center text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                    <IndianRupee className="w-2.5 h-2.5 -mr-0.5" />
                    <span>{player.cash.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </Card>

              {/* Hover Popover: Comprehensive Game Info */}
              {isHovered && (
                <div
                  className="absolute left-full top-0 ml-2 z-50 w-64 p-3 bg-white dark:bg-indian-navy-900 border-2 border-indian-terracotta-400 rounded-xl shadow-xl text-xs space-y-2 pointer-events-none sm:pointer-events-auto animate-fade-in"
                  style={{ top: '50%', transform: 'translateY(-50%)' }}
                >
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-indian-parchment-300 dark:border-indian-navy-700">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        style={{ backgroundColor: player.colorToken }}
                        className="w-5 h-5 rounded-full border border-white text-white font-black text-[9px] flex items-center justify-center shrink-0"
                      >
                        {player.displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-indian-navy-900 dark:text-white truncate">
                        {player.displayName}
                      </span>
                    </div>

                    <Badge variant={isTurn ? 'terracotta' : 'neutral'} className="text-[9px] py-0">
                      {isTurn ? 'Active Turn' : 'Waiting'}
                    </Badge>
                  </div>

                  {/* Financial Stats */}
                  <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-lg bg-indian-parchment-100 dark:bg-indian-navy-800 text-[10px]">
                    <div>
                      <span className="text-gray-500 block">Liquid Cash:</span>
                      <span className="font-black text-emerald-700 dark:text-emerald-400 flex items-center">
                        <IndianRupee className="w-3 h-3 -mr-0.5" />
                        {player.cash.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Net Worth:</span>
                      <span className="font-bold text-indian-navy-800 dark:text-indian-parchment-200">
                        ₹{player.netWorth.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Location & Jail Status */}
                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                      <MapPin className="w-3 h-3 text-indian-terracotta-500 shrink-0" />
                      <span>At: <strong>{playerSpace?.name || 'Board'}</strong> (Space #{player.position})</span>
                    </div>

                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                      <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>
                        Jail Status:{' '}
                        {player.inJail ? (
                          <strong className="text-red-600">In Jail (Turn {player.jailTurns}/3)</strong>
                        ) : (
                          <span className="text-emerald-600 font-medium">Free</span>
                        )}
                      </span>
                    </div>

                    {player.jailFreeCards > 0 && (
                      <div className="flex items-center gap-1 text-teal-700 font-semibold">
                        <KeyRound className="w-3 h-3" />
                        <span>{player.jailFreeCards} Get Out of Jail Card(s)</span>
                      </div>
                    )}
                  </div>

                  {/* Deeds & Properties Owned Breakdown */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 mb-1 border-t border-indian-parchment-200 dark:border-indian-navy-700 pt-1">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-indian-navy-700 dark:text-indian-parchment-300" />
                        Properties Owned ({ownedProps.length}):
                      </span>
                    </div>

                    {ownedProps.length === 0 ? (
                      <span className="text-[10px] text-gray-400 italic block">No properties owned yet.</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-0.5">
                        {ownedProps.map(({ spaceIndex, space, state }) => {
                          const groupColor = 'group' in space && space.group ? GROUP_COLOR_MAP[space.group] : '#888888';
                          return (
                            <span
                              key={spaceIndex}
                              className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md border bg-white dark:bg-indian-navy-800 shadow-2xs font-medium"
                              style={{ borderLeftColor: groupColor, borderLeftWidth: '3px' }}
                            >
                              <span className="truncate max-w-[100px]">{space.name}</span>
                              {state.buildings > 0 && (
                                <span className="text-[8px] bg-amber-100 text-amber-800 px-0.5 rounded">
                                  {state.buildings === 5 ? '🏢' : `🏠x${state.buildings}`}
                                </span>
                              )}
                              {state.isMortgaged && (
                                <span className="text-[8px] text-red-500 font-bold">[M]</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
