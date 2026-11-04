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
    if (space.type === 'TRANSIT') return <Train className="w-3.5 h-3.5 text-indian-navy-700 dark:text-indian-parchment-200" />;
    if (space.type === 'UTILITY') {
      if (space.id.includes('power')) return <Zap className="w-3.5 h-3.5 text-amber-500" />;
      if (space.id.includes('jal') || space.id.includes('water')) return <Droplets className="w-3.5 h-3.5 text-blue-500" />;
      if (space.id.includes('telecom')) return <Radio className="w-3.5 h-3.5 text-indigo-500" />;
      return <Flame className="w-3.5 h-3.5 text-orange-500" />;
    }
    if (space.type === 'TAX') return <ShieldAlert className="w-3.5 h-3.5 text-red-600" />;
    if (space.type === 'CARD') {
      return space.deck === 'CIVIC' ? (
        <Gift className="w-3.5 h-3.5 text-amber-600" />
      ) : (
        <Flame className="w-3.5 h-3.5 text-orange-600" />
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
        'relative flex flex-col justify-between border border-indian-parchment-400 bg-white dark:bg-indian-navy-900 text-indian-navy-950 dark:text-white select-none cursor-pointer transition-all duration-200 p-0.5 overflow-hidden',
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
            coord.orientation === 'bottom' && 'top-0 left-0 right-0 h-2',
            coord.orientation === 'left' && 'top-0 bottom-0 right-0 w-2',
            coord.orientation === 'top' && 'bottom-0 left-0 right-0 h-2',
            coord.orientation === 'right' && 'top-0 bottom-0 left-0 w-2'
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
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-0.5 bg-indian-parchment-100 dark:bg-indian-navy-950/60 overflow-hidden">
          {space.spaceIndex === 0 && (
            <div className="flex flex-col items-center text-indian-terracotta-600 gap-0.5">
              <span className="font-serif text-[11px] sm:text-xs md:text-sm font-black tracking-wider whitespace-nowrap">START</span>
              <span className="text-[9.5px] sm:text-[10.5px] font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">₹2,000</span>
              <ArrowLeft className="w-3 h-3 text-indian-terracotta-500 animate-pulse-subtle" />
            </div>
          )}
          {space.spaceIndex === 10 && (
            <div className="text-center">
              <span className="block text-[11px] sm:text-xs font-black text-red-700 whitespace-nowrap">JAIL</span>
              <span className="text-[8px] sm:text-[9px] text-gray-500 font-bold whitespace-nowrap">Visiting</span>
            </div>
          )}
          {space.spaceIndex === 20 && (
            <div className="text-center text-amber-700">
              <span className="block text-[11px] sm:text-xs font-black whitespace-nowrap">REST</span>
              <span className="text-[8px] sm:text-[9px] text-gray-500 font-bold whitespace-nowrap">House</span>
            </div>
          )}
          {space.spaceIndex === 30 && (
            <div className="text-center text-red-600">
              <span className="block text-[11px] sm:text-xs font-black whitespace-nowrap">GO TO</span>
              <span className="text-[8px] sm:text-[9px] font-extrabold whitespace-nowrap">JAIL</span>
            </div>
          )}
        </div>
      ) : (
        /* Regular Edge Tile - Single Line Without Wrap & Vertical Spacing */
        <div
          className={cn(
            'w-full h-full flex flex-col justify-between items-center text-center py-1 px-0.5 overflow-hidden',
            ownerColor && coord.orientation === 'bottom' && 'pt-2.5',
            ownerColor && coord.orientation === 'top' && 'pb-2.5',
            ownerColor && coord.orientation === 'left' && 'pr-2.5',
            ownerColor && coord.orientation === 'right' && 'pl-2.5'
          )}
        >
          {/* Top/Icon Header */}
          <div className="w-full flex items-center justify-center min-h-[14px]">
            {renderIcon()}
            {owner && (
              <span
                style={{ backgroundColor: owner.colorToken }}
                className="text-white text-[7.5px] sm:text-[8.5px] font-black px-1.5 py-0.2 rounded-full shadow-2xs truncate max-w-full"
              >
                {owner.displayName.split(' ')[0]}
              </span>
            )}
          </div>

          {/* Place / City Name - SINGLE LINE WITHOUT WRAP */}
          <span
            title={space.name}
            className="font-extrabold text-[10px] sm:text-[10.5px] md:text-[11px] leading-none text-center w-full whitespace-nowrap overflow-hidden text-ellipsis tracking-tight px-0.5 text-indian-navy-950 dark:text-white"
          >
            {space.name}
          </span>

          {/* Price / Fine Amount - SINGLE LINE WITHOUT WRAP */}
          {'price' in space && (
            <span className="text-[9.5px] sm:text-[10.5px] md:text-[11px] font-black text-emerald-800 dark:text-emerald-400 whitespace-nowrap leading-none">
              ₹{space.price.toLocaleString('en-IN')}
            </span>
          )}
          {'amount' in space && (
            <span className="text-[9.5px] sm:text-[10.5px] md:text-[11px] font-black text-red-600 dark:text-red-400 whitespace-nowrap leading-none">
              ₹{space.amount.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      )}

      {/* Players currently positioned on this tile */}
      {playersHere.length > 0 && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center flex-wrap gap-0.5 p-0.5 z-20">
          {playersHere.map((p) => (
            <div
              key={p.uid}
              title={p.displayName}
              style={{ backgroundColor: p.colorToken }}
              className="w-4 sm:w-4.5 h-4 sm:h-4.5 rounded-full border-2 border-white shadow-token-glow flex items-center justify-center text-[7.5px] sm:text-[8px] text-white font-black transition-all duration-150 animate-pulse"
            >
              {p.displayName.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
