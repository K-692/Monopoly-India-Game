import React from 'react';
import { BoardSpaceDefinition, PlayerState, PropertyState } from '@/domain/game-types';
import { getSpaceGridCoord } from './board-layout-utils';
import { Train, Zap, Droplets, ShieldAlert, Gift, Flame, ArrowLeft, Radio } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface BoardSpaceTileProps {
  space: BoardSpaceDefinition;
  propertyState?: PropertyState;
  playersHere: PlayerState[];
  allPlayers?: PlayerState[];
  isSelected: boolean;
  isHighlighted?: boolean;
  onSelect: () => void;
}

export const BoardSpaceTile: React.FC<BoardSpaceTileProps> = ({
  space,
  propertyState,
  playersHere,
  allPlayers = [],
  isSelected,
  isHighlighted = false,
  onSelect,
}) => {
  const coord = getSpaceGridCoord(space.spaceIndex);
  const isCorner = coord.orientation === 'corner';

  // Find owner: ONLY show player's color if bought! Otherwise NO color at all.
  const owner = propertyState?.ownerUid
    ? allPlayers.find((p) => p.uid === propertyState.ownerUid)
    : null;
  const ownerColor = owner ? owner.colorToken : null;

  // Icon for special spaces
  const renderIcon = () => {
    if (space.type === 'TRANSIT') return <Train className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indian-navy-700 dark:text-indian-parchment-200" />;
    if (space.type === 'UTILITY') {
      if (space.id.includes('power')) return <Zap className="w-4 h-4 text-amber-500" />;
      if (space.id.includes('jal') || space.id.includes('water')) return <Droplets className="w-4 h-4 text-blue-500" />;
      if (space.id.includes('telecom')) return <Radio className="w-4 h-4 text-indigo-500" />;
      return <Flame className="w-4 h-4 text-orange-500" />;
    }
    if (space.type === 'TAX') return <ShieldAlert className="w-4 h-4 text-red-600" />;
    if (space.type === 'CARD') {
      return space.deck === 'CIVIC' ? (
        <Gift className="w-4 h-4 text-amber-600" />
      ) : (
        <Flame className="w-4 h-4 text-orange-600" />
      );
    }
    return null;
  };

  return (
    <div
      onClick={onSelect}
      style={{
        gridRow: coord.row,
        gridColumn: coord.col,
        ...(ownerColor ? { borderColor: ownerColor } : {}),
      }}
      className={cn(
        'relative flex flex-col justify-between border border-indian-parchment-400 bg-white dark:bg-indian-navy-900 text-indian-navy-950 dark:text-white select-none cursor-pointer transition-all duration-200 p-0.5 sm:p-1 overflow-hidden',
        isSelected && 'ring-2 ring-indian-terracotta-500 bg-amber-50 dark:bg-indian-navy-800 z-20',
        isHighlighted && 'ring-4 ring-amber-400 dark:ring-amber-300 scale-105 z-30 shadow-[0_0_20px_rgba(251,191,36,0.9)] animate-pulse',
        propertyState?.isMortgaged && 'opacity-60 bg-gray-200/80',
        ownerColor && 'border-2 shadow-xs'
      )}
    >
      {/* Property Owner Color Bar - ONLY rendered when bought by a player! */}
      {ownerColor && (
        <div
          className={cn(
            'absolute transition-all z-10 flex items-center justify-center',
            coord.orientation === 'bottom' && 'top-0 left-0 right-0 h-2 sm:h-2.5',
            coord.orientation === 'left' && 'top-0 bottom-0 right-0 w-2.5 sm:w-3',
            coord.orientation === 'top' && 'bottom-0 left-0 right-0 h-2 sm:h-2.5',
            coord.orientation === 'right' && 'top-0 bottom-0 left-0 w-2.5 sm:w-3'
          )}
          style={{ backgroundColor: ownerColor }}
        >
          {/* Buildings (Houses / Tower) */}
          {propertyState && propertyState.buildings > 0 && (
            <div className="w-full h-full flex items-center justify-center gap-0.5">
              {propertyState.buildings === 5 ? (
                <div className="w-1.5 h-1.5 rounded-full bg-red-600 border border-white" />
              ) : (
                Array.from({ length: propertyState.buildings }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-1 bg-emerald-500 border border-white rounded-xs"
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Corner Space Special Styling */}
      {isCorner ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-1 bg-indian-parchment-100 dark:bg-indian-navy-950/60 overflow-hidden">
          {space.spaceIndex === 0 && (
            <div className="flex flex-col items-center text-indian-terracotta-600 gap-0.5">
              <span className="font-serif text-xs sm:text-sm md:text-base font-black tracking-wider whitespace-nowrap">START</span>
              <span className="text-[10px] sm:text-xs font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">₹2,000</span>
              <ArrowLeft className="w-3.5 h-3.5 text-indian-terracotta-500 animate-pulse-subtle" />
            </div>
          )}
          {space.spaceIndex === 10 && (
            <div className="text-center">
              <span className="block text-xs sm:text-sm md:text-base font-black text-red-700 whitespace-nowrap">JAIL</span>
              <span className="text-[9px] sm:text-[10px] text-gray-500 font-bold whitespace-nowrap">Visiting</span>
            </div>
          )}
          {space.spaceIndex === 20 && (
            <div className="text-center text-amber-700">
              <span className="block text-xs sm:text-sm md:text-base font-black whitespace-nowrap">REST</span>
              <span className="text-[9px] sm:text-[10px] text-gray-500 font-bold whitespace-nowrap">House</span>
            </div>
          )}
          {space.spaceIndex === 30 && (
            <div className="text-center text-red-600">
              <span className="block text-xs sm:text-sm md:text-base font-black whitespace-nowrap">GO TO</span>
              <span className="text-[9px] sm:text-[10px] font-extrabold whitespace-nowrap">JAIL</span>
            </div>
          )}
        </div>
      ) : coord.orientation === 'left' ? (
        /* Left Edge Tile: Horizontal Layout (Wide & Short) */
        <div
          className={cn(
            'w-full h-full flex flex-row items-center justify-between px-2 overflow-hidden gap-1.5',
            ownerColor ? 'pr-3.5' : 'pr-1.5'
          )}
        >
          {/* Left: Icon or Owner Pill */}
          <div className="flex items-center gap-1 shrink-0">
            {renderIcon()}
            {owner && (
              <span
                style={{ backgroundColor: owner.colorToken }}
                className="text-white text-[8px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-2xs truncate max-w-[45px]"
              >
                {owner.displayName.split(' ')[0]}
              </span>
            )}
          </div>

          {/* Center: City Name - SINGLE LINE WITHOUT WRAP */}
          <span
            title={space.name}
            className="font-extrabold text-[11px] sm:text-[12px] md:text-[12.5px] leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis tracking-tight text-indian-navy-950 dark:text-white flex-1"
          >
            {space.name}
          </span>

          {/* Right: Price Amount */}
          {'price' in space && (
            <span className="text-[10.5px] sm:text-[11.5px] font-black text-emerald-800 dark:text-emerald-400 whitespace-nowrap shrink-0">
              ₹{space.price.toLocaleString('en-IN')}
            </span>
          )}
          {'amount' in space && (
            <span className="text-[10.5px] sm:text-[11.5px] font-black text-red-600 dark:text-red-400 whitespace-nowrap shrink-0">
              ₹{space.amount.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      ) : coord.orientation === 'right' ? (
        /* Right Edge Tile: Horizontal Layout (Wide & Short) */
        <div
          className={cn(
            'w-full h-full flex flex-row items-center justify-between px-2 overflow-hidden gap-1.5',
            ownerColor ? 'pl-3.5' : 'pl-1.5'
          )}
        >
          {/* Left: Icon or Owner Pill */}
          <div className="flex items-center gap-1 shrink-0">
            {renderIcon()}
            {owner && (
              <span
                style={{ backgroundColor: owner.colorToken }}
                className="text-white text-[8px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-2xs truncate max-w-[45px]"
              >
                {owner.displayName.split(' ')[0]}
              </span>
            )}
          </div>

          {/* Center: City Name - SINGLE LINE WITHOUT WRAP */}
          <span
            title={space.name}
            className="font-extrabold text-[11px] sm:text-[12px] md:text-[12.5px] leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis tracking-tight text-indian-navy-950 dark:text-white flex-1"
          >
            {space.name}
          </span>

          {/* Right: Price Amount */}
          {'price' in space && (
            <span className="text-[10.5px] sm:text-[11.5px] font-black text-emerald-800 dark:text-emerald-400 whitespace-nowrap shrink-0">
              ₹{space.price.toLocaleString('en-IN')}
            </span>
          )}
          {'amount' in space && (
            <span className="text-[10.5px] sm:text-[11.5px] font-black text-red-600 dark:text-red-400 whitespace-nowrap shrink-0">
              ₹{space.amount.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      ) : coord.orientation === 'top' ? (
        /* Top Edge Tile: Vertical Layout (Deep & Narrow) */
        <div
          className={cn(
            'w-full h-full flex flex-col justify-between items-center text-center pt-1.5 px-0.5 sm:px-1 overflow-hidden',
            ownerColor ? 'pb-3.5' : 'pb-1.5'
          )}
        >
          {/* Top: Icon or Owner Badge */}
          <div className="w-full flex items-center justify-center min-h-[16px]">
            {renderIcon()}
            {owner && (
              <span
                style={{ backgroundColor: owner.colorToken }}
                className="text-white text-[8px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-2xs truncate max-w-full"
              >
                {owner.displayName.split(' ')[0]}
              </span>
            )}
          </div>

          {/* Middle: City Name - SINGLE LINE WITHOUT WRAP */}
          <span
            title={space.name}
            className="font-extrabold text-[10px] sm:text-[11px] md:text-[11.5px] leading-tight text-center w-full whitespace-nowrap overflow-hidden text-ellipsis tracking-tight px-0.5 text-indian-navy-950 dark:text-white"
          >
            {space.name}
          </span>

          {/* Bottom: Price / Fine Amount */}
          {'price' in space && (
            <span className="text-[10px] sm:text-[11px] font-black text-emerald-800 dark:text-emerald-400 whitespace-nowrap leading-none">
              ₹{space.price.toLocaleString('en-IN')}
            </span>
          )}
          {'amount' in space && (
            <span className="text-[10px] sm:text-[11px] font-black text-red-600 dark:text-red-400 whitespace-nowrap leading-none">
              ₹{space.amount.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      ) : (
        /* Bottom Edge Tile: Vertical Layout (Deep & Narrow) */
        <div
          className={cn(
            'w-full h-full flex flex-col justify-between items-center text-center pb-1.5 px-0.5 sm:px-1 overflow-hidden',
            ownerColor ? 'pt-3.5' : 'pt-1.5'
          )}
        >
          {/* Top: City Name - SINGLE LINE WITHOUT WRAP */}
          <span
            title={space.name}
            className="font-extrabold text-[10px] sm:text-[11px] md:text-[11.5px] leading-tight text-center w-full whitespace-nowrap overflow-hidden text-ellipsis tracking-tight px-0.5 text-indian-navy-950 dark:text-white"
          >
            {space.name}
          </span>

          {/* Middle: Icon or Owner Badge */}
          <div className="w-full flex items-center justify-center min-h-[16px]">
            {renderIcon()}
            {owner && (
              <span
                style={{ backgroundColor: owner.colorToken }}
                className="text-white text-[8px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-2xs truncate max-w-full"
              >
                {owner.displayName.split(' ')[0]}
              </span>
            )}
          </div>

          {/* Bottom: Price / Fine Amount */}
          {'price' in space && (
            <span className="text-[10px] sm:text-[11px] font-black text-emerald-800 dark:text-emerald-400 whitespace-nowrap leading-none">
              ₹{space.price.toLocaleString('en-IN')}
            </span>
          )}
          {'amount' in space && (
            <span className="text-[10px] sm:text-[11px] font-black text-red-600 dark:text-red-400 whitespace-nowrap leading-none">
              ₹{space.amount.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      )}

      {/* Players currently positioned on this tile (Placed in corner to never block city name or price) */}
      {playersHere.length > 0 && (
        <div
          className={cn(
            'absolute pointer-events-none flex items-center gap-0.5 z-20',
            coord.orientation === 'left' && 'right-3.5 top-1/2 -translate-y-1/2',
            coord.orientation === 'right' && 'left-3.5 top-1/2 -translate-y-1/2',
            coord.orientation === 'top' && 'bottom-3 right-0.5',
            coord.orientation === 'bottom' && 'top-3 right-0.5',
            coord.orientation === 'corner' && 'bottom-1 right-1'
          )}
        >
          {playersHere.map((p) => (
            <div
              key={p.uid}
              title={p.displayName}
              style={{ backgroundColor: p.colorToken }}
              className="w-4.5 sm:w-5 h-4.5 sm:h-5 rounded-full border-2 border-white shadow-token-glow flex items-center justify-center text-[8.5px] sm:text-[9.5px] text-white font-black transition-all duration-150 animate-pulse"
            >
              {p.displayName.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
