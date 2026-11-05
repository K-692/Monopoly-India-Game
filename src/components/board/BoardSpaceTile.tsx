import React from 'react';
import { BoardSpaceDefinition, PlayerState, PropertyState } from '@/domain/game-types';
import { getSpaceGridCoord } from './board-layout-utils';
import { getCityPriceColor, getCityTextColor, getCityBorderColor } from '@/domain/city-colors';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Returns the localized visual background image for non-city board grids
 * (Civic Fund, Market Buzz, GST Tax, Infra Levy, Utilities, and Transits).
 */
function getGridBackgroundImage(space: BoardSpaceDefinition): string | null {
  if (space.type === 'CARD') {
    return space.deck === 'CIVIC' ? '/assets/grids/civic_fund.svg' : '/assets/grids/market_buzz.svg';
  }
  if (space.type === 'TAX') {
    return space.id.includes('infrastructure') || space.name.toLowerCase().includes('infra')
      ? '/assets/grids/infra_levy.svg'
      : '/assets/grids/gst_tax.svg';
  }
  if (space.type === 'UTILITY') {
    return space.id.includes('power') || space.name.toLowerCase().includes('urja')
      ? '/assets/grids/urja_power.svg'
      : '/assets/grids/jal_board.svg';
  }
  if (space.type === 'TRANSIT') {
    return space.id.includes('airport') || space.name.toLowerCase().includes('airport')
      ? '/assets/grids/airport.svg'
      : '/assets/grids/railway.svg';
  }
  return null;
}

interface BoardSpaceTileProps {
  space: BoardSpaceDefinition;
  propertyState?: PropertyState;
  playersHere: PlayerState[];
  allPlayers?: PlayerState[];
  isSelected: boolean;
  isHighlighted?: boolean;
  onSelect: () => void;
  showTokens?: boolean;
}

