import React from 'react';
import { BoardSpaceDefinition, PlayerState, PropertyState } from '@/domain/game-types';
import { getSpaceGridCoord } from './board-layout-utils';
import { ArrowLeft, Zap, Droplets, ShieldAlert, Gift, Flame } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Realistic, crisp SVG illustrations for Railways and Airports
const RailwayImage: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 sm:w-5 sm:h-5' }) => (
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

const AirportImage: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 sm:w-5 sm:h-5' }) => (
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

  // Find owner player
  const owner = propertyState?.ownerUid
    ? allPlayers.find((p) => p.uid === propertyState.ownerUid)
    : null;
  const ownerColor = owner?.colorToken;

  // Transit illustration check
  const isRailway =
    space.type === 'TRANSIT' &&
    (space.name.toLowerCase().includes('railway') ||
      space.id.includes('railway') ||
      space.id.includes('cst') ||
      space.id.includes('howrah'));

  const isAirport =
    space.type === 'TRANSIT' &&
    (space.name.toLowerCase().includes('airport') || space.id.includes('airport'));

  // Adaptive larger font size based on city name length to ensure single-line fit without truncation
  const nameLength = space.name.length;
  const nameFontSizeClass =
    nameLength > 13
      ? 'text-[8.5px] sm:text-[9.5px] md:text-[10.5px]'
      : nameLength > 8
        ? 'text-[9.5px] sm:text-[10.5px] md:text-[11.5px]'
        : 'text-[10.5px] sm:text-[11.5px] md:text-[13px]';

  // Tile ownership styling: When owned, color grid with owner's player color
  const tileStyle: React.CSSProperties = {
    gridRow: coord.row,
    gridColumn: coord.col,
    ...(ownerColor
      ? {
          borderColor: ownerColor,
          backgroundColor: `${ownerColor}18`, // Subtle translucent player color tint
        }
      : {}),
  };

  // Dedicated Player Tokens Row Component (renders player pawn circles cleanly without overlapping texts)
  const renderPlayerTokens = (className?: string) => {
    if (playersHere.length === 0) return null;
    return (
      <div className={cn('flex items-center justify-center gap-1 shrink-0 z-20 py-0.5', className)}>
        {playersHere.map((p) => (
          <div
            key={p.uid}
            title={p.displayName}
            style={{ backgroundColor: p.colorToken }}
            className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full border-2 border-white shadow-token-glow flex items-center justify-center text-[10px] sm:text-[11px] text-white font-black animate-pulse shrink-0"
          >
            {p.displayName.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
    );
  };

  // Owner Accent Bar (displayed along the edge facing the board center)
  const renderOwnerAccentBar = () => {
    if (!ownerColor) return null;
    return (
      <div
        style={{ backgroundColor: ownerColor }}
        className="w-full h-1.5 shrink-0 flex items-center justify-center"
      >
        <span className="text-[7px] sm:text-[7.5px] font-black text-white leading-none tracking-tighter truncate px-1">
          {owner?.displayName.split(' ')[0]}
        </span>
      </div>
    );
  };

  return (
    <div
      onClick={onSelect}
      style={tileStyle}
      className={cn(
        'relative flex flex-col justify-between border bg-white dark:bg-indian-navy-900 text-indian-navy-950 dark:text-white select-none cursor-pointer transition-all duration-200 overflow-hidden',
        !ownerColor && 'border-indian-parchment-400',
        ownerColor && 'border-2',
        isSelected && 'ring-2 ring-indian-terracotta-500 bg-amber-50 dark:bg-indian-navy-800 z-20',
        isHighlighted && 'ring-4 ring-amber-400 dark:ring-amber-300 scale-105 z-30 shadow-[0_0_20px_rgba(251,191,36,0.9)] animate-pulse',
        propertyState?.isMortgaged && 'opacity-65 bg-gray-100/90 dark:bg-gray-900/80'
      )}
    >
      {/* Corner Spaces: Compact Extreme Corner styling with dedicated player token slot */}
      {isCorner ? (
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-between text-center p-1 bg-indian-parchment-100/70 dark:bg-indian-navy-950/70 overflow-hidden select-none">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {space.spaceIndex === 0 && (
              <div className="flex flex-col items-center justify-center text-indian-terracotta-600 gap-0.5">
                <span className="font-serif text-xs sm:text-sm md:text-base font-black tracking-wider whitespace-nowrap">START</span>
                <span className="text-[10px] sm:text-[11px] md:text-xs font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">₹2,000</span>
                <ArrowLeft className="w-3 h-3 text-indian-terracotta-500 animate-pulse-subtle" />
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
          {renderPlayerTokens('h-6')}
        </div>
      ) : (
        /* Regular Edge City & Space Tile: Structured non-overlapping layout */
        <div className="relative w-full h-full flex flex-col justify-between overflow-hidden">
          {/* Subtle Vector Icon Motif positioned BEHIND text contents */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-20 dark:opacity-30 select-none overflow-hidden p-1">
            {isRailway && <RailwayImage className="w-9 h-9 sm:w-11 sm:h-11" />}
            {isAirport && <AirportImage className="w-9 h-9 sm:w-11 sm:h-11" />}
            {!isRailway && !isAirport && space.type === 'UTILITY' && (
              space.id.includes('power') ? (
                <Zap className="w-9 h-9 sm:w-11 sm:h-11 text-amber-500" />
              ) : (
                <Droplets className="w-9 h-9 sm:w-11 sm:h-11 text-blue-500" />
              )
            )}
            {!isRailway && !isAirport && space.type === 'TAX' && (
              <ShieldAlert className="w-9 h-9 sm:w-11 sm:h-11 text-red-600" />
            )}
            {!isRailway && !isAirport && space.type === 'CARD' && (
              space.deck === 'CIVIC' ? (
                <Gift className="w-9 h-9 sm:w-11 sm:h-11 text-amber-600" />
              ) : (
                <Flame className="w-9 h-9 sm:w-11 sm:h-11 text-orange-600" />
              )
            )}
          </div>

          {/* BOTTOM TILES (Row 11): Board center is above; Player tokens and owner bar sit at top facing center */}
          {coord.orientation === 'bottom' && (
            <div className="relative z-10">
              {renderOwnerAccentBar()}
              {playersHere.length > 0 ? (
                renderPlayerTokens('h-6')
              ) : (
                <div className="h-1.5 shrink-0" />
              )}
            </div>
          )}

          {/* Core Content: City Name, In-Grid Built Houses/Tower, and Price in FRONT */}
          <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center px-0.5 sm:px-1 gap-0.5 min-h-0 overflow-hidden">
            {/* Line 1: City / Place Name (Single line, bold, larger font size) */}
            <span
              title={space.name}
              className={cn(
                'font-black leading-tight text-center w-full whitespace-nowrap overflow-hidden text-ellipsis tracking-tight px-0.5 text-indian-navy-950 dark:text-white drop-shadow-2xs',
                nameFontSizeClass
              )}
            >
              {space.name}
            </span>

            {/* In-Grid Development: Built Houses (1-4) or Commercial Tower (5) */}
            {propertyState && propertyState.buildings > 0 && (
              <div className="my-0.5 shrink-0 flex items-center justify-center">
                {propertyState.buildings === 5 ? (
                  <div className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-500 text-white font-black text-[7.5px] sm:text-[8.5px] shadow-2xs leading-none">
                    <span>🏢</span>
                    <span>TOWER</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-0.5 leading-none">
                    {Array.from({ length: propertyState.buildings }).map((_, i) => (
                      <span key={i} title={`House ${i + 1}`} className="text-[9.5px] sm:text-[10.5px] leading-none">
                        🏠
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mortgaged indicator tag */}
            {propertyState?.isMortgaged && (
              <span className="text-[7px] sm:text-[7.5px] font-black text-red-600 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 px-1 rounded-full leading-none my-0.2">
                MORTGAGED
              </span>
            )}

            {/* Line 2: Purchase Price & Mortgage Value (Larger, High Contrast) */}
            {'price' in space && (
              <div className="flex items-center justify-center gap-1 leading-none flex-wrap">
                <span className="text-[8.5px] sm:text-[9.5px] md:text-[10.5px] font-black text-emerald-800 dark:text-emerald-300 whitespace-nowrap leading-none drop-shadow-2xs">
                  ₹{space.price.toLocaleString('en-IN')}
                </span>
                <span className="text-[7.5px] sm:text-[8px] md:text-[9px] font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap leading-none">
                  M: ₹{('mortgageValue' in space ? space.mortgageValue : Math.floor((space as { price: number }).price / 2)).toLocaleString('en-IN')}
                </span>
              </div>
            )}
            {'amount' in space && (
              <span className="text-[9.5px] sm:text-[10.5px] md:text-[11.5px] font-black text-red-600 dark:text-red-400 whitespace-nowrap leading-none drop-shadow-2xs">
                ₹{space.amount.toLocaleString('en-IN')}
              </span>
            )}
            {space.type === 'CARD' && (
              <span className="text-[8.5px] sm:text-[9.5px] md:text-[10px] font-black text-amber-800 dark:text-amber-300 whitespace-nowrap leading-none drop-shadow-2xs">
                {space.deck === 'CIVIC' ? 'Treasury' : 'Fortune'}
              </span>
            )}
          </div>

          {/* TOP, LEFT, RIGHT TILES: Player tokens and owner bar sit towards the board interior */}
          {coord.orientation === 'top' && (
            <div className="relative z-10">
              {playersHere.length > 0 ? (
                renderPlayerTokens('h-6')
              ) : (
                <div className="h-1.5 shrink-0" />
              )}
              {renderOwnerAccentBar()}
            </div>
          )}

          {(coord.orientation === 'left' || coord.orientation === 'right') && (
            <div className="relative z-10">
              {playersHere.length > 0 ? (
                renderPlayerTokens('h-6')
              ) : (
                <div className="h-1 shrink-0" />
              )}
              {renderOwnerAccentBar()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
