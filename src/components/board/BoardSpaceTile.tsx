import React from 'react';
import { BoardSpaceDefinition, PlayerState, PropertyState } from '@/domain/game-types';
import { getSpaceGridCoord, GROUP_COLOR_MAP } from './board-layout-utils';
import { Train, Zap, Droplets, ShieldAlert, Gift, Flame, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface BoardSpaceTileProps {
  space: BoardSpaceDefinition;
  propertyState?: PropertyState;
  playersHere: PlayerState[];
  isSelected: boolean;
  onSelect: () => void;
}

export const BoardSpaceTile: React.FC<BoardSpaceTileProps> = ({
  space,
  propertyState,
  playersHere,
  isSelected,
  onSelect,
}) => {
  const coord = getSpaceGridCoord(space.spaceIndex);
  const isCorner = coord.orientation === 'corner';

  // Group color if property
  const colorBar =
    space.type === 'PROPERTY' ? GROUP_COLOR_MAP[space.group] : null;

  // Icon for special spaces
  const renderIcon = () => {
    if (space.type === 'TRANSIT') return <Train className="w-3.5 h-3.5 text-indian-navy-700" />;
    if (space.type === 'UTILITY') {
      return space.id.includes('power') ? (
        <Zap className="w-3.5 h-3.5 text-amber-500" />
      ) : (
        <Droplets className="w-3.5 h-3.5 text-blue-500" />
      );
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
      }}
      className={cn(
        'relative flex flex-col justify-between border border-indian-parchment-400/80 bg-indian-parchment-100 text-indian-navy-900 select-none cursor-pointer transition-all p-0.5 sm:p-1 overflow-hidden',
        isSelected && 'ring-2 ring-indian-terracotta-500 bg-amber-50/90 z-20',
        propertyState?.isMortgaged && 'opacity-70 bg-gray-200/60',
        isCorner ? 'font-bold' : 'text-[10px] leading-tight'
      )}
    >
      {/* Property Color Bar */}
      {colorBar && (
        <div
          className={cn(
            'absolute transition-all',
            coord.orientation === 'bottom' && 'top-0 left-0 right-0 h-2 sm:h-3',
            coord.orientation === 'left' && 'top-0 bottom-0 right-0 w-2 sm:w-3',
            coord.orientation === 'top' && 'bottom-0 left-0 right-0 h-2 sm:h-3',
            coord.orientation === 'right' && 'top-0 bottom-0 left-0 w-2 sm:w-3'
          )}
          style={{ backgroundColor: colorBar }}
        >
          {/* Buildings (Houses / Tower) */}
          {propertyState && propertyState.buildings > 0 && (
            <div className="w-full h-full flex items-center justify-center gap-0.5">
              {propertyState.buildings === 5 ? (
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-red-600 border border-white" />
              ) : (
                Array.from({ length: propertyState.buildings }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 sm:w-1.5 h-1 sm:h-1.5 bg-emerald-500 border border-white rounded-xs"
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Corner Space Special Styling */}
      {isCorner ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-1">
          {space.spaceIndex === 0 && (
            <div className="flex flex-col items-center text-indian-terracotta-600">
              <span className="font-serif text-xs sm:text-sm font-extrabold tracking-wider">START</span>
              <span className="text-[8px] sm:text-[9px] text-emerald-700 font-semibold">₹2,000</span>
              <ArrowLeft className="w-3.5 h-3.5 text-indian-terracotta-500 animate-pulse-subtle" />
            </div>
          )}
          {space.spaceIndex === 10 && (
            <div className="text-center text-[9px] sm:text-[10px]">
              <span className="block text-red-700 font-bold">JAIL</span>
              <span className="text-[8px] text-gray-500">Visiting</span>
            </div>
          )}
          {space.spaceIndex === 20 && (
            <div className="text-center text-[9px] sm:text-[10px] text-amber-700">
              <span className="block font-bold">REST</span>
              <span className="text-[8px] text-gray-500">House</span>
            </div>
          )}
          {space.spaceIndex === 30 && (
            <div className="text-center text-[9px] sm:text-[10px] text-red-600">
              <span className="block font-bold">GO TO</span>
              <span className="text-[8px] font-bold">JAIL</span>
            </div>
          )}
        </div>
      ) : (
        /* Regular Edge Tile */
        <div
          className={cn(
            'w-full h-full flex flex-col justify-between items-center text-center p-0.5',
            coord.orientation === 'bottom' && 'pt-2.5 sm:pt-3',
            coord.orientation === 'top' && 'pb-2.5 sm:pb-3',
            coord.orientation === 'left' && 'pr-2.5 sm:pr-3',
            coord.orientation === 'right' && 'pl-2.5 sm:pl-3'
          )}
        >
          <div className="w-full flex items-center justify-center">{renderIcon()}</div>
          <span className="font-medium text-[8px] sm:text-[9px] line-clamp-2 w-full tracking-tight">
            {space.name}
          </span>
          {'price' in space && (
            <span className="text-[8px] sm:text-[9px] font-semibold text-indian-navy-700/80">
              ₹{space.price}
            </span>
          )}
          {'amount' in space && (
            <span className="text-[8px] sm:text-[9px] font-semibold text-red-600">
              ₹{space.amount}
            </span>
          )}
        </div>
      )}

      {/* Players stationed on this tile */}
      {playersHere.length > 0 && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center flex-wrap gap-0.5 p-1 z-10">
          {playersHere.map((p) => (
            <div
              key={p.uid}
              title={p.displayName}
              style={{ backgroundColor: p.colorToken }}
              className="w-3.5 sm:w-4 h-3.5 sm:h-4 rounded-full border-2 border-white shadow-token-glow flex items-center justify-center text-[7px] text-white font-black animate-bounce-short"
            >
              {p.displayName.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
