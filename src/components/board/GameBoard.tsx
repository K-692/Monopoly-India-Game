import React, { useState } from 'react';
import { BOARD_SPACES, CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS } from '@/domain/board-config';
import { CardAction, GameState } from '@/domain/game-types';
import { BoardSpaceTile } from './BoardSpaceTile';
import { Dices, Clock, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface GameBoardProps {
  gameState: GameState;
  selectedSpaceIndex: number | null;
  onSelectSpace: (index: number) => void;
  isRolling: boolean;
  onRollDice?: () => void;
  isMyTurn?: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  selectedSpaceIndex,
  onSelectSpace,
  isRolling,
  onRollDice,
  isMyTurn = true,
}) => {
  const activePlayer = gameState.players.find((p) => p.uid === gameState.currentPlayerUid);
  const [inspectedCard, setInspectedCard] = useState<CardAction | null>(null);

  // Turn timer percentage
  const maxTimer = gameState.turnTimeLimit || 30;
  const currentTimer = gameState.turnTimeRemaining ?? maxTimer;
  const timerPercentage = Math.max(0, Math.min(100, (currentTimer / maxTimer) * 100));

  const handleOpenCivic = () => {
    const card = CIVIC_FUND_CARDS[gameState.turnNumber % CIVIC_FUND_CARDS.length];
    setInspectedCard(card);
  };

  const handleOpenMarket = () => {
    const card = MARKET_BUZZ_CARDS[gameState.turnNumber % MARKET_BUZZ_CARDS.length];
    setInspectedCard(card);
  };

  // Dice dot positions (1 to 6)
  const renderDiceFace = (val: number) => {
    const dots: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    const activeDots = dots[val] || [4];

    return (
      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-white to-amber-50 border-2 border-indian-navy-800 rounded-xl shadow-md grid grid-cols-3 grid-rows-3 p-1.5 gap-0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {activeDots.includes(i) && (
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-indian-navy-900 shadow-xs" />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative w-full aspect-square max-w-[min(72vh,72vw,680px)] mx-auto p-1 bg-indian-parchment-200 border-2 border-indian-parchment-400 rounded-xl shadow-board-elevation select-none shrink-0">
      {/* 11x11 Grid of Spaces */}
      <div
        className="w-full h-full grid grid-cols-11 grid-rows-11 gap-[1px] bg-indian-parchment-400"
        style={{
          gridTemplateColumns: 'repeat(11, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(11, minmax(0, 1fr))',
        }}
      >
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
          className="relative flex flex-col items-center justify-between p-2 sm:p-4 bg-[#FAF7F0] overflow-hidden"
        >
          {/* Subtle Mandala Background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
            <svg viewBox="0 0 400 400" className="w-[300px] h-[300px] text-indian-gold-600">
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

          {/* Top of Center: Turn Timer & Active Turn Header */}
          <div className="z-10 w-full flex flex-col items-center">
            {/* Player Turn & Timer Strip */}
            <div className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded-lg bg-white/90 border border-indian-parchment-300 shadow-xs text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  style={{ backgroundColor: activePlayer?.colorToken || '#C85A32' }}
                  className="w-2.5 h-2.5 rounded-full shrink-0 animate-ping"
                />
                <span className="font-bold text-indian-navy-900 truncate">
                  {activePlayer?.displayName || 'Player'}'s Turn
                </span>
              </div>

              {/* Countdown Timer with visual indicator */}
              <div className="flex items-center gap-1 shrink-0 font-mono font-bold text-xs">
                <Clock className={cn("w-3.5 h-3.5", currentTimer <= 10 ? "text-red-500 animate-pulse" : "text-indian-navy-700")} />
                <span className={cn(currentTimer <= 10 ? "text-red-600" : "text-indian-navy-900")}>
                  {currentTimer}s
                </span>
              </div>
            </div>

            {/* Timer Progress Bar */}
            <div className="w-full h-1 bg-indian-parchment-300 rounded-full mt-1 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-1000",
                  currentTimer <= 10 ? "bg-red-500" : currentTimer <= 20 ? "bg-amber-500" : "bg-emerald-500"
                )}
                style={{ width: `${timerPercentage}%` }}
              />
            </div>
          </div>

          {/* Centerpiece: THE 2 BUZZ CARDS ALWAYS DISPLAYED INSIDE BOARD */}
          <div className="z-10 flex items-center justify-center gap-4 sm:gap-8 my-auto w-full">
            {/* Card 1: Civic Fund (Terracotta Card, angled -12deg) */}
            <button
              type="button"
              onClick={handleOpenCivic}
              title="Click to view Civic Fund deck"
              className="group relative w-16 h-22 sm:w-20 sm:h-28 rounded-xl bg-gradient-to-br from-indian-terracotta-500 to-indian-terracotta-700 p-1.5 text-white shadow-lg border-2 border-amber-300/80 -rotate-12 hover:rotate-0 hover:scale-110 transition-all duration-200 cursor-pointer flex flex-col justify-between items-center text-center"
            >
              <div className="w-full flex justify-between items-center text-[7px] text-amber-200 uppercase font-bold tracking-widest">
                <span>CIVIC</span>
                <Sparkles className="w-2.5 h-2.5 text-amber-300" />
              </div>
              <div className="font-serif font-black text-xs sm:text-sm tracking-widest text-amber-100">
                CIVIC<br />FUND
              </div>
              <div className="text-[7px] text-amber-200/90 font-medium">सार्वजनिक कोष</div>
            </button>

            {/* In-Board Dice Roll Arena */}
            <div className="flex flex-col items-center justify-center gap-1.5 z-20">
              {/* Interactive Dice */}
              <div
                onClick={isMyTurn && gameState.phase === 'AWAIT_ROLL' && !isRolling ? onRollDice : undefined}
                className={cn(
                  "flex items-center gap-2 transition-all p-1.5 rounded-2xl",
                  isMyTurn && gameState.phase === 'AWAIT_ROLL' && !isRolling
                    ? "cursor-pointer hover:scale-105 active:scale-95 ring-2 ring-indian-terracotta-400 bg-amber-50/80"
                    : ""
                )}
              >
                {gameState.dice ? (
                  <>
                    <div className={cn(isRolling && "animate-spin")}>
                      {renderDiceFace(gameState.dice.first)}
                    </div>
                    <div className={cn(isRolling && "animate-spin")}>
                      {renderDiceFace(gameState.dice.second)}
                    </div>
                  </>
                ) : (
                  <>
                    {renderDiceFace(3)}
                    {renderDiceFace(4)}
                  </>
                )}
              </div>

              {/* IN-BOARD ROLL BUTTON */}
              {isMyTurn && gameState.phase === 'AWAIT_ROLL' ? (
                <button
                  type="button"
                  disabled={isRolling}
                  onClick={onRollDice}
                  className="px-4 py-1.5 rounded-full font-bold text-xs text-white bg-gradient-to-r from-indian-terracotta-500 to-indian-terracotta-600 hover:from-indian-terracotta-600 hover:to-indian-terracotta-700 shadow-md active:scale-95 transition-all flex items-center gap-1.5 border border-indian-terracotta-400 animate-pulse-subtle"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>{isRolling ? 'Rolling...' : 'ROLL DICE'}</span>
                </button>
              ) : gameState.dice?.isDouble ? (
                <span className="text-[10px] font-bold text-indian-terracotta-600 bg-indian-terracotta-100 px-2.5 py-0.5 rounded-full">
                  DOUBLES!
                </span>
              ) : (
                <span className="text-[9px] font-semibold text-gray-500">
                  {activePlayer?.displayName} rolling...
                </span>
              )}
            </div>

            {/* Card 2: Market Buzz (Teal/Jade Card, angled +12deg) */}
            <button
              type="button"
              onClick={handleOpenMarket}
              title="Click to view Market Buzz deck"
              className="group relative w-16 h-22 sm:w-20 sm:h-28 rounded-xl bg-gradient-to-br from-teal-700 to-emerald-800 p-1.5 text-white shadow-lg border-2 border-emerald-300/80 rotate-12 hover:rotate-0 hover:scale-110 transition-all duration-200 cursor-pointer flex flex-col justify-between items-center text-center"
            >
              <div className="w-full flex justify-between items-center text-[7px] text-teal-200 uppercase font-bold tracking-widest">
                <span>BUZZ</span>
                <Sparkles className="w-2.5 h-2.5 text-emerald-300" />
              </div>
              <div className="font-serif font-black text-xs sm:text-sm tracking-widest text-emerald-100">
                MARKET<br />BUZZ
              </div>
              <div className="text-[7px] text-teal-200/90 font-medium">बाज़ार चर्चा</div>
            </button>
          </div>

          {/* Bottom Center: Game Status Banner */}
          <div className="z-10 text-[9px] sm:text-[10px] text-indian-navy-800 font-bold bg-white/70 px-2 py-0.5 rounded-full border border-indian-parchment-300">
            Turn #{gameState.turnNumber} • {gameState.phase}
          </div>
        </div>
      </div>

      {/* Card Inspection Modal */}
      {inspectedCard && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-sm w-full bg-white dark:bg-indian-navy-900 border-2 border-indian-terracotta-500 rounded-2xl p-5 shadow-2xl relative">
            <button
              onClick={() => setInspectedCard(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-bold text-white",
                inspectedCard.deck === 'CIVIC' ? "bg-indian-terracotta-500" : "bg-emerald-600"
              )}>
                {inspectedCard.deck === 'CIVIC' ? 'Civic Fund Card' : 'Market Buzz Card'}
              </span>
            </div>

            <h3 className="font-serif font-black text-lg text-indian-navy-900 dark:text-white mb-2">
              {inspectedCard.title}
            </h3>

            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed mb-4 p-3 bg-indian-parchment-100 dark:bg-indian-navy-800 rounded-xl border border-indian-parchment-300">
              {inspectedCard.description}
            </p>

            <button
              type="button"
              onClick={() => setInspectedCard(null)}
              className="w-full py-2 bg-indian-terracotta-500 text-white rounded-lg font-bold text-xs hover:bg-indian-terracotta-600 transition-colors"
            >
              Close Card
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
