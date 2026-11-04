import React from 'react';
import { BoardSpaceDefinition, PlayerState, PropertyState } from '@/domain/game-types';
import { getSpaceGridCoord } from './board-layout-utils';
import { ArrowLeft, Zap, Droplets, ShieldAlert, Gift, Flame } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Smooth color ramp from Orange (lowest deed price ₹600) to Green (highest deed price ₹4,000)
export const getCityPriceColor = (price: number): string => {
  if (price <= 600) return '#EA580C'; // Jaipur, Jodhpur (Deep Orange)
  if (price <= 800) return '#F97316'; // Udaipur (Vivid Orange)
  if (price <= 1000) return '#FB923C'; // Agra, Lucknow (Tangerine)
  if (price <= 1200) return '#F59E0B'; // Varanasi (Golden Amber)
  if (price <= 1400) return '#EAB308'; // Indore, Bhopal (Warm Gold)
  if (price <= 1600) return '#FACC15'; // Surat (Bright Gold)
  if (price <= 1800) return '#D9E74C'; // Visakhapatnam, Kochi (Citron)
  if (price <= 2000) return '#A3E635'; // Goa (Chartreuse Lime)
  if (price <= 2200) return '#84CC16'; // Ahmedabad, Pune (Bright Lime)
  if (price <= 2400) return '#65A30D'; // Hyderabad (Olive Green)
  if (price <= 2600) return '#22C55E'; // Bengaluru, Chennai (Vibrant Emerald)
  if (price <= 2800) return '#16A34A'; // Kolkata (Medium Green)
  if (price <= 3000) return '#15803D'; // Chandigarh (Forest Green)
  if (price <= 3200) return '#166534'; // Gurugram, Noida (Deep Pine)
  if (price <= 3500) return '#0F5132'; // Navi Mumbai (Dark Emerald)
  if (price <= 3800) return '#064E3B'; // New Delhi (Royal Forest)
  return '#047857'; // Mumbai (₹4,000 Supreme Green)
};

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
  const isCity = space.type === 'PROPERTY';
  const isJail = space.spaceIndex === 10;
  const isStart = space.spaceIndex === 0;
  const isNonCity = !isCity && !isJail && !isStart;

  // Find owner player
  const owner = propertyState?.ownerUid
    ? allPlayers.find((p) => p.uid === propertyState.ownerUid)
    : null;
  const ownerColor = owner?.colorToken;

  // City price shade
  const cityPrice = 'price' in space ? (space as { price: number }).price : 0;
  const priceColor = isCity ? getCityPriceColor(cityPrice) : null;

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
      ? 'text-[9px] sm:text-[10px] md:text-[11px]'
      : nameLength > 8
        ? 'text-[10px] sm:text-[11px] md:text-[12px]'
        : 'text-[11px] sm:text-[12px] md:text-[13.5px]';

  // Dynamic Tile Styling:
  // 1. Jail: Red glowing border + vertical black/white jail bars
  // 2. Non-city grids: Glowing orange border + crisp white fill
  // 3. City grids: Tinted with shade from Orange to Green based on price (or owner player color when purchased)
  const tileStyle: React.CSSProperties = {
    gridRow: coord.row,
    gridColumn: coord.col,
    ...(ownerColor
      ? {
          borderColor: ownerColor,
          backgroundColor: `${ownerColor}24`, // Color grid with player color when bought
        }
      : isCity && priceColor
        ? {
            borderColor: priceColor,
            backgroundColor: `${priceColor}12`, // Subtle shade from orange to green based on city price
          }
        : {}),
  };

  // Dedicated Player Tokens Row Component
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

  // Owner Accent Bar (displayed along top edge of owned property)
  const renderOwnerAccentBar = () => {
    if (!ownerColor) return null;
    return (
      <div
        style={{ backgroundColor: ownerColor }}
        className="w-full h-2 shrink-0 flex items-center justify-center"
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
        'relative flex flex-col justify-between border select-none cursor-pointer transition-all duration-200 overflow-hidden',
        // Non-city grids: Glowing Orange colour effect with white filled color
        isNonCity && 'bg-white dark:bg-white text-indian-navy-950 border-2 border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.65)] ring-1 ring-orange-400/50',
        // Jail grid: Glow red with authentic prison styling
        isJail && 'border-2 border-red-600 shadow-[0_0_18px_rgba(239,68,68,0.85)] ring-2 ring-red-500/50 bg-white dark:bg-zinc-900',
        // City grid styling
        isCity && !ownerColor && 'bg-white dark:bg-indian-navy-900 text-indian-navy-950 dark:text-white border-2',
        isCity && ownerColor && 'border-2',
        // Corners fallback
        isStart && 'bg-indian-parchment-100 dark:bg-indian-navy-950 border-indian-parchment-400 text-indian-navy-950 dark:text-white',
        isSelected && 'ring-2 ring-indian-terracotta-500 bg-amber-50 dark:bg-indian-navy-800 z-20',
        isHighlighted && 'ring-4 ring-amber-400 dark:ring-amber-300 scale-105 z-30 shadow-[0_0_20px_rgba(251,191,36,0.9)] animate-pulse',
        propertyState?.isMortgaged && 'opacity-65 bg-gray-100/90 dark:bg-gray-900/80'
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
            {/* START Corner: User requirement: Remove Rs 2000 from start grid */}
            {space.spaceIndex === 0 && (
              <div className="flex flex-col items-center justify-center text-indian-terracotta-600 gap-0.5">
                <span className="font-serif text-xs sm:text-sm md:text-base font-black tracking-wider whitespace-nowrap">START</span>
                <ArrowLeft className="w-3.5 h-3.5 text-indian-terracotta-500 animate-pulse-subtle" />
              </div>
            )}

            {/* JAIL Corner: User requirement: Glow red with black & white jail bars */}
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
        <div className="relative w-full h-full flex flex-col justify-between items-center text-center p-0.5 overflow-hidden select-none">
          {/* City Top Price Shade Bar (Orange to Green based on lowest to highest city price) */}
          {isCity && priceColor && !ownerColor && (
            <div
              style={{ backgroundColor: priceColor }}
              className="w-full h-1.5 sm:h-2 shrink-0 shadow-2xs"
            />
          )}

          {/* Owner Accent Bar when city is bought */}
          {ownerColor && renderOwnerAccentBar()}

          {/* Core Content Layout */}
          <div className="relative z-10 flex-1 flex flex-col justify-between items-center text-center w-full min-h-0 overflow-hidden px-0.5 py-0.5">
            {/* City / Place Name (Large, Bold, Fully Legible) */}
            <span
              title={space.name}
              className={cn(
                'font-black leading-tight text-center w-full whitespace-nowrap overflow-hidden text-ellipsis tracking-tight px-0.5 text-indian-navy-950 dark:text-white drop-shadow-2xs',
                isNonCity && 'text-indian-navy-950 font-black',
                nameFontSizeClass
              )}
            >
              {space.name}
            </span>

            {/* Non-City High-Opacity (Less Transparent) Crisp Vector Illustrations */}
            {isNonCity && (
              <div className="my-auto flex items-center justify-center opacity-90 transition-opacity">
                {isRailway && <RailwayImage className="w-5 h-5 sm:w-6 sm:h-6" />}
                {isAirport && <AirportImage className="w-5 h-5 sm:w-6 sm:h-6" />}
                {!isRailway && !isAirport && space.type === 'UTILITY' && (
                  space.id.includes('power') ? (
                    <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 fill-amber-400" />
                  ) : (
                    <Droplets className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 fill-blue-400" />
                  )
                )}
                {!isRailway && !isAirport && space.type === 'TAX' && (
                  <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 fill-red-100" />
                )}
                {!isRailway && !isAirport && space.type === 'CARD' && (
                  space.deck === 'CIVIC' ? (
                    <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 fill-amber-300" />
                  ) : (
                    <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 fill-orange-400" />
                  )
                )}
              </div>
            )}

            {/* In-Grid Development: Built Houses (1-4) or Commercial Tower (5) */}
            {propertyState && propertyState.buildings > 0 && (
              <div className="mt-0.5 shrink-0 flex items-center justify-center">
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
              <span className="text-[7px] sm:text-[7.5px] font-black text-red-600 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 px-1 rounded-full leading-none mt-0.5">
                MORTGAGED
              </span>
            )}

            {/* Player Tokens landing on this grid */}
            {playersHere.length > 0 && (
              <div className="mt-auto shrink-0 flex items-center justify-center gap-1">
                {playersHere.map((p) => (
                  <div
                    key={p.uid}
                    title={p.displayName}
                    style={{ backgroundColor: p.colorToken }}
                    className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full border-2 border-white shadow-token-glow flex items-center justify-center text-[9.5px] sm:text-[10.5px] text-white font-black animate-pulse shrink-0"
                  >
                    {p.displayName.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
