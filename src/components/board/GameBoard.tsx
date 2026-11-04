import React, { useState, useEffect } from 'react';
import { BOARD_SPACES, CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS } from '@/domain/board-config';
import { CardAction, GameEvent, GameState, WalkingAnimationState } from '@/domain/game-types';
import { BoardSpaceTile } from './BoardSpaceTile';
import { TurnStepAcknowledgment } from '@/components/feedback/TurnStepAcknowledgment';
import { Dices, X, Gift, Flame, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface GameBoardProps {
  gameState: GameState;
  selectedSpaceIndex: number | null;
  onSelectSpace: (index: number) => void;
  isRolling: boolean;
  onRollDice?: () => void;
  onDismissCardPopup?: () => void;
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
  onDismissCardPopup,
  isMyTurn = true,
  lastEvent,
  walkingAnimation,
}) => {
  const activePlayer = gameState.players.find((p) => p.uid === gameState.currentPlayerUid);
  const [inspectedCard, setInspectedCard] = useState<CardAction | null>(null);

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
      {/* 11x11 Grid with Spacious City Grids and Non-Overlapping Dimensions */}
      <div
        className="w-full h-full grid gap-[1px] bg-indian-parchment-400 rounded-lg overflow-hidden"
        style={{
          gridTemplateColumns: '1.35fr repeat(9, 1fr) 1.35fr',
          gridTemplateRows: '1.4fr repeat(9, 1fr) 1.4fr',
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

        {/* Center Area: Civic Fund & Market Buzz Indexed Rule Lists & 3D Dice Arena */}
        <div
          className="relative flex flex-col items-center justify-between p-1 sm:p-2 bg-gradient-to-br from-indian-parchment-100/95 via-white/95 to-amber-50/90 dark:from-indian-navy-950/95 dark:to-indian-navy-900/95 rounded-lg border border-indian-parchment-300 dark:border-indian-navy-700 shadow-inner overflow-hidden"
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
          <div className="w-full max-w-sm z-10 shrink-0">
            <TurnStepAcknowledgment
              gameState={gameState}
              lastEvent={lastEvent}
            />
          </div>

          {/* Middle Row: Civic Fund Indexed List, 3D Dice Rolling Arena, and Market Buzz Indexed List */}
          <div className="w-full flex-1 flex items-center justify-between gap-1 sm:gap-2 my-auto z-10 px-0.5 sm:px-1 min-h-0 overflow-hidden">
            {/* Panel 1: Civic Fund (12 Community Treasury Rules Indexed 1..12) */}
            <div className="w-[33%] max-w-[250px] h-full max-h-[280px] sm:max-h-[320px] rounded-xl bg-gradient-to-br from-indian-terracotta-800 via-amber-950 to-stone-900 text-white p-1 sm:p-1.5 border border-amber-400/60 shadow-lg flex flex-col justify-between overflow-hidden shrink-0">
              <div className="flex items-center justify-between border-b border-amber-300/40 pb-0.5 shrink-0">
                <div className="flex items-center gap-1">
                  <Gift className="w-3 h-3 text-amber-300" />
                  <span className="font-serif font-black text-[7.5px] sm:text-[9px] tracking-wide text-amber-100 uppercase">
                    CIVIC FUND
                  </span>
                </div>
                <span className="text-[6.5px] sm:text-[7px] font-black text-amber-300 bg-amber-900/60 px-1 py-0.2 rounded border border-amber-500/30">
                  12 Rules
                </span>
              </div>

              {/* Indexed List 1..12 */}
              <div className="flex-1 overflow-y-auto space-y-0.5 my-0.5 pr-0.5 select-none custom-scrollbar min-h-0">
                {CIVIC_FUND_CARDS.map((card, idx) => {
                  const ruleNum = idx + 1;
                  const isApplied =
                    gameState.activeCardPopup?.deck === 'CIVIC' &&
                    gameState.activeCardPopup.ruleIndex === ruleNum;
                  return (
                    <div
                      key={card.id}
                      onClick={() => setInspectedCard(card)}
                      title={`Rule #${ruleNum}: ${card.title} - ${card.description}`}
                      className={cn(
                        'flex items-start gap-1 p-0.5 rounded cursor-pointer transition-all text-left',
                        isApplied
                          ? 'bg-amber-400 text-indian-navy-950 ring-2 ring-white font-bold scale-[1.02] shadow-sm animate-pulse'
                          : 'hover:bg-white/10 text-amber-100/90'
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black leading-none mt-0.2',
                          isApplied ? 'bg-indian-navy-950 text-white' : 'bg-white/20 text-white'
                        )}
                      >
                        {ruleNum}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-0.5 leading-tight">
                          <span className="font-bold truncate text-[7px] sm:text-[7.5px] md:text-[8px]">
                            {card.title}
                          </span>
                          {card.amount && (
                            <span className="shrink-0 text-[6.5px] font-extrabold text-amber-300">
                              ₹{card.amount}
                            </span>
                          )}
                        </div>
                        <p className="text-[6px] sm:text-[6.5px] text-white/70 truncate leading-none mt-0.2">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[6px] sm:text-[6.5px] text-amber-200/80 font-bold text-center border-t border-amber-300/30 pt-0.5 shrink-0">
                COMMUNITY TREASURY
              </div>
            </div>

            {/* In-Board Dice Roll Arena: Bold, Highly Visible Dice at Center */}
            <div className="flex flex-col items-center justify-center gap-1 sm:gap-1.5 z-20 shrink-0 px-0.5">
              {/* Interactive 3D Tumbling Dice with Bold Black Dots */}
              <div
                onClick={isMyTurn && gameState.phase === 'AWAIT_ROLL' && !isRolling && !walkingAnimation ? onRollDice : undefined}
                className={cn(
                  'flex items-center gap-2 sm:gap-3 transition-all p-1.5 sm:p-2 rounded-2xl',
                  isMyTurn && gameState.phase === 'AWAIT_ROLL' && !isRolling && !walkingAnimation
                    ? 'cursor-pointer hover:scale-105 active:scale-95 ring-2 ring-indian-terracotta-400 bg-amber-50/90 shadow-md'
                    : ''
                )}
              >
                <div className={cn(isRolling && 'animate-dice-tumble')}>
                  {renderDiceFace(displayDice[0])}
                </div>
                <div className={cn(isRolling && 'animate-dice-tumble')}>
                  {renderDiceFace(displayDice[1])}
                </div>
              </div>

              {/* Dice Outcome Total Indicator */}
              {gameState.dice && !isRolling && (
                <div className="text-[9px] sm:text-[10px] font-black font-mono text-indian-navy-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full shadow-2xs">
                  🎲 Rolled: {gameState.dice.first + gameState.dice.second} ({gameState.dice.first}+{gameState.dice.second})
                </div>
              )}

              {/* In-Board Dice Action Button */}
              {isMyTurn && gameState.phase === 'AWAIT_ROLL' && !walkingAnimation ? (
                <button
                  type="button"
                  disabled={isRolling}
                  onClick={onRollDice}
                  className="px-3.5 py-1.5 rounded-full font-bold text-[11px] text-white bg-gradient-to-r from-indian-terracotta-500 to-indian-terracotta-600 hover:from-indian-terracotta-600 hover:to-indian-terracotta-700 shadow-md active:scale-95 transition-all flex items-center gap-1.5 border border-indian-terracotta-400 animate-pulse-subtle cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>{isRolling ? 'Rolling...' : 'ROLL DICE'}</span>
                </button>
              ) : walkingAnimation ? (
                <span className="text-[8.5px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 animate-pulse">
                  🚶 Stepping along lane...
                </span>
              ) : gameState.dice?.isDouble ? (
                <span className="text-[9px] font-bold text-indian-terracotta-600 bg-indian-terracotta-100 px-2 py-0.5 rounded-full border border-indian-terracotta-300">
                  🎉 DOUBLES!
                </span>
              ) : (
                <span className="text-[8.5px] font-semibold text-gray-500 bg-white/80 px-2 py-0.5 rounded-full border border-indian-parchment-300">
                  {activePlayer?.displayName || 'Player'}
                </span>
              )}
            </div>

            {/* Panel 2: Market Buzz (12 Fortune & Chance Rules Indexed 1..12) */}
            <div className="w-[33%] max-w-[250px] h-full max-h-[280px] sm:max-h-[320px] rounded-xl bg-gradient-to-br from-teal-900 via-emerald-950 to-stone-900 text-white p-1 sm:p-1.5 border border-emerald-400/60 shadow-lg flex flex-col justify-between overflow-hidden shrink-0">
              <div className="flex items-center justify-between border-b border-emerald-300/40 pb-0.5 shrink-0">
                <div className="flex items-center gap-1">
                  <Flame className="w-3 h-3 text-emerald-300" />
                  <span className="font-serif font-black text-[7.5px] sm:text-[9px] tracking-wide text-emerald-100 uppercase">
                    MARKET BUZZ
                  </span>
                </div>
                <span className="text-[6.5px] sm:text-[7px] font-black text-emerald-300 bg-emerald-900/60 px-1 py-0.2 rounded border border-emerald-500/30">
                  12 Rules
                </span>
              </div>

              {/* Indexed List 1..12 */}
              <div className="flex-1 overflow-y-auto space-y-0.5 my-0.5 pr-0.5 select-none custom-scrollbar min-h-0">
                {MARKET_BUZZ_CARDS.map((card, idx) => {
                  const ruleNum = idx + 1;
                  const isApplied =
                    gameState.activeCardPopup?.deck === 'MARKET' &&
                    gameState.activeCardPopup.ruleIndex === ruleNum;
                  return (
                    <div
                      key={card.id}
                      onClick={() => setInspectedCard(card)}
                      title={`Rule #${ruleNum}: ${card.title} - ${card.description}`}
                      className={cn(
                        'flex items-start gap-1 p-0.5 rounded cursor-pointer transition-all text-left',
                        isApplied
                          ? 'bg-emerald-400 text-indian-navy-950 ring-2 ring-white font-bold scale-[1.02] shadow-sm animate-pulse'
                          : 'hover:bg-white/10 text-emerald-100/90'
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black leading-none mt-0.2',
                          isApplied ? 'bg-indian-navy-950 text-white' : 'bg-white/20 text-white'
                        )}
                      >
                        {ruleNum}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-0.5 leading-tight">
                          <span className="font-bold truncate text-[7px] sm:text-[7.5px] md:text-[8px]">
                            {card.title}
                          </span>
                          {card.amount && (
                            <span className="shrink-0 text-[6.5px] font-extrabold text-emerald-300">
                              ₹{card.amount}
                            </span>
                          )}
                        </div>
                        <p className="text-[6px] sm:text-[6.5px] text-white/70 truncate leading-none mt-0.2">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[6px] sm:text-[6.5px] text-teal-200/80 font-bold text-center border-t border-emerald-300/30 pt-0.5 shrink-0">
                FORTUNE & CHANCE
              </div>
            </div>
          </div>

          {/* Bottom Center: Game Status Banner */}
          <div className="z-10 text-[8.5px] sm:text-[9.5px] text-indian-navy-800 dark:text-indian-parchment-200 font-bold bg-white/80 dark:bg-indian-navy-900/80 px-2.5 py-0.5 rounded-full border border-indian-parchment-300 shadow-2xs shrink-0">
            Turn #{gameState.turnNumber} • Phase: {gameState.phase}
          </div>
        </div>
      </div>

      {/* Pop-up Window for Applied Card Rule (Triggered when landing on Civic Fund or Market Buzz) */}
      {gameState.activeCardPopup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full max-w-sm sm:max-w-md rounded-2xl p-5 shadow-2xl border-2 space-y-4 animate-scale-in text-white',
              gameState.activeCardPopup.deck === 'CIVIC'
                ? 'bg-gradient-to-br from-indian-terracotta-900 via-amber-950 to-stone-900 border-amber-400'
                : 'bg-gradient-to-br from-teal-950 via-emerald-950 to-stone-900 border-emerald-400'
            )}
          >
            {/* Header with Rule Index and Dice Total */}
            <div className="flex items-center justify-between border-b border-white/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {gameState.activeCardPopup.deck === 'CIVIC' ? '🏛️' : '📈'}
                </span>
                <div>
                  <h3 className="font-serif font-black text-sm sm:text-base tracking-wide uppercase">
                    {gameState.activeCardPopup.deck === 'CIVIC' ? 'CIVIC FUND' : 'MARKET BUZZ'} — RULE #{gameState.activeCardPopup.ruleIndex}
                  </h3>
                  <span className="text-[10px] text-amber-200/90 font-medium">
                    {gameState.activeCardPopup.deck === 'CIVIC' ? 'Community Treasury' : 'Fortune & Chance'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-xs font-black font-mono">
                <span>🎲 Dice Total:</span>
                <span className="text-amber-300 font-black text-sm">{gameState.activeCardPopup.ruleIndex}</span>
              </div>
            </div>

            {/* Main Rule Information */}
            <div className="space-y-2 py-1">
              <h4 className="font-serif font-black text-lg sm:text-xl text-amber-100 leading-snug">
                {gameState.activeCardPopup.card.title}
              </h4>
              <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                {gameState.activeCardPopup.card.description}
              </p>

              {gameState.activeCardPopup.card.amount && (
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white text-indian-navy-950 shadow-sm">
                    <span>Amount:</span>
                    <span className="text-emerald-700">₹{gameState.activeCardPopup.card.amount.toLocaleString('en-IN')}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Action / Dismiss Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (onDismissCardPopup) {
                    onDismissCardPopup();
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-white text-indian-navy-950 hover:bg-amber-100 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Acknowledge Rule</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Inspection Modal if clicked from the indexed list */}
      {inspectedCard && (
        <div
          onClick={() => setInspectedCard(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full max-w-sm rounded-2xl p-5 text-white shadow-2xl border-2 space-y-3',
              inspectedCard.deck === 'CIVIC'
                ? 'bg-gradient-to-br from-indian-terracotta-700 to-amber-900 border-amber-300'
                : 'bg-gradient-to-br from-teal-800 to-emerald-950 border-emerald-300'
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
