import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BOARD_SPACES, CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS } from '@/domain/board-config';
import { CardAction, GameActionType, GameEvent, GameState, PropertyDefinition, WalkingAnimationState } from '@/domain/game-types';
import { BoardSpaceTile } from './BoardSpaceTile';
import { CityDeedModal } from './CityDeedModal';
import { FinancialResolutionModal } from './FinancialResolutionModal';
import { getSpaceGridCoord } from './board-layout-utils';
import { calculateMortgageValue, canBuildOnProperty } from '@/domain/ruleset';
import { TurnStepAcknowledgment } from '@/components/feedback/TurnStepAcknowledgment';
import { PopupTurnTimer } from '@/components/feedback/PopupTurnTimer';
import { useToastStore } from '@/components/feedback/toast-store';
import { sound } from '@/lib/audio/sound-engine';
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

  // Dynamic rapid tumbling dice faces & random dots during roll animation
  const [displayDice, setDisplayDice] = useState<[number, number]>([
    gameState.dice?.first ?? 3,
    gameState.dice?.second ?? 4,
  ]);
  const [rollingPips, setRollingPips] = useState<[number[], number[]]>([[], []]);

  useEffect(() => {
    if (isRolling) {
      const interval = setInterval(() => {
        // Generate random dots on 3x3 grid (positions 0 to 8)
        const getRandomPips = () => {
          const count = Math.floor(Math.random() * 5) + 2; // 2 to 6 random dots
          const positions = [0, 1, 2, 3, 4, 5, 6, 7, 8];
          return positions.sort(() => 0.5 - Math.random()).slice(0, count);
        };
        setRollingPips([getRandomPips(), getRandomPips()]);
        setDisplayDice([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ]);
        sound.play('DICE_TICK');
      }, 55);
      return () => clearInterval(interval);
    } else {
      if (gameState.dice) {
        setDisplayDice([gameState.dice.first, gameState.dice.second]);
      }
      setRollingPips([[], []]);
      // Play solid landing impact when dice roll settles
      sound.play('DICE_LAND');
    }
  }, [isRolling, gameState.dice]);

  // Section 7: Automatically bridge activeMoneyTransaction to floating toast in bottom-left corner
  useEffect(() => {
    if (gameState.activeMoneyTransaction) {
      const tx = gameState.activeMoneyTransaction;
      const isPayer = tx.payerUid === userUid;
      const isRecipient = tx.recipientUid === userUid;

      const typeLabel =
        tx.type === 'RENT'
          ? 'Rent Payment'
          : tx.type === 'START_REWARD'
          ? 'START Salary'
          : tx.type === 'TAX'
          ? 'Statutory Tax'
          : tx.type === 'BUY_PROPERTY'
          ? 'Property Purchase'
          : tx.type === 'BUILD'
          ? 'Construction Expense'
          : 'Financial Notice';

      useToastStore.getState().addToast({
        type: isPayer ? 'warning' : 'success',
        title: typeLabel,
        message: tx.description,
        amount: tx.amount,
        flow: isPayer ? 'DEBIT' : isRecipient ? 'CREDIT' : undefined,
      });

      // Non-blocking auto-dismiss: clear server acknowledgment notice
      if (onDismissMoneyAck) {
        onDismissMoneyAck();
      }
    }
  }, [gameState.activeMoneyTransaction, userUid, onDismissMoneyAck]);

  // Section 7b: Automatically bridge activeCardPopup to floating toast in bottom-left corner (3-second auto-dismiss)
  useEffect(() => {
    if (gameState.activeCardPopup) {
      const popup = gameState.activeCardPopup;
      const isCivic = popup.deck === 'CIVIC';
      const deckName = isCivic ? 'Civic Fund' : 'Market Buzz';

      useToastStore.getState().addToast({
        type: isCivic ? 'warning' : 'success',
        deck: popup.deck,
        ruleIndex: popup.ruleIndex,
        title: `${deckName} — Rule #${popup.ruleIndex}`,
        message: `${popup.card.title}: ${popup.card.description}`,
        amount: popup.card.amount,
        flow: popup.card.amount
          ? popup.card.description.toLowerCase().includes('pay')
            ? 'DEBIT'
            : 'CREDIT'
          : undefined,
      });

      // Non-blocking auto-dismiss: clear server card popup notice immediately
      if (onDismissCardPopup) {
        onDismissCardPopup();
      }
    }
  }, [gameState.activeCardPopup, onDismissCardPopup]);

  // Determine which space should have the glowing / zoomed in state-update effect
  const highlightedSpaceIndex =
    walkingAnimation ? walkingAnimation.currentPos : (activePlayer?.position ?? null);

  // Active player location & Pointed Comment Box computations
  const playerPos = activePlayer ? activePlayer.position : 0;
  const playerCoord = getSpaceGridCoord(playerPos);
  const playerSpace = BOARD_SPACES[playerPos];
  const playerPropState = gameState.properties[playerPos];

  // City purchase affordability (Section 2.1)
  const spacePrice = playerSpace && 'price' in playerSpace ? (playerSpace as { price: number }).price : 0;
  const canAffordCity = (activePlayer?.cash ?? 0) >= spacePrice;

  const isPropertyDecision =
    isMyTurn &&
    gameState.phase === 'PROPERTY_DECISION' &&
    !walkingAnimation;

  // Build checks (Section 2.2)
  const isDevelopableCity =
    playerSpace?.type === 'PROPERTY' &&
    playerPropState?.ownerUid === activePlayer?.uid &&
    !playerPropState?.isMortgaged &&
    playerPropState.buildings < 5;

  const buildingCost = playerSpace?.type === 'PROPERTY' ? (playerSpace as PropertyDefinition).buildingCost : 0;
  const canAffordBuild = (activePlayer?.cash ?? 0) >= buildingCost;

  const canBuildHere =
    Boolean(
      isMyTurn &&
      gameState.phase === 'MANAGEMENT' &&
      !walkingAnimation &&
      activePlayer &&
      playerSpace?.type === 'PROPERTY' &&
      canAffordBuild &&
      canBuildOnProperty(
        playerPos,
        activePlayer.uid,
        gameState.properties,
        activePlayer.cash,
        playerPos,
        gameState.turnNumber
      ).allowed
    );

  // Mortgaged City Reacquisition (Section 6.5)
  const isOwnMortgagedCity = Boolean(
    isMyTurn &&
    gameState.phase === 'MANAGEMENT' &&
    !walkingAnimation &&
    activePlayer &&
    playerPropState?.ownerUid === activePlayer.uid &&
    (playerPropState?.isMortgaged || playerPropState?.ownershipState === 'MORTGAGED')
  );

  const reacquisitionCost =
    playerPropState?.mortgagePayout && playerPropState.mortgagePayout > 0
      ? playerPropState.mortgagePayout
      : calculateMortgageValue(playerPos, playerPropState);

  const canAffordReacquire = (activePlayer?.cash ?? 0) >= reacquisitionCost;

  // Toast triggers for insufficient balance
  const lastInsuffNoticeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isMyTurn || walkingAnimation) return;

    // 1. Unaffordable City Purchase (Section 2.1)
    const isUnownedPurchasable =
      playerSpace &&
      (playerSpace.type === 'PROPERTY' || playerSpace.type === 'TRANSIT' || playerSpace.type === 'UTILITY') &&
      playerPropState &&
      !playerPropState.ownerUid &&
      playerPropState.ownershipState !== 'BLOCKED';

    if (isUnownedPurchasable && !canAffordCity && (isPropertyDecision || gameState.phase === 'MANAGEMENT')) {
      const noticeKey = `buy_${gameState.turnNumber}_${playerPos}`;
      if (lastInsuffNoticeRef.current !== noticeKey) {
        lastInsuffNoticeRef.current = noticeKey;
        useToastStore.getState().addToast({
          type: 'error',
          title: 'Purchase Unavailable',
          message: 'Insufficient balance to purchase this property.',
        });
        if (gameState.phase === 'PROPERTY_DECISION') {
          onDispatch?.('DECLINE_PROPERTY');
        }
      }
    }

    // 2. Unaffordable Construction (Section 2.2)
    if (gameState.phase === 'MANAGEMENT' && isDevelopableCity && !canAffordBuild) {
      const noticeKey = `build_${gameState.turnNumber}_${playerPos}`;
      if (lastInsuffNoticeRef.current !== noticeKey) {
        lastInsuffNoticeRef.current = noticeKey;
        useToastStore.getState().addToast({
          type: 'warning',
          title: 'Construction Unavailable',
          message: 'Insufficient balance to build on this property.',
        });
      }
    }

    // 3. Unaffordable Reacquisition (Section 6.5)
    if (isOwnMortgagedCity && !canAffordReacquire) {
      const noticeKey = `reacquire_${gameState.turnNumber}_${playerPos}`;
      if (lastInsuffNoticeRef.current !== noticeKey) {
        lastInsuffNoticeRef.current = noticeKey;
        useToastStore.getState().addToast({
          type: 'warning',
          title: 'Reacquisition Unavailable',
          message: 'Insufficient balance to reacquire this property.',
        });
      }
    }
  }, [
    isMyTurn,
    walkingAnimation,
    isPropertyDecision,
    playerSpace,
    playerPropState,
    canAffordCity,
    gameState.phase,
    isDevelopableCity,
    canAffordBuild,
    isOwnMortgagedCity,
    canAffordReacquire,
    gameState.turnNumber,
    playerPos,
    onDispatch,
  ]);

  // Dice dot positions (1 to 6) or dynamic random dots coming while rolling
  const renderDiceFace = (val: number, dieIndex: 0 | 1) => {
    const safeVal = val >= 1 && val <= 6 ? val : 3;
    const dots: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    // If rolling, display dynamic random dots coming on this die
    const activeDots = isRolling && rollingPips[dieIndex].length > 0
      ? rollingPips[dieIndex]
      : (dots[safeVal] || [4]);

    return (
      <div
        className={cn(
          'w-10 h-10 sm:w-12 sm:h-12 bg-white border-2 border-gray-950 rounded-xl shadow-lg grid grid-cols-3 grid-rows-3 p-1 sm:p-1.5 gap-0.5 transition-all duration-75',
          isRolling && 'shadow-[0_0_16px_rgba(234,88,12,0.7)] scale-105'
        )}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {activeDots.includes(i) && (
              <div
                className={cn(
                  'w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shadow-xs transition-colors duration-75',
                  isRolling ? 'bg-indian-terracotta-600 animate-pulse' : 'bg-black'
                )}
              />
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
          <div className="w-full flex-1 flex items-stretch justify-between gap-1.5 sm:gap-3 my-auto z-10 px-1 sm:px-2 min-h-0 overflow-hidden">
            {/* Panel 1: Civic Fund (All 12 Community Treasury Rules Indexed 1..12 — Non-scrollable) */}
            <div className="w-[37%] max-w-[280px] min-w-[180px] h-full rounded-xl bg-gradient-to-br from-indian-terracotta-800 via-amber-950 to-stone-900 text-white p-1.5 border-2 border-amber-400/80 shadow-xl flex flex-col justify-between overflow-hidden shrink-0">
              <div className="flex items-center justify-between border-b border-amber-300/40 pb-0.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-amber-300" />
                  <span className="font-serif font-black text-[10px] sm:text-[11px] md:text-[12.5px] tracking-wide text-amber-100 uppercase">
                    CIVIC FUND
                  </span>
                </div>
                <span className="text-[7.5px] sm:text-[8.5px] font-black text-amber-300 bg-amber-900/80 px-1.5 py-0.2 rounded border border-amber-400/40 shadow-2xs">
                  12 Rules
                </span>
              </div>

              {/* All 12 Rules Listed Simultaneously (No Scrollbar, Increased Font Size) */}
              <div className="flex-1 flex flex-col justify-between py-0.5 select-none overflow-hidden min-h-0">
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
                        'flex items-center justify-between gap-1 px-1 py-0.2 rounded cursor-pointer transition-all text-left leading-tight',
                        isApplied
                          ? 'bg-amber-400 text-indian-navy-950 ring-2 ring-white font-black scale-[1.02] shadow-sm animate-pulse'
                          : 'hover:bg-white/20 text-white'
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={cn(
                            'shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-black leading-none',
                            isApplied ? 'bg-indian-navy-950 text-white' : 'bg-white/25 text-white'
                          )}
                        >
                          {ruleNum}
                        </span>
                        <span className="font-bold truncate text-[9.5px] sm:text-[10.5px] md:text-[11.5px] leading-tight">
                          {card.title}
                        </span>
                      </div>
                      <span className="shrink-0 text-[8.5px] sm:text-[9.5px] md:text-[10px] font-black text-amber-300 ml-1">
                        {card.amount ? `₹${card.amount}` : (ruleNum === 9 ? 'Jail Pass' : (ruleNum === 10 ? 'To Jail' : ''))}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="text-[7px] sm:text-[8px] text-amber-200/90 font-black tracking-wider text-center border-t border-amber-300/30 pt-0.5 shrink-0 uppercase">
                COMMUNITY TREASURY
              </div>
            </div>

            {/* In-Board Dice Roll Arena: Symmetrically Centered 3D Dice & Controls */}
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5 sm:gap-2 z-20 shrink-0 px-1 [perspective:1000px]">
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
                  {renderDiceFace(displayDice[0], 0)}
                </div>
                <div className={cn('transition-transform duration-200 [transform-style:preserve-3d]', isRolling && 'animate-dice-roll-2')}>
                  {renderDiceFace(displayDice[1], 1)}
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

            {/* Panel 2: Market Buzz (All 12 Fortune & Chance Rules Indexed 1..12 — Non-scrollable) */}
            <div className="w-[37%] max-w-[280px] min-w-[180px] h-full rounded-xl bg-gradient-to-br from-teal-900 via-emerald-950 to-stone-900 text-white p-1.5 border-2 border-emerald-400/80 shadow-xl flex flex-col justify-between overflow-hidden shrink-0">
              <div className="flex items-center justify-between border-b border-emerald-300/40 pb-0.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="font-serif font-black text-[10px] sm:text-[11px] md:text-[12.5px] tracking-wide text-emerald-100 uppercase">
                    MARKET BUZZ
                  </span>
                </div>
                <span className="text-[7.5px] sm:text-[8.5px] font-black text-emerald-300 bg-emerald-900/80 px-1.5 py-0.2 rounded border border-emerald-400/40 shadow-2xs">
                  12 Rules
                </span>
              </div>

              {/* All 12 Rules Listed Simultaneously (No Scrollbar, Increased Font Size) */}
              <div className="flex-1 flex flex-col justify-between py-0.5 select-none overflow-hidden min-h-0">
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
                        'flex items-center justify-between gap-1 px-1 py-0.2 rounded cursor-pointer transition-all text-left leading-tight',
                        isApplied
                          ? 'bg-emerald-400 text-indian-navy-950 ring-2 ring-white font-black scale-[1.02] shadow-sm animate-pulse'
                          : 'hover:bg-white/20 text-white'
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={cn(
                            'shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-black leading-none',
                            isApplied ? 'bg-indian-navy-950 text-white' : 'bg-white/25 text-white'
                          )}
                        >
                          {ruleNum}
                        </span>
                        <span className="font-bold truncate text-[9.5px] sm:text-[10.5px] md:text-[11.5px] leading-tight">
                          {card.title}
                        </span>
                      </div>
                      <span className="shrink-0 text-[8.5px] sm:text-[9.5px] md:text-[10px] font-black text-emerald-300 ml-1">
                        {card.amount ? `₹${card.amount}` : (ruleNum === 5 ? '-3 Spaces' : (ruleNum === 9 ? 'To Jail' : (ruleNum === 2 ? 'To Start' : (ruleNum === 3 ? 'To CP' : (ruleNum === 12 ? 'To Marine' : '')))))}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="text-[7px] sm:text-[8px] text-teal-200/90 font-black tracking-wider text-center border-t border-emerald-300/30 pt-0.5 shrink-0 uppercase">
                FORTUNE & CHANCE
              </div>
            </div>
          </div>

          {/* Bottom Center: Game Status Banner */}
          <div className="z-10 text-[8.5px] sm:text-[9.5px] text-indian-navy-800 dark:text-indian-parchment-200 font-bold bg-white/80 dark:bg-indian-navy-900/80 px-2.5 py-0.5 rounded-full border border-indian-parchment-300 shadow-2xs shrink-0">
            Turn #{gameState.turnNumber} • Phase: {gameState.phase}
          </div>
        </div>

        {/* POINTED COMMENT BOX: Pops near the player's current position to Buy or Build or Reacquire the city */}
        {((isPropertyDecision && canAffordCity) || canBuildHere || (isOwnMortgagedCity && canAffordReacquire)) && (
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
              {isPropertyDecision && canAffordCity && 'price' in playerSpace && (
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

              {/* Pointed Box Content: Reacquire Mortgaged Property Prompt (Section 6.5) */}
              {isOwnMortgagedCity && canAffordReacquire && (
                <>
                  <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                    <span className="font-serif font-black text-xs text-amber-200">
                      🔄 Reacquire Property?
                    </span>
                    <span className="font-black text-emerald-400 text-xs">
                      ₹{reacquisitionCost.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-200 leading-tight">
                    Reacquire <strong className="text-white">{playerSpace.name}</strong> for ₹{reacquisitionCost.toLocaleString('en-IN')}? All existing developments are preserved and rent collection will resume.
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => onDispatch?.('UNMORTGAGE', { spaceIndex: playerPos })}
                      className="flex-1 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Reacquire City</span>
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

      {/* MANDATORY FINANCIAL RESOLUTION WINDOW (Section 6) */}
      {gameState.pendingFinancialObligation && (
        <FinancialResolutionModal
          obligation={gameState.pendingFinancialObligation}
          players={gameState.players}
          properties={gameState.properties}
          currentUserUid={userUid || 'player_1'}
          onDispatch={onDispatch}
        />
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
