import React from 'react';
import { PlayerState, PropertyState } from '@/domain/game-types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IndianRupee, Building2, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface PlayerStripProps {
  players: PlayerState[];
  currentPlayerUid: string;
  properties: Record<number, PropertyState>;
  onSelectPlayer?: (uid: string) => void;
}

export const PlayerStrip: React.FC<PlayerStripProps> = ({
  players,
  currentPlayerUid,
  properties,
  onSelectPlayer,
}) => {
  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-indian-navy-800 uppercase tracking-wider">
          Players ({players.length})
        </h2>
        <span className="text-[10px] text-gray-500 font-medium">Live Standings</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {players.map((player) => {
          const isTurn = player.uid === currentPlayerUid;
          const ownedCount = Object.values(properties).filter(
            (p) => p.ownerUid === player.uid
          ).length;

          return (
            <Card
              key={player.uid}
              onClick={() => onSelectPlayer?.(player.uid)}
              className={cn(
                'relative p-3 transition-all cursor-pointer',
                isTurn
                  ? 'border-2 border-indian-terracotta-500 bg-indian-terracotta-50/40 shadow-md ring-1 ring-indian-terracotta-400'
                  : 'hover:border-indian-parchment-400',
                player.isBankrupt && 'opacity-40 grayscale pointer-events-none'
              )}
            >
              {/* Color Token Pill Header */}
              <div
                className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                style={{ backgroundColor: player.colorToken }}
              />

              <div className="flex items-center justify-between gap-2 mt-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    style={{ backgroundColor: player.colorToken }}
                    className="w-8 h-8 rounded-full border border-white text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs"
                  >
                    {player.displayName.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-indian-navy-900 truncate">
                        {player.displayName}
                      </span>
                      {isTurn && (
                        <Badge variant="terracotta" className="text-[9px] py-0 px-1.5">
                          Turn
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span className="flex items-center gap-0.5">
                        <Building2 className="w-3 h-3 text-indian-navy-600" />
                        {ownedCount} deeds
                      </span>
                      {player.inJail && (
                        <span className="flex items-center gap-0.5 text-red-600 font-semibold">
                          <ShieldAlert className="w-3 h-3" /> Jail
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="text-right shrink-0">
                  <div className="flex items-center justify-end text-xs sm:text-sm font-extrabold text-emerald-700">
                    <IndianRupee className="w-3.5 h-3.5 -mr-0.5" />
                    <span>{player.cash.toLocaleString('en-IN')}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 block">
                    Net: ₹{player.netWorth.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
