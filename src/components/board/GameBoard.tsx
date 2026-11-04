import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BOARD_SPACES, CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS } from '@/domain/board-config';
import { CardAction, GameActionType, GameEvent, GameState, PropertyDefinition, WalkingAnimationState } from '@/domain/game-types';
import { BoardSpaceTile } from './BoardSpaceTile';
import { CityDeedModal } from './CityDeedModal';
import { getSpaceGridCoord } from './board-layout-utils';
import { canBuildOnProperty } from '@/domain/ruleset';
import { TurnStepAcknowledgment } from '@/components/feedback/TurnStepAcknowledgment';
import { PopupTurnTimer } from '@/components/feedback/PopupTurnTimer';
import { Dices, X, Gift, Flame, Check, ArrowRight, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface GameBoardProps {
  gameState: GameState;
  selectedSpaceIndex: number | null;
  onSelectSpace: (index: number | null) => void;
  isRolling: boolean;
  onRollDice?: () => void;
  onDismissCardPopup?: () => void;
  onDismissMoneyAck?: () => void;
  onDispatch?: (type: GameActionType, payload?: Record<string, unknown>) => void;
  isMyTurn?: boolean;
  userUid?: string;
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
  onDismissMoneyAck,
  onDispatch,
  isMyTurn = true,
  userUid,
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

  // Active player location & Pointed Comment Box computations
  const playerPos = activePlayer ? activePlayer.position : 0;
  const playerCoord = getSpaceGridCoord(playerPos);
  const playerSpace = BOARD_SPACES[playerPos];
  const playerPropState = gameState.properties[playerPos];

  const isPropertyDecision =
    isMyTurn &&
    gameState.phase === 'PROPERTY_DECISION' &&
    !walkingAnimation;

  const canBuildHere =
    Boolean(
      isMyTurn &&
      gameState.phase === 'MANAGEMENT' &&
      !walkingAnimation &&
      activePlayer &&
      playerSpace?.type === 'PROPERTY' &&
      canBuildOnProperty(
        playerPos,
        activePlayer.uid,
        gameState.properties,
        activePlayer.cash,
        playerPos,
        gameState.turnNumber
      ).allowed
    );

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
      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white border-2 border-gray-950 rounded-xl shadow-lg grid grid-cols-3 grid-rows-3 p-1 sm:p-1.5 gap-0.5">
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
      {/* 11x11 Grid with Expanded Perimeter Dimensions and Spacious City Grids */}
      <div
        className="w-full h-full grid gap-[1px] bg-indian-parchment-400 rounded-lg overflow-hidden relative"
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
          <div className="w-full flex-1 flex items-center justify-between gap-2 sm:gap-4 my-auto z-10 px-1 sm:px-2 min-h-0 overflow-hidden">
            {/* Panel 1: Civic Fund (12 Community Treasury Rules Indexed 1..12) */}
            <div className="w-[36%] max-w-[270px] min-w-[190px] h-full max-h-[290px] sm:max-h-[330px] rounded-xl bg-gradient-to-br from-indian-terracotta-800 via-amber-950 to-stone-900 text-white p-1.5 sm:p-2 border-2 border-amber-400/70 shadow-xl flex flex-col justify-between overflow-hidden shrink-0">
              <div className="flex items-center justify-between border-b border-amber-300/40 pb-1 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
                  <span className="font-serif font-black text-[9px] sm:text-[11px] md:text-xs tracking-wide text-amber-100 uppercase">
                    CIVIC FUND
                  </span>
                </div>
                <span className="text-[7.5px] sm:text-[8.5px] font-black text-amber-300 bg-amber-900/80 px-1.5 py-0.5 rounded border border-amber-400/40 shadow-2xs">
                  12 Rules
                </span>
              </div>

              {/* Indexed List 1..12 */}
              <div className="flex-1 overflow-y-auto space-y-1 my-1 pr-0.5 select-none custom-scrollbar min-h-0">
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
                        'flex items-start gap-1.5 p-1 rounded-lg cursor-pointer transition-all text-left',
                        isApplied
                          ? 'bg-amber-400 text-indian-navy-950 ring-2 ring-white font-bold scale-[1.02] shadow-sm animate-pulse'
                          : 'hover:bg-white/15 text-amber-100/95'
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-black leading-none mt-0.5',
                          isApplied ? 'bg-indian-navy-950 text-white' : 'bg-white/25 text-white'
                        )}
                      >
                        {ruleNum}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 leading-tight">
                          <span className="font-black truncate text-[8px] sm:text-[9px] md:text-[9.5px]">
                            {card.title}
                          </span>
                          {card.amount && (
                            <span className="shrink-0 text-[7.5px] sm:text-[8.5px] font-black text-amber-300">
                              ₹{card.amount}
                            </span>
                          )}
                        </div>
                        <p className="text-[7px] sm:text-[8px] text-white/85 truncate leading-none mt-0.5">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[7px] sm:text-[8px] text-amber-200/90 font-black tracking-wider text-center border-t border-amber-300/30 pt-1 shrink-0 uppercase">
                COMMUNITY TREASURY
              </div>
            </div>

            {/* In-Board Dice Roll Arena: Bold, Highly Visible 3D Dice & Turn Action Button at Center */}
            <div className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 z-20 shrink-0 px-1 [perspective:1000px]">
              {/* Interactive 3D Tumbling Dice with Authentic Perspective Roll Effect */}
              <div
                onClick={isMyTurn && gameState.phase === 'AWAIT_ROLL' && !isRolling && !walkingAnimation ? onRollDice : undefined}
                className={cn(
                  'flex items-center gap-2.5 sm:gap-3.5 transition-all p-2 rounded-2xl',
                  isMyTurn && gameState.phase === 'AWAIT_ROLL' && !isRolling && !walkingAnimation
                    ? 'cursor-pointer hover:scale-105 active:scale-95 ring-2 ring-indian-terracotta-400 bg-amber-50/90 shadow-md'
                    : ''
                )}
              >
                <div className={cn('transition-transform duration-200 [transform-style:preserve-3d]', isRolling && 'animate-dice-roll-1')}>
                  {renderDiceFace(displayDice[0])}
                </div>
                <div className={cn('transition-transform duration-200 [transform-style:preserve-3d]', isRolling && 'animate-dice-roll-2')}>
                  {renderDiceFace(displayDice[1])}
                </div>
              </div>

              {/* Dice Outcome Total Indicator — ONLY Combined Result */}
              {gameState.dice && !isRolling && (
                <div className="text-[10px] sm:text-[11.5px] font-black font-mono text-indian-navy-950 bg-amber-100/95 border-2 border-amber-300 px-3 py-0.5 rounded-full shadow-2xs">
                  🎲 Rolled: {gameState.dice.first + gameState.dice.second}
                </div>
              )}

              {/* Center Controls: Roll Dice / End Turn / Jail Actions */}
              {isMyTurn && gameState.phase === 'AWAIT_ROLL' && !walkingAnimation ? (
                <button
                  type="button"
                  disabled={isRolling}
                  onClick={onRollDice}
                  className="px-4 py-2 rounded-full font-black text-xs text-white bg-gradient-to-r from-indian-terracotta-500 to-indian-terracotta-600 hover:from-indian-terracotta-600 hover:to-indian-terracotta-700 shadow-md active:scale-95 transition-all flex items-center gap-1.5 border border-indian-terracotta-400 animate-pulse-subtle cursor-pointer"
                >
                  <Dices className="w-4 h-4" />
                  <span>{isRolling ? 'Rolling...' : 'ROLL DICE'}</span>
                </button>
              ) : isMyTurn && (gameState.phase === 'MANAGEMENT' || gameState.phase === 'TURN_END') && !walkingAnimation ? (
                <button
                  type="button"
                  onClick={() => onDispatch?.('END_TURN')}
                  className="px-4 py-1.5 rounded-full font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 shadow-md active:scale-95 transition-all flex items-center gap-1.5 border border-emerald-400 cursor-pointer"
                >
                  <span>END TURN</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : isMyTurn && gameState.phase === 'JAIL_DECISION' && !walkingAnimation ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onDispatch?.('PAY_BAIL')}
                    className="px-2.5 py-1 rounded-full font-bold text-[10px] text-white bg-red-600 hover:bg-red-500 shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Pay ₹500 Bail</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDispatch?.('TRY_DOUBLES')}
                    className="px-2.5 py-1 rounded-full font-bold text-[10px] text-white bg-amber-600 hover:bg-amber-500 shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Dices className="w-3 h-3" />
                    <span>Try Doubles</span>
                  </button>
                </div>
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
            <div className="w-[36%] max-w-[270px] min-w-[190px] h-full max-h-[290px] sm:max-h-[330px] rounded-xl bg-gradient-to-br from-teal-900 via-emerald-950 to-stone-900 text-white p-1.5 sm:p-2 border-2 border-emerald-400/70 shadow-xl flex flex-col justify-between overflow-hidden shrink-0">
              <div className="flex items-center justify-between border-b border-emerald-300/40 pb-1 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />
                  <span className="font-serif font-black text-[9px] sm:text-[11px] md:text-xs tracking-wide text-emerald-100 uppercase">
                    MARKET BUZZ
                  </span>
                </div>
                <span className="text-[7.5px] sm:text-[8.5px] font-black text-emerald-300 bg-emerald-900/80 px-1.5 py-0.5 rounded border border-emerald-400/40 shadow-2xs">
                  12 Rules
                </span>
              </div>

              {/* Indexed List 1..12 */}
              <div className="flex-1 overflow-y-auto space-y-1 my-1 pr-0.5 select-none custom-scrollbar min-h-0">
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
                        'flex items-start gap-1.5 p-1 rounded-lg cursor-pointer transition-all text-left',
                        isApplied
                          ? 'bg-emerald-400 text-indian-navy-950 ring-2 ring-white font-bold scale-[1.02] shadow-sm animate-pulse'
                          : 'hover:bg-white/15 text-emerald-100/95'
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-black leading-none mt-0.5',
                          isApplied ? 'bg-indian-navy-950 text-white' : 'bg-white/25 text-white'
                        )}
                      >
                        {ruleNum}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 leading-tight">
                          <span className="font-black truncate text-[8px] sm:text-[9px] md:text-[9.5px]">
                            {card.title}
                          </span>
                          {card.amount && (
                            <span className="shrink-0 text-[7.5px] sm:text-[8.5px] font-black text-emerald-300">
                              ₹{card.amount}
                            </span>
                          )}
                        </div>
                        <p className="text-[7px] sm:text-[8px] text-white/85 truncate leading-none mt-0.5">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[7px] sm:text-[8px] text-teal-200/90 font-black tracking-wider text-center border-t border-emerald-300/30 pt-1 shrink-0 uppercase">
                FORTUNE & CHANCE
              </div>
            </div>
          </div>

          {/* Bottom Center: Game Status Banner */}
          <div className="z-10 text-[8.5px] sm:text-[9.5px] text-indian-navy-800 dark:text-indian-parchment-200 font-bold bg-white/80 dark:bg-indian-navy-900/80 px-2.5 py-0.5 rounded-full border border-indian-parchment-300 shadow-2xs shrink-0">
            Turn #{gameState.turnNumber} • Phase: {gameState.phase}
          </div>
        </div>

        {/* POINTED COMMENT BOX: Pops near the player's current position to Buy or Build on the city */}
        {(isPropertyDecision || canBuildHere) && (
          <div
            style={{
              gridRow: playerCoord.row,
              gridColumn: playerCoord.col,
            }}
            className="relative z-50 pointer-events-none"
          >
            <div
              className={cn(
                'absolute pointer-events-auto w-60 sm:w-68 p-3.5 rounded-2xl bg-[#070A12] text-white border-2 border-amber-400 shadow-[0_12px_36px_rgba(0,0,0,0.85)] flex flex-col gap-2.5 animate-scale-in text-xs',
                playerCoord.orientation === 'bottom' && 'bottom-[calc(100%+14px)] left-1/2 -translate-x-1/2',
                playerCoord.orientation === 'top' && 'top-[calc(100%+14px)] left-1/2 -translate-x-1/2',
                playerCoord.orientation === 'left' && 'left-[calc(100%+14px)] top-1/2 -translate-y-1/2',
                playerCoord.orientation === 'right' && 'right-[calc(100%+14px)] top-1/2 -translate-y-1/2',
                playerCoord.orientation === 'corner' && (
                  playerPos === 0 ? 'bottom-[calc(100%+14px)] right-0' :
                  playerPos === 10 ? 'bottom-[calc(100%+14px)] left-0' :
                  playerPos === 20 ? 'top-[calc(100%+14px)] left-0' :
                  'top-[calc(100%+14px)] right-0'
                )
              )}
            >
              {/* Pointer Triangle pointing directly at the city tile */}
              {playerCoord.orientation === 'bottom' && (
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-amber-400" />
              )}
              {playerCoord.orientation === 'top' && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[10px] border-b-amber-400" />
              )}
              {playerCoord.orientation === 'left' && (
                <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[10px] border-r-amber-400" />
              )}
              {playerCoord.orientation === 'right' && (
                <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[10px] border-l-amber-400" />
              )}
              {playerCoord.orientation === 'corner' && playerPos === 0 && (
                <div className="absolute -bottom-2.5 right-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-amber-400" />
              )}
              {playerCoord.orientation === 'corner' && playerPos === 10 && (
                <div className="absolute -bottom-2.5 left-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-amber-400" />
              )}
              {playerCoord.orientation === 'corner' && playerPos === 20 && (
                <div className="absolute -top-2.5 left-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[10px] border-b-amber-400" />
              )}
              {playerCoord.orientation === 'corner' && playerPos === 30 && (
                <div className="absolute -top-2.5 right-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[10px] border-b-amber-400" />
              )}

              {/* Pointed Box Content: Buy Property Prompt */}
              {isPropertyDecision && 'price' in playerSpace && (
                <>
                  <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                    <span className="font-serif font-black text-xs text-amber-200">
                      🏙️ Buy Property?
                    </span>
                    <span className="font-black text-emerald-400 text-xs">
                      ₹{playerSpace.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-200 leading-tight">
                    Acquire <strong className="text-white">{playerSpace.name}</strong> for ₹{playerSpace.price.toLocaleString('en-IN')}? (Mortgage: ₹{('mortgageValue' in playerSpace ? playerSpace.mortgageValue : Math.floor((playerSpace as { price: number }).price / 2)).toLocaleString('en-IN')})
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => onDispatch?.('BUY_PROPERTY', { spaceIndex: playerPos })}
                      className="flex-1 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Buy City</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDispatch?.('DECLINE_PROPERTY')}
                      className="px-3 py-1.5 rounded-xl font-bold text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 active:scale-95 transition-all cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </>
              )}

              {/* Pointed Box Content: Build Development Prompt */}
              {canBuildHere && playerSpace.type === 'PROPERTY' && (
                <>
                  <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                    <span className="font-serif font-black text-xs text-amber-200">
                      🔨 Build Development?
                    </span>
                    <span className="font-black text-emerald-400 text-xs">
                      ₹{(playerSpace as PropertyDefinition).buildingCost.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-200 leading-tight">
                    Construct {playerPropState?.buildings === 4 ? 'Commercial Tower' : `House #${(playerPropState?.buildings ?? 0) + 1}`} on <strong className="text-white">{playerSpace.name}</strong>?
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => onDispatch?.('BUILD', { spaceIndex: playerPos })}
                      className="flex-1 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{playerPropState?.buildings === 4 ? 'Build Tower' : 'Build House'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDispatch?.('END_TURN')}
                      className="px-3 py-1.5 rounded-xl font-bold text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 active:scale-95 transition-all cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pop-up Window for Applied Card Rule (Fixed with High-Visibility Acknowledge Button per Screenshot) */}
      {gameState.activeCardPopup && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full max-w-sm sm:max-w-md rounded-2xl p-5 shadow-2xl border-2 space-y-4 animate-scale-in text-white',
              gameState.activeCardPopup.deck === 'CIVIC'
                ? 'bg-gradient-to-br from-[#3b1208] via-[#541c0a] to-[#1a0a05] border-amber-400'
                : 'bg-gradient-to-br from-[#062c26] via-[#094137] to-[#041714] border-emerald-400'
            )}
          >
            {/* Header with Rule Index, Dice Total and Live Turn Timer */}
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

              <div className="flex items-center gap-2">
                <PopupTurnTimer
                  activePlayerName={activePlayer?.displayName}
                  activePlayerColor={activePlayer?.colorToken}
                  timeRemaining={gameState.turnTimeRemaining ?? 30}
                  isMyTurn={isMyTurn}
                />
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-xs font-black font-mono">
                  <span>🎲 Total:</span>
                  <span className="text-amber-300 font-black text-sm">{gameState.activeCardPopup.ruleIndex}</span>
                </div>
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

            {/* Acknowledgment Button with Proper Visibility */}
            <div className="pt-3 flex justify-end w-full">
              <button
                type="button"
                onClick={() => {
                  if (onDismissCardPopup) {
                    onDismissCardPopup();
                  }
                }}
                className="w-full sm:w-auto min-w-[170px] px-6 py-2.5 rounded-xl font-black text-sm bg-amber-400 hover:bg-amber-300 text-indian-navy-950 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2 border-2 border-white ring-2 ring-amber-500/40 cursor-pointer"
              >
                <Check className="w-5 h-5 text-indian-navy-950 stroke-[3]" />
                <span className="tracking-wide uppercase">Acknowledge Rule</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MONEY TRANSACTION ACKNOWLEDGEMENT POP-UP MODAL */}
      {gameState.activeMoneyTransaction && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm sm:max-w-md rounded-2xl p-5 shadow-2xl border-2 border-amber-400 bg-gradient-to-br from-[#070A12] via-[#111A2E] to-[#1F1610] text-white space-y-4 animate-scale-in"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/20 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">
                  {gameState.activeMoneyTransaction.type === 'RENT'
                    ? '💸'
                    : gameState.activeMoneyTransaction.type === 'START_REWARD'
                    ? '🎁'
                    : gameState.activeMoneyTransaction.type === 'TAX'
                    ? '🏛️'
                    : '💰'}
                </span>
                <div>
                  <h3 className="font-serif font-black text-sm sm:text-base tracking-wide text-amber-200 uppercase">
                    {gameState.activeMoneyTransaction.type === 'RENT'
                      ? 'Rent Payment'
                      : gameState.activeMoneyTransaction.type === 'START_REWARD'
                      ? 'START Reward'
                      : gameState.activeMoneyTransaction.type === 'TAX'
                      ? 'Statutory Tax'
                      : gameState.activeMoneyTransaction.type === 'BUY_PROPERTY'
                      ? 'Property Purchase'
                      : gameState.activeMoneyTransaction.type === 'BUILD'
                      ? 'Construction Expense'
                      : 'Financial Notice'}
                  </h3>
                  <span className="text-[10px] text-gray-300">
                    Transaction Notice & Receipt
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <PopupTurnTimer
                  activePlayerName={activePlayer?.displayName}
                  activePlayerColor={activePlayer?.colorToken}
                  timeRemaining={gameState.turnTimeRemaining ?? 30}
                  isMyTurn={isMyTurn}
                />
                {/* Amount Badge */}
                <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-mono font-black text-xs sm:text-sm">
                  ₹{gameState.activeMoneyTransaction.amount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Transaction Parties & Breakdown */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Payer (Spent):</span>
                <span className="font-bold text-red-400">
                  {gameState.activeMoneyTransaction.payerName || 'Player'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Recipient (Earned):</span>
                <span className="font-bold text-emerald-400">
                  {gameState.activeMoneyTransaction.recipientName || 'Bank'}
                </span>
              </div>
              <div className="pt-1.5 border-t border-white/10 text-xs text-amber-100 leading-relaxed">
                {gameState.activeMoneyTransaction.description}
              </div>
            </div>

            {/* Acknowledgement Button with Proper Visibility */}
            <div className="pt-2 flex justify-end w-full">
              <button
                type="button"
                onClick={() => {
                  if (onDismissMoneyAck) {
                    onDismissMoneyAck();
                  }
                }}
                className="w-full sm:w-auto min-w-[200px] px-8 py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indian-navy-950 shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-white ring-2 ring-amber-500/50 cursor-pointer"
              >
                <Check className="w-5 h-5 text-indian-navy-950 stroke-[3]" />
                <span className="tracking-wide uppercase">Acknowledge</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CITY INFORMATION MODAL POP-UP (Opens when any person clicks a city grid) */}
      {selectedSpaceIndex !== null && (
        <CityDeedModal
          space={BOARD_SPACES[selectedSpaceIndex]}
          propertyState={gameState.properties[selectedSpaceIndex]}
          players={gameState.players}
          isMyTurn={isMyTurn}
          currentUserUid={userUid}
          turnNumber={gameState.turnNumber}
          activePlayerName={activePlayer?.displayName}
          activePlayerColor={activePlayer?.colorToken}
          turnTimeRemaining={gameState.turnTimeRemaining ?? 30}
          onClose={() => onSelectSpace(null)}
          onDispatch={onDispatch}
        />
      )}

      {/* Card Inspection Modal if clicked from the indexed list */}
      {inspectedCard && createPortal(
        <div
          onClick={() => setInspectedCard(null)}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full max-w-sm rounded-2xl p-5 text-white shadow-2xl border-2 space-y-3',
              inspectedCard.deck === 'CIVIC'
                ? 'bg-gradient-to-br from-[#3b1208] to-[#1a0a05] border-amber-300'
                : 'bg-gradient-to-br from-[#062c26] to-[#041714] border-emerald-300'
            )}
          >
            <div className="flex items-center justify-between border-b border-white/20 pb-2">
              <span className="text-xs font-black tracking-widest uppercase">
                {inspectedCard.deck === 'CIVIC' ? 'Civic Fund Card' : 'Market Buzz Card'}
              </span>
              <div className="flex items-center gap-2">
                <PopupTurnTimer
                  activePlayerName={activePlayer?.displayName}
                  activePlayerColor={activePlayer?.colorToken}
                  timeRemaining={gameState.turnTimeRemaining ?? 30}
                  isMyTurn={isMyTurn}
                />
                <button
                  onClick={() => setInspectedCard(null)}
                  className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
        </div>,
        document.body
      )}
    </div>
  );
};
