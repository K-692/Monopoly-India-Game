import React from 'react';
import { BOARD_SPACES } from '@/domain/board-config';
import { GameState } from '@/domain/game-types';
import { BoardSpaceTile } from './BoardSpaceTile';
import { cn } from '@/lib/utils/cn';

interface GameBoardProps {
  gameState: GameState;
  selectedSpaceIndex: number | null;
  onSelectSpace: (index: number) => void;
  isRolling: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  selectedSpaceIndex,
  onSelectSpace,
  isRolling,
}) => {
  const activePlayer = gameState.players.find((p) => p.uid === gameState.currentPlayerUid);

  return (
    <div className="relative w-full aspect-square max-w-[720px] max-h-[720px] mx-auto p-1 sm:p-2 bg-indian-parchment-200 border-2 border-indian-parchment-400 rounded-xl shadow-board-elevation select-none">
      {/* 11x11 CSS Grid Layout */}
      <div
        className="w-full h-full grid grid-cols-11 grid-rows-11 gap-[1px] bg-indian-parchment-400"
        style={{
          gridTemplateColumns: 'repeat(11, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(11, minmax(0, 1fr))',
        }}
      >
        {/* Render 40 Board Spaces */}
        {BOARD_SPACES.map((space) => {
          const propState = gameState.properties[space.spaceIndex];
          const playersHere = gameState.players.filter((p) => p.position === space.spaceIndex);
          const isSelected = selectedSpaceIndex === space.spaceIndex;

          return (
            <BoardSpaceTile
              key={space.spaceIndex}
              space={space}
              propertyState={propState}
              playersHere={playersHere}
              isSelected={isSelected}
              onSelect={() => onSelectSpace(space.spaceIndex)}
            />
          );
        })}

        {/* Center Board Area (Rows 2 to 10, Cols 2 to 10) */}
        <div
          style={{
            gridRow: '2 / 11',
            gridColumn: '2 / 11',
          }}
          className="relative flex flex-col items-center justify-between p-3 sm:p-6 bg-[#FAF7F0] overflow-hidden"
        >
          {/* Subtle Indian Mandalas Background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
            <svg viewBox="0 0 400 400" className="w-[340px] h-[340px] text-indian-gold-600 animate-pulse-subtle">
              <circle cx="200" cy="200" r="180" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx="200" cy="200" r="140" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="200" cy="200" r="90" fill="none" stroke="currentColor" strokeWidth="2" />
              {Array.from({ length: 16 }).map((_, i) => (
                <path
                  key={i}
                  d="M200 200 L200 40 A160 160 0 0 1 230 43 Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.75"
                  transform={`rotate(${i * 22.5} 200 200)`}
                />
              ))}
            </svg>
          </div>

          {/* Top Center: Civic Fund Card Deck */}
          <div className="z-10 flex items-center justify-between w-full">
            <div className="flex items-center gap-2 bg-amber-50/90 border border-amber-300 rounded-lg p-2 shadow-sm">
              <div className="w-8 h-10 rounded border border-amber-400 bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-[8px] font-bold text-amber-900 shadow-xs">
                CIVIC
              </div>
              <div className="hidden sm:block text-left">
                <span className="text-[10px] font-bold text-amber-900 block leading-tight">Civic Fund</span>
                <span className="text-[8px] text-amber-700">सार्वजनिक कोष</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-orange-50/90 border border-orange-300 rounded-lg p-2 shadow-sm">
              <div className="hidden sm:block text-right">
                <span className="text-[10px] font-bold text-orange-900 block leading-tight">Market Buzz</span>
                <span className="text-[8px] text-orange-700">बाज़ार चर्चा</span>
              </div>
              <div className="w-8 h-10 rounded border border-orange-400 bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center text-[8px] font-bold text-orange-900 shadow-xs">
                BUZZ
              </div>
            </div>
          </div>

          {/* Centerpiece: Palace Brand Logo & Active Turn Banner */}
          <div className="z-10 text-center flex flex-col items-center justify-center my-auto">
            <h1 className="font-serif font-black text-xl sm:text-3xl text-indian-terracotta-600 tracking-wider">
              INDIAN MONOPOLY
            </h1>
            <p className="text-[10px] sm:text-xs text-indian-navy-700 font-semibold tracking-widest mt-0.5">
              भारतीय व्यापार बोर्ड गेम
            </p>

            {/* Active Turn Indicator */}
            {activePlayer && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-indian-parchment-300 shadow-sm animate-fade-in">
                <span
                  style={{ backgroundColor: activePlayer.colorToken }}
                  className="w-2.5 h-2.5 rounded-full animate-ping"
                />
                <span className="text-xs sm:text-sm font-bold text-indian-navy-900">
                  {activePlayer.displayName}'s Turn
                </span>
              </div>
            )}

            {/* Animated Dice Outcome */}
            {gameState.dice && (
              <div className="mt-3 flex items-center gap-2 animate-fade-in">
                <div
                  className={cn(
                    'w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-white border-2 border-indian-navy-800 shadow-md flex items-center justify-center text-base sm:text-xl font-black text-indian-navy-900 transition-transform',
                    isRolling && 'animate-spin'
                  )}
                >
                  {gameState.dice.first}
                </div>
                <div
                  className={cn(
                    'w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-white border-2 border-indian-navy-800 shadow-md flex items-center justify-center text-base sm:text-xl font-black text-indian-navy-900 transition-transform',
                    isRolling && 'animate-spin'
                  )}
                >
                  {gameState.dice.second}
                </div>
                {gameState.dice.isDouble && (
                  <span className="text-[10px] sm:text-xs font-bold text-indian-terracotta-600 bg-indian-terracotta-100 px-2 py-0.5 rounded-full">
                    DOUBLES!
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bottom Center Status Strip */}
          <div className="z-10 text-[9px] sm:text-[11px] text-indian-navy-700/70 font-medium">
            Turn #{gameState.turnNumber} • Phase: {gameState.phase}
          </div>
        </div>
      </div>
    </div>
  );
};
