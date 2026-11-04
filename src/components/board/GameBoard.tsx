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

  // Determine which space should have the glowing / zoomed in state-update effect
  const highlightedSpaceIndex =
    walkingAnimation ? walkingAnimation.currentPos : (activePlayer?.position ?? null);

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
      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white border-2 border-gray-950 rounded-xl shadow-lg grid grid-cols-3 grid-rows-3 p-1 sm:p-1.5 gap-0.5 transform-gpu">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {activeDots.includes(i) && (
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-black shadow-xs" />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full max-h-full mx-auto p-0.5 sm:p-1 bg-indian-parchment-200 border-2 border-indian-parchment-400 rounded-xl shadow-board-elevation select-none flex flex-col justify-center overflow-hidden">
      {/* 11x11 Grid with Compact Extreme Corners and Spacious City Grids */}
      <div
        className="w-full h-full grid gap-[1px] bg-indian-parchment-400 rounded-lg overflow-hidden"
        style={{
          gridTemplateColumns: '1.15fr repeat(9, 1fr) 1.15fr',
          gridTemplateRows: '1.1fr repeat(9, 1fr) 1.1fr',
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

          const isHighlighted = highlightedSpaceIndex === space.spaceIndex;

          return (
            <BoardSpaceTile
              key={space.spaceIndex}
              space={space}
              propertyState={propState}
              playersHere={playersHere}
              allPlayers={gameState.players}
              isSelected={selectedSpaceIndex === space.spaceIndex}
              isHighlighted={isHighlighted}
              onSelect={() => onSelectSpace(space.spaceIndex)}
            />
          );
        })}

        {/* Center Area: Persistent Face-up Cards, Turn Acknowledgment & 3D Tumbling Dice Roll Arena */}
        <div
          className="relative flex flex-col items-center justify-between p-1.5 sm:p-3 bg-gradient-to-br from-indian-parchment-100/95 via-white/95 to-amber-50/90 dark:from-indian-navy-950/95 dark:to-indian-navy-900/95 rounded-lg border border-indian-parchment-300 dark:border-indian-navy-700 shadow-inner overflow-hidden"
          style={{
            gridColumn: '2 / 11',
            gridRow: '2 / 11',
          }}
        >
          {/* Subtle Heritage Geometric Watermark Background */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none flex items-center justify-center">
            <div className="w-80 h-80 rounded-full border-[12px] border-indian-navy-900 dark:border-white border-dashed animate-spin-very-slow" />
          </div>

          {/* Top Center: Turn Step Acknowledgment Banner */}
          <div className="w-full max-w-sm z-10">
            <TurnStepAcknowledgment
              gameState={gameState}
              lastEvent={lastEvent}
            />
          </div>

          {/* Middle Row: Civic Fund Card, 3D Dice Rolling Arena, and Market Buzz Card */}
          <div className="w-full flex items-center justify-around gap-1 sm:gap-2 md:gap-3 my-auto z-10 px-1 sm:px-2">
            {/* Card 1: Civic Fund (Terracotta Card with written contents) */}
            <div
              onClick={() => setInspectedCard(activeCivicCard)}
              title="Click to inspect Civic Fund details"
              className="relative w-24 sm:w-28 md:w-36 min-h-[96px] sm:min-h-[110px] md:min-h-[124px] rounded-xl bg-gradient-to-br from-indian-terracotta-700 via-indian-terracotta-800 to-amber-950 p-2 text-white shadow-md border border-amber-300/80 cursor-pointer flex flex-col justify-between hover:scale-105 transition-transform shrink-0"
            >
              <div className="flex items-center justify-between border-b border-amber-300/40 pb-0.5 sm:pb-1 text-[7.5px] sm:text-[8.5px] text-amber-200 uppercase font-black tracking-wider">
                <span>CIVIC FUND</span>
                <Sparkles className="w-2.5 h-2.5 text-amber-300" />
              </div>

              {/* Card Written Content */}
              <div className="my-auto text-left space-y-0.5 py-0.5">
                <h4 className="font-serif font-black text-[9px] sm:text-[10px] md:text-[11px] text-amber-100 leading-tight">
                  {activeCivicCard.title}
                </h4>
                <p className="text-[7.5px] sm:text-[8px] md:text-[8.5px] text-amber-100/90 leading-tight">
                  {activeCivicCard.description}
                </p>
                {activeCivicCard.amount && (
                  <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded-full text-[7px] sm:text-[7.5px] font-black bg-amber-300 text-indian-navy-950">
                    ₹{activeCivicCard.amount.toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              <div className="text-[6.5px] sm:text-[7.5px] text-amber-200/90 font-bold text-center border-t border-amber-300/30 pt-0.5">
                COMMUNITY TREASURY
              </div>
            </div>

            {/* In-Board Dice Roll Arena: Bold, Highly Visible Dice at Center */}
            <div className="flex flex-col items-center justify-center gap-1 sm:gap-1.5 z-20 shrink-0">
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
                <div className="text-[10px] sm:text-xs font-black font-mono text-indian-navy-950 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full shadow-2xs">
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

            {/* Card 2: Market Buzz (Teal Card with written contents) */}
            <div
              onClick={() => setInspectedCard(activeMarketCard)}
              title="Click to inspect Market Buzz details"
              className="relative w-24 sm:w-28 md:w-36 min-h-[96px] sm:min-h-[110px] md:min-h-[124px] rounded-xl bg-gradient-to-br from-teal-800 via-emerald-900 to-teal-950 p-2 text-white shadow-md border border-emerald-300/80 cursor-pointer flex flex-col justify-between hover:scale-105 transition-transform shrink-0"
            >
              <div className="flex items-center justify-between border-b border-emerald-300/40 pb-0.5 sm:pb-1 text-[7.5px] sm:text-[8.5px] text-teal-200 uppercase font-black tracking-wider">
                <span>MARKET BUZZ</span>
                <Sparkles className="w-2.5 h-2.5 text-emerald-300" />
              </div>

              {/* Card Written Content */}
              <div className="my-auto text-left space-y-0.5 py-0.5">
                <h4 className="font-serif font-black text-[9px] sm:text-[10px] md:text-[11px] text-emerald-100 leading-tight">
                  {activeMarketCard.title}
                </h4>
                <p className="text-[7.5px] sm:text-[8px] md:text-[8.5px] text-emerald-100/90 leading-tight">
                  {activeMarketCard.description}
                </p>
                {activeMarketCard.amount && (
                  <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded-full text-[7px] sm:text-[7.5px] font-black bg-emerald-400 text-indian-navy-950">
                    ₹{activeMarketCard.amount.toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              <div className="text-[6.5px] sm:text-[7.5px] text-teal-200/90 font-bold text-center border-t border-emerald-300/30 pt-0.5">
                FORTUNE & CHANCE
              </div>
            </div>
          </div>

          {/* Bottom Center: Game Status Banner */}
          <div className="z-10 text-[9px] sm:text-[10px] text-indian-navy-800 dark:text-indian-parchment-200 font-bold bg-white/80 dark:bg-indian-navy-900/80 px-3 py-0.5 rounded-full border border-indian-parchment-300 shadow-2xs">
            Turn #{gameState.turnNumber} • Phase: {gameState.phase}
          </div>
        </div>
      </div>

      {/* Card Inspection Modal if clicked */}
      {inspectedCard && (
        <div
          onClick={() => setInspectedCard(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full max-w-sm rounded-2xl p-5 text-white shadow-2xl border-2 space-y-3",
              inspectedCard.deck === 'CIVIC'
                ? "bg-gradient-to-br from-indian-terracotta-700 to-amber-900 border-amber-300"
                : "bg-gradient-to-br from-teal-800 to-emerald-950 border-emerald-300"
            )}
          >
            <div className="flex items-center justify-between border-b border-white/20 pb-2">
              <span className="text-xs font-black tracking-widest uppercase">
                {inspectedCard.deck === 'CIVIC' ? 'Civic Fund Card' : 'Market Buzz Card'}
              </span>
              <button
                onClick={() => setInspectedCard(null)}
                className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="font-serif font-black text-lg text-white">
              {inspectedCard.title}
            </h3>

            <p className="text-sm text-white/90 leading-relaxed">
              {inspectedCard.description}
            </p>

            {inspectedCard.amount && (
              <div className="pt-2">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-white text-indian-navy-950 shadow-sm">
                  Amount: ₹{inspectedCard.amount.toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
