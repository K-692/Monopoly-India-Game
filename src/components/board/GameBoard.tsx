import React, { useState, useEffect } from 'react';
import { BOARD_SPACES, CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS } from '@/domain/board-config';
import { CardAction, GameEvent, GameState, WalkingAnimationState } from '@/domain/game-types';
import { BoardSpaceTile } from './BoardSpaceTile';
import { TurnStepAcknowledgment } from '@/components/feedback/TurnStepAcknowledgment';
import { Dices, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface GameBoardProps {
  gameState: GameState;
  selectedSpaceIndex: number | null;
  onSelectSpace: (index: number) => void;
  isRolling: boolean;
  onRollDice?: () => void;
  isMyTurn?: boolean;
  lastEvent?: GameEvent;
  walkingAnimation?: WalkingAnimationState | null;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  selectedSpaceIndex,
  onSelectSpace,
  isRolling,
  onRollDice,
  isMyTurn = true,
  lastEvent,
  walkingAnimation,
}) => {
  const activePlayer = gameState.players.find((p) => p.uid === gameState.currentPlayerUid);
  const [inspectedCard, setInspectedCard] = useState<CardAction | null>(null);

  // Active or top Civic Fund and Market Buzz cards to display content face-up
  const activeCivicCard = CIVIC_FUND_CARDS[gameState.turnNumber % CIVIC_FUND_CARDS.length];
  const activeMarketCard = MARKET_BUZZ_CARDS[gameState.turnNumber % MARKET_BUZZ_CARDS.length];

  // Dynamic rapid tumbling dice faces during roll animation
  const [displayDice, setDisplayDice] = useState<[number, number]>([
    gameState.dice?.first ?? 3,
    gameState.dice?.second ?? 4,
  ]);

  useEffect(() => {
    if (isRolling) {
      const interval = setInterval(() => {
        setDisplayDice([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ]);
      }, 70);
      return () => clearInterval(interval);
    } else if (gameState.dice) {
      setDisplayDice([gameState.dice.first, gameState.dice.second]);
    }
  }, [isRolling, gameState.dice]);

  // Dice dot positions (1 to 6)
  const renderDiceFace = (val: number) => {
    const safeVal = val >= 1 && val <= 6 ? val : 3;
    const dots: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    const activeDots = dots[safeVal] || [4];

    return (
      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white border-2 border-gray-950 rounded-xl shadow-lg grid grid-cols-3 grid-rows-3 p-1.5 sm:p-2 gap-1 transform-gpu">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {activeDots.includes(i) && (
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-black shadow-xs" />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative h-full max-h-full aspect-square w-auto max-w-full mx-auto p-1 bg-indian-parchment-200 border-2 border-indian-parchment-400 rounded-xl shadow-board-elevation select-none shrink-0 flex flex-col justify-center">
      {/* 11x11 Grid with Widened Walk Lane (1.5fr for outer walk lanes) */}
      <div
        className="w-full h-full grid gap-[1px] bg-indian-parchment-400"
        style={{
          gridTemplateColumns: '1.5fr repeat(9, 1fr) 1.5fr',
          gridTemplateRows: '1.5fr repeat(9, 1fr) 1.5fr',
        }}
      >
        {BOARD_SPACES.map((space) => {
          const propState = gameState.properties[space.spaceIndex];

          // Compute effective player positions factoring in step-by-step walking animation
          const playersHere = gameState.players.filter((p) => {
            const effectivePos =
              walkingAnimation && walkingAnimation.uid === p.uid
                ? walkingAnimation.currentPos
                : p.position;
            return effectivePos === space.spaceIndex;
          });

          const isSelected = selectedSpaceIndex === space.spaceIndex;

          return (
            <BoardSpaceTile
              key={space.spaceIndex}
              space={space}
              propertyState={propState}
              playersHere={playersHere}
              allPlayers={gameState.players}
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
          className="relative flex flex-col items-center justify-between p-2 sm:p-3 bg-[#FAF7F0] dark:bg-indian-navy-950 overflow-hidden"
        >
          {/* Subtle Mandala Background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            <svg viewBox="0 0 400 400" className="w-[360px] h-[360px] text-indian-gold-600">
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

          {/* Top of Center: Step-by-Step Turn Acknowledgment */}
          <div className="z-10 w-full max-w-sm px-1">
            <TurnStepAcknowledgment gameState={gameState} lastEvent={lastEvent} />
          </div>

          {/* Centerpiece: THE 2 BUZZ CARDS WITH VISIBLE CONTENTS & HIGH-VISIBILITY IN-BOARD DICE */}
          <div className="z-10 flex items-center justify-between gap-1 sm:gap-3 my-auto w-full px-0.5 sm:px-2">
            {/* Card 1: Civic Fund (Terracotta Card with visible contents) */}
            <div
              onClick={() => setInspectedCard(activeCivicCard)}
              title="Click to inspect Civic Fund details"
              className="relative w-22 sm:w-32 md:w-36 h-28 sm:h-38 md:h-44 rounded-lg sm:rounded-xl bg-gradient-to-br from-indian-terracotta-500 via-indian-terracotta-600 to-indian-terracotta-800 p-1 sm:p-2 text-white shadow-md border sm:border-2 border-amber-300/80 cursor-pointer flex flex-col justify-between hover:scale-105 transition-transform shrink-0"
            >
              <div className="flex items-center justify-between border-b border-amber-300/40 pb-0.5 sm:pb-1 text-[7px] sm:text-[9px] text-amber-200 uppercase font-black tracking-wider">
                <span>CIVIC FUND</span>
                <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-amber-300" />
              </div>

              {/* Card Visible Content */}
              <div className="my-auto text-left space-y-0.5 sm:space-y-1">
                <h4 className="font-serif font-black text-[9px] sm:text-[11px] md:text-xs text-amber-100 leading-tight">
                  {activeCivicCard.title}
                </h4>
                <p className="text-[7px] sm:text-[9px] md:text-[10px] text-amber-100/90 leading-tight line-clamp-2 sm:line-clamp-3">
                  {activeCivicCard.description}
                </p>
                {activeCivicCard.amount && (
                  <span className="inline-block mt-0.5 px-1 py-0.2 rounded-full text-[7px] sm:text-[8px] font-bold bg-amber-400 text-indian-navy-950">
                    ₹{activeCivicCard.amount.toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              <div className="text-[7px] sm:text-[8px] text-amber-200/90 font-medium text-center border-t border-amber-300/30 pt-0.5">
                सार्वजनिक कोष
              </div>
            </div>

            {/* In-Board Dice Roll Arena: Bold, Highly Visible Dice */}
            <div className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 z-20 shrink-0">
              {/* Interactive 3D Tumbling Dice with Bold Black Dots */}
              <div
                onClick={isMyTurn && gameState.phase === 'AWAIT_ROLL' && !isRolling && !walkingAnimation ? onRollDice : undefined}
                className={cn(
                  "flex items-center gap-2 sm:gap-3 transition-all p-2 rounded-2xl",
                  isMyTurn && gameState.phase === 'AWAIT_ROLL' && !isRolling && !walkingAnimation
                    ? "cursor-pointer hover:scale-105 active:scale-95 ring-2 ring-indian-terracotta-400 bg-amber-50/90 shadow-md"
                    : ""
                )}
              >
                <div className={cn(isRolling && "animate-dice-tumble")}>
                  {renderDiceFace(displayDice[0])}
                </div>
                <div className={cn(isRolling && "animate-dice-tumble")}>
                  {renderDiceFace(displayDice[1])}
                </div>
              </div>

              {/* Dice Outcome Total Indicator */}
              {gameState.dice && !isRolling && (
                <div className="text-[10px] sm:text-xs font-black font-mono text-indian-navy-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full shadow-2xs">
                  🎲 Rolled: {gameState.dice.first + gameState.dice.second} ({gameState.dice.first}+{gameState.dice.second})
                </div>
              )}

              {/* In-Board Dice Action Button */}
              {isMyTurn && gameState.phase === 'AWAIT_ROLL' && !walkingAnimation ? (
                <button
                  type="button"
                  disabled={isRolling}
                  onClick={onRollDice}
                  className="px-4 py-1.5 rounded-full font-bold text-xs text-white bg-gradient-to-r from-indian-terracotta-500 to-indian-terracotta-600 hover:from-indian-terracotta-600 hover:to-indian-terracotta-700 shadow-md active:scale-95 transition-all flex items-center gap-1.5 border border-indian-terracotta-400 animate-pulse-subtle cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>{isRolling ? 'Rolling...' : 'ROLL DICE'}</span>
                </button>
              ) : walkingAnimation ? (
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 animate-pulse">
                  🚶 Stepping along lane...
                </span>
              ) : gameState.dice?.isDouble ? (
                <span className="text-[10px] font-bold text-indian-terracotta-600 bg-indian-terracotta-100 px-2.5 py-0.5 rounded-full border border-indian-terracotta-300">
                  🎉 DOUBLES!
                </span>
              ) : (
                <span className="text-[9px] font-semibold text-gray-500 bg-white/80 px-2 py-0.5 rounded-full border border-indian-parchment-300">
                  {activePlayer?.displayName || 'Player'}
                </span>
              )}
            </div>

            {/* Card 2: Market Buzz (Teal Card with visible contents) */}
            <div
              onClick={() => setInspectedCard(activeMarketCard)}
              title="Click to inspect Market Buzz details"
              className="relative w-22 sm:w-32 md:w-36 h-28 sm:h-38 md:h-44 rounded-lg sm:rounded-xl bg-gradient-to-br from-teal-700 via-emerald-800 to-teal-950 p-1 sm:p-2 text-white shadow-md border sm:border-2 border-emerald-300/80 cursor-pointer flex flex-col justify-between hover:scale-105 transition-transform shrink-0"
            >
              <div className="flex items-center justify-between border-b border-emerald-300/40 pb-0.5 sm:pb-1 text-[7px] sm:text-[9px] text-teal-200 uppercase font-black tracking-wider">
                <span>MARKET BUZZ</span>
                <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-emerald-300" />
              </div>

              {/* Card Visible Content */}
              <div className="my-auto text-left space-y-0.5 sm:space-y-1">
                <h4 className="font-serif font-black text-[9px] sm:text-[11px] md:text-xs text-emerald-100 leading-tight">
                  {activeMarketCard.title}
                </h4>
                <p className="text-[7px] sm:text-[9px] md:text-[10px] text-emerald-100/90 leading-tight line-clamp-2 sm:line-clamp-3">
                  {activeMarketCard.description}
                </p>
                {activeMarketCard.amount && (
                  <span className="inline-block mt-0.5 px-1 py-0.2 rounded-full text-[7px] sm:text-[8px] font-bold bg-emerald-400 text-indian-navy-950">
                    ₹{activeMarketCard.amount.toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              <div className="text-[7px] sm:text-[8px] text-teal-200/90 font-medium text-center border-t border-emerald-300/30 pt-0.5">
                बाज़ार चर्चा
              </div>
            </div>
          </div>

          {/* Bottom Center: Game Status Banner */}
          <div className="z-10 text-[9px] sm:text-[10px] text-indian-navy-800 dark:text-indian-parchment-200 font-bold bg-white/80 dark:bg-indian-navy-900/80 px-3 py-0.5 rounded-full border border-indian-parchment-300 shadow-2xs">
            Turn #{gameState.turnNumber} • Phase: {gameState.phase}
          </div>
        </div>
      </div>

      {/* Card Inspection Modal */}
      {inspectedCard && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-xs w-full bg-white dark:bg-indian-navy-900 border-2 border-indian-gold-500 rounded-2xl p-5 shadow-2xl relative text-center">
            <button
              onClick={() => setInspectedCard(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>

            <span
              className={cn(
                "inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-2",
                inspectedCard.deck === 'CIVIC' ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"
              )}
            >
              {inspectedCard.deck === 'CIVIC' ? 'Civic Fund Card' : 'Market Buzz Card'}
            </span>

            <h3 className="font-serif font-black text-base text-indian-navy-900 dark:text-white mb-2">
              {inspectedCard.title}
            </h3>

            <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
              {inspectedCard.description}
            </p>

            <button
              onClick={() => setInspectedCard(null)}
              className="w-full py-2 rounded-lg font-bold text-xs bg-indian-terracotta-500 text-white hover:bg-indian-terracotta-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
