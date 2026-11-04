import React from 'react';
import { BoardSpaceDefinition, PlayerState, PropertyState } from '@/domain/game-types';
import { getSpaceGridCoord } from './board-layout-utils';
import { ArrowLeft, Zap, Droplets, ShieldAlert, Gift, Flame } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Realistic, crisp SVG illustrations for Railways and Airports
const RailwayImage: React.FC<{ className?: string }> = ({ className = 'w-5 h-5 sm:w-6 sm:h-6' }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Express Locomotive Engine */}
    <rect x="11" y="7" width="26" height="26" rx="5" fill="#1E3A8A" stroke="#172554" strokeWidth="2" />
    <path d="M13 19H35V22C35 24 33 26 31 26H17C15 26 13 24 13 22V19Z" fill="#3B82F6" />
    <rect x="14" y="11" width="8" height="6" rx="1" fill="#E0F2FE" />
    <rect x="26" y="11" width="8" height="6" rx="1" fill="#E0F2FE" />
    <circle cx="16" cy="28.5" r="2.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="1" />
    <circle cx="32" cy="28.5" r="2.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="1" />
    <rect x="21" y="27" width="6" height="3" rx="1" fill="#DC2626" />
    {/* Tracks and Ties */}
    <path d="M14 34L7 43M34 34L41 43" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M9 41H39" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
    <path d="M13 36H35" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const AirportImage: React.FC<{ className?: string }> = ({ className = 'w-5 h-5 sm:w-6 sm:h-6' }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Passenger Airliner Plane */}
    <path
      d="M24 4C22.5 4 21.5 5.5 21.5 7.5L21 20L6 28V31.5L21 26.5L21.5 37L16 41V43L24 41L32 43V41L26.5 37L27 26.5L42 31.5V28L27 20L26.5 7.5C26.5 5.5 25.5 4 24 4Z"
      fill="#0284C7"
      stroke="#0369A1"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M23 8C23 7.5 23.5 7 24 7C24.5 7 25 7.5 25 8V11H23V8Z" fill="#E0F2FE" />
    <ellipse cx="14" cy="27" rx="1.5" ry="2.5" fill="#0369A1" />
    <ellipse cx="34" cy="27" rx="1.5" ry="2.5" fill="#0369A1" />
  </svg>
);

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

  // Render transit image illustration (Railway vs Airport)
  const isRailway =
    space.type === 'TRANSIT' &&
    (space.name.toLowerCase().includes('railway') ||
      space.id.includes('railway') ||
      space.id.includes('cst') ||
      space.id.includes('howrah'));

  const isAirport =
    space.type === 'TRANSIT' &&
    (space.name.toLowerCase().includes('airport') || space.id.includes('airport'));

  // Adaptive font sizing based on string length to guarantee clean single-line fit without wrapping or truncation
  const nameLength = space.name.length;
  const nameFontSizeClass =
    nameLength > 12
      ? 'text-[7px] sm:text-[7.5px] md:text-[8px]'
      : nameLength > 8
        ? 'text-[7.5px] sm:text-[8px] md:text-[8.5px]'
        : 'text-[8.5px] sm:text-[9px] md:text-[9.5px]';

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
            coord.orientation === 'bottom' && 'top-0 left-0 right-0 h-1.5 sm:h-2',
            coord.orientation === 'left' && 'top-0 bottom-0 right-0 w-1.5 sm:w-2',
            coord.orientation === 'top' && 'bottom-0 left-0 right-0 h-1.5 sm:h-2',
            coord.orientation === 'right' && 'top-0 bottom-0 left-0 w-1.5 sm:w-2'
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

      {/* Corner Space Special Styling: Smaller compact boxes in extreme corners */}
      {isCorner ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-0.5 sm:p-1 bg-indian-parchment-100 dark:bg-indian-navy-950/60 overflow-hidden select-none">
          {space.spaceIndex === 0 && (
            <div className="flex flex-col items-center justify-center text-indian-terracotta-600 gap-0.5">
              <span className="font-serif text-[10.5px] sm:text-xs md:text-sm font-black tracking-wider whitespace-nowrap">START</span>
              <span className="text-[9px] sm:text-[10px] font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">₹2,000</span>
              <ArrowLeft className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indian-terracotta-500 animate-pulse-subtle" />
            </div>
          )}
          {space.spaceIndex === 10 && (
            <div className="text-center">
              <span className="block text-[10.5px] sm:text-xs font-black text-red-700 whitespace-nowrap">JAIL</span>
              <span className="text-[8px] sm:text-[9px] text-gray-500 font-bold whitespace-nowrap">Visiting</span>
            </div>
          )}
          {space.spaceIndex === 20 && (
            <div className="text-center text-amber-700">
              <span className="block text-[10.5px] sm:text-xs font-black whitespace-nowrap">REST</span>
              <span className="text-[8px] sm:text-[9px] text-gray-500 font-bold whitespace-nowrap">House</span>
            </div>
          )}
          {space.spaceIndex === 30 && (
            <div className="text-center text-red-600">
              <span className="block text-[10.5px] sm:text-xs font-black whitespace-nowrap">GO TO</span>
              <span className="text-[8px] sm:text-[9px] font-extrabold whitespace-nowrap">JAIL</span>
            </div>
          )}
        </div>
      ) : (
        /* Regular Edge City & Space Tile: Exactly TWO LINES (Decreased Font Size) */
        <div
          className={cn(
            'w-full h-full flex flex-col justify-center items-center text-center px-0.5 sm:px-1 overflow-hidden select-none gap-0.5',
            ownerColor && coord.orientation === 'bottom' && 'pt-2',
            ownerColor && coord.orientation === 'top' && 'pb-2',
            ownerColor && coord.orientation === 'left' && 'pr-2',
            ownerColor && coord.orientation === 'right' && 'pl-2'
          )}
        >
          {/* Line 1: City / Place Name (Refined Decreased Font Size) */}
          <span
            title={space.name}
            className={cn(
              'font-bold leading-tight text-center w-full whitespace-nowrap overflow-hidden text-ellipsis tracking-tight px-0.5 text-indian-navy-950 dark:text-white',
              nameFontSizeClass
            )}
          >
            {space.name}
          </span>

          {/* Transit Image: Railway or Airport in-grid illustration */}
          {isRailway && <RailwayImage className="w-4 h-4 sm:w-5 sm:h-5 my-0.5 shrink-0" />}
          {isAirport && <AirportImage className="w-4 h-4 sm:w-5 sm:h-5 my-0.5 shrink-0" />}

          {/* Special Space Icons (Utility / Tax / Card) when not transit */}
          {!isRailway && !isAirport && space.type === 'UTILITY' && (
            space.id.includes('power') ? (
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <Droplets className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            )
          )}
          {!isRailway && !isAirport && space.type === 'TAX' && (
            <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
          )}
          {!isRailway && !isAirport && space.type === 'CARD' && (
            space.deck === 'CIVIC' ? (
              <Gift className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            ) : (
              <Flame className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            )
          )}

          {/* Line 2: Price / Category (Refined Decreased Font Size) */}
          {'price' in space && (
            <span className="text-[8px] sm:text-[8.5px] md:text-[9px] font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap leading-none">
              ₹{space.price.toLocaleString('en-IN')}
            </span>
          )}
          {'amount' in space && (
            <span className="text-[8px] sm:text-[8.5px] md:text-[9px] font-black text-red-600 dark:text-red-400 whitespace-nowrap leading-none">
              ₹{space.amount.toLocaleString('en-IN')}
            </span>
          )}
          {space.type === 'CARD' && (
            <span className="text-[7.5px] sm:text-[8px] font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap leading-none">
              {space.deck === 'CIVIC' ? 'Treasury' : 'Fortune'}
            </span>
          )}

          {/* Small Owner Tag Pill if Owned */}
          {owner && (
            <div className="absolute top-0.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <span
                style={{ backgroundColor: owner.colorToken }}
                className="text-white text-[7px] sm:text-[7.5px] font-black px-1 rounded-full shadow-2xs truncate max-w-[48px] block"
              >
                {owner.displayName.split(' ')[0]}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Players currently positioned on this tile (Placed in corner to never block city name or price) */}
      {playersHere.length > 0 && (
        <div
          className={cn(
            'absolute pointer-events-none flex items-center gap-0.5 z-20',
            coord.orientation === 'left' && 'right-1 top-1',
            coord.orientation === 'right' && 'left-1 top-1',
            coord.orientation === 'top' && 'bottom-1 right-1',
            coord.orientation === 'bottom' && 'top-1 right-1',
            coord.orientation === 'corner' && 'bottom-1 right-1'
          )}
        >
          {playersHere.map((p) => (
            <div
              key={p.uid}
              title={p.displayName}
              style={{ backgroundColor: p.colorToken }}
              className="w-4 sm:w-4.5 h-4 sm:h-4.5 rounded-full border-2 border-white shadow-token-glow flex items-center justify-center text-[8px] sm:text-[8.5px] text-white font-black transition-all duration-150 animate-pulse"
            >
              {p.displayName.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