export const BoardSpaceTile: React.FC<BoardSpaceTileProps> = ({
  space,
  propertyState,
  playersHere,
  allPlayers = [],
  isSelected,
  isHighlighted = false,
  onSelect,
  showTokens = false,
}) => {
  const coord = getSpaceGridCoord(space.spaceIndex);
  const isCorner = coord.orientation === 'corner';
  const isCity = space.type === 'PROPERTY';
  const isJail = space.spaceIndex === 10;
  const isStart = space.spaceIndex === 0;
  const isNonCity = !isCity && !isJail && !isStart && !isCorner;
  const isBlocked = propertyState?.ownershipState === 'BLOCKED';

  // Find owner player
  const owner = propertyState?.ownerUid
    ? allPlayers.find((p) => p.uid === propertyState.ownerUid)
    : null;
  const ownerColor = owner?.colorToken;

  // City price shade
  const cityPrice = 'price' in space ? (space as { price: number }).price : 0;
  const priceColor = isCity ? getCityPriceColor(cityPrice) : null;

  // Background visual image for non-city grids (Civic, Market, Transit, Tax, Utility)
  const bgImage = !isCity ? getGridBackgroundImage(space) : null;

  const tileStyle: React.CSSProperties = {
    gridRow: coord.row,
    gridColumn: coord.col,
    ...(isCity && priceColor
      ? {
          backgroundColor: priceColor,
          borderColor: ownerColor || getCityBorderColor(cityPrice),
        }
      : ownerColor
        ? {
            borderColor: ownerColor,
            backgroundColor: `${ownerColor}24`,
            ...(bgImage
              ? {
                  backgroundImage: `url(${bgImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {}),
          }
        : bgImage
          ? {
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : {}),
  };

  // Dedicated Player Tokens Row Component (renders when showTokens is true)
  const renderPlayerTokens = (className?: string) => {
    if (!showTokens || playersHere.length === 0) return null;
    return (
      <div className={cn('flex items-center justify-center -space-x-1.5 shrink-0 z-20 pb-0.5', className)}>
        {playersHere.map((p) => (
          <div
            key={p.uid}
            title={p.displayName}
            style={{ backgroundColor: p.colorToken }}
            className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full border-2 border-white shadow-token-glow flex items-center justify-center text-[9px] sm:text-[10px] text-white font-black animate-pulse shrink-0"
          >
            {p.displayName.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
    );
  };

  // Owner Accent Bar (displayed along top edge of owned property)
  const renderOwnerAccentBar = () => {
    if (!ownerColor) return null;
    return (
      <div
        style={{ backgroundColor: ownerColor }}
        className="w-full h-2 shrink-0 flex items-center justify-center z-10"
      >
        <span className="text-[7px] sm:text-[7.5px] font-black text-white leading-none tracking-tighter truncate px-1">
          {owner?.displayName.split(' ')[0]}
        </span>
      </div>
    );
  };

  // Clean, high-legibility Space Name Rendering
  const renderSpaceName = () => {
    const cityTextColor = isCity ? getCityTextColor(cityPrice) : undefined;
    const isDarkGreen = isCity && cityPrice > 1400;

    return (
      <div className="w-full pt-1 px-1 flex items-center justify-center shrink-0 overflow-hidden z-10">
        <span
          title={space.name}
          style={{ color: cityTextColor }}
          className={cn(
            'font-black text-center tracking-tight truncate whitespace-nowrap block max-w-full leading-none',
            isCity
              ? isDarkGreen
                ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]'
                : 'drop-shadow-none'
              : 'text-indian-navy-950 drop-shadow-2xs',
            isNonCity && 'text-indian-navy-950 font-black px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-white/85 shadow-2xs border border-white/60',
            space.name.length > 14
              ? 'text-[7.5px] sm:text-[8.5px] md:text-[9.5px]'
              : space.name.length > 10
                ? 'text-[8.5px] sm:text-[9.5px] md:text-[10.5px]'
                : space.name.length > 7
                  ? 'text-[9.5px] sm:text-[10.5px] md:text-[11.5px]'
                  : 'text-[10.5px] sm:text-[11.5px] md:text-[12.5px]'
          )}
        >
          {space.name}
        </span>
      </div>
    );
  };

  return (
    <div
      onClick={onSelect}
      data-space-index={space.spaceIndex}
      data-testid={`space-tile-${space.spaceIndex}`}
      style={tileStyle}
      className={cn(
        'relative flex flex-col justify-between border select-none cursor-pointer transition-all duration-200 overflow-hidden',
        // Non-city grids: subtle ambient border with responsive background styling
        isNonCity && 'border-2 border-orange-500/80 shadow-[0_0_10px_rgba(249,115,22,0.35)] ring-1 ring-orange-400/40',
        // Jail grid: Glow red with authentic prison styling
        isJail && 'border-2 border-red-600 shadow-[0_0_18px_rgba(239,68,68,0.85)] ring-2 ring-red-500/50 bg-white dark:bg-zinc-900',
        // City grid styling
        isCity && !ownerColor && 'border-2 shadow-2xs',
        isCity && ownerColor && 'border-3 shadow-xs',
        // Corners fallback
        isStart && 'bg-indian-parchment-100 dark:bg-indian-navy-950 border-indian-parchment-400 text-indian-navy-950 dark:text-white',
        isSelected && 'ring-2 ring-indian-terracotta-500 z-20',
        isHighlighted && 'ring-4 ring-amber-400 dark:ring-amber-300 scale-105 z-30 shadow-[0_0_20px_rgba(251,191,36,0.9)] animate-pulse',
        propertyState?.isMortgaged && !isBlocked && 'opacity-65 bg-gray-100/90 dark:bg-gray-900/80',
        isBlocked && 'opacity-65 grayscale bg-zinc-300 dark:bg-zinc-800 border-zinc-600'
      )}
    >
      {/* Corner Spaces: START, JAIL, REST HOUSE, GO TO JAIL */}
      {isCorner ? (
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-between text-center p-1 overflow-hidden select-none">
          {/* Jail Black and White Jail Bars Overlay */}
          {isJail && (
            <div
              className="absolute inset-0 pointer-events-none z-0 opacity-45"
              style={{
                background: 'repeating-linear-gradient(90deg, #18181b 0px, #18181b 4px, #ffffff 4px, #ffffff 9px)',
              }}
            />
          )}

          <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center w-full">
            {/* START Corner */}
            {space.spaceIndex === 0 && (
              <div className="flex flex-col items-center justify-center text-indian-terracotta-600 gap-0.5">
                <span className="font-serif text-xs sm:text-sm md:text-base font-black tracking-wider whitespace-nowrap">START</span>
                <ArrowLeft className="w-3.5 h-3.5 text-indian-terracotta-500 animate-pulse-subtle" />
              </div>
            )}

            {/* JAIL Corner */}
            {space.spaceIndex === 10 && (
              <div className="px-2 py-0.5 rounded bg-red-700/95 border border-red-400 text-white shadow-md text-center">
                <span className="block text-xs sm:text-sm md:text-base font-black tracking-wider leading-none text-white drop-shadow">
                  JAIL
                </span>
                <span className="text-[8px] sm:text-[9px] text-amber-200 font-extrabold tracking-tight block mt-0.5 leading-none">
                  Visiting
                </span>
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
        /* Regular Edge City & Non-City Tile */
        <div className="relative w-full h-full flex flex-col justify-between items-center text-center overflow-hidden select-none">
          {/* Subtle gradient overlay to enhance background image contrast without clutter */}
          {bgImage && (
            <div className="absolute inset-0 bg-white/20 dark:bg-black/15 pointer-events-none z-0" />
          )}

          {/* Owner Accent Bar when city is bought */}
          {ownerColor && renderOwnerAccentBar()}

          {/* Core Content Layout */}
          <div className="relative z-10 flex-1 flex flex-col justify-between items-center text-center w-full min-h-0 overflow-hidden px-0.5 pb-0.5">
            {/* City / Place Name */}
            {renderSpaceName()}

            {/* In-Grid Development: Built Houses (1-4) or Commercial Tower (5) */}
            {propertyState && propertyState.buildings > 0 && (
              <div className="mt-0.5 shrink-0 flex items-center justify-center z-10">
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

            {/* Blocked indicator tag for disqualified players (Requirement 8) */}
            {isBlocked && (
              <span className="text-[7px] sm:text-[7.5px] font-black text-white bg-zinc-800 border border-zinc-600 px-1.5 py-0.2 rounded-full leading-none mt-0.5 z-10 shadow-xs">
                BLOCKED
              </span>
            )}

            {/* Mortgaged indicator tag */}
            {propertyState?.isMortgaged && !isBlocked && (
              <span className="text-[7px] sm:text-[7.5px] font-black text-red-600 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 px-1 rounded-full leading-none mt-0.5 z-10">
                MORTGAGED
              </span>
            )}

            {/* Player Tokens landing on this grid */}
            {renderPlayerTokens()}
          </div>
        </div>
      )}
    </div>
  );
};
