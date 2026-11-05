import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BOARD_SPACES, CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS } from '@/domain/board-config';
import { CardAction, GameActionType, GameEvent, GameState, PropertyDefinition, WalkingAnimationState } from '@/domain/game-types';
import { BoardSpaceTile } from './BoardSpaceTile';
import { CityDeedModal } from './CityDeedModal';
import { FinancialResolutionModal } from './FinancialResolutionModal';
import { usePopupPosition } from './use-popup-position';
import { getSpaceGridCoord } from './board-layout-utils';
import { calculateMortgageValue, canBuildOnProperty, getAuthoritativeBailAmount, getPropertyNoun } from '@/domain/ruleset';
import { TurnStepAcknowledgment } from '@/components/feedback/TurnStepAcknowledgment';
import { PopupTurnTimer } from '@/components/feedback/PopupTurnTimer';
import { useToastStore } from '@/components/feedback/toast-store';
import { Dices, X, Gift, Flame, Check, ArrowRight, KeyRound, Landmark, Building2, Home, Clock } from 'lucide-react';
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
  onDismissCardPopup: _onDismissCardPopup,
  onDismissMoneyAck: _onDismissMoneyAck,
  onDispatch,
  isMyTurn = true,
  userUid,
  lastEvent,
  walkingAnimation,
}) => {
  const activePlayer = gameState.players.find((p) => p.uid === gameState.currentPlayerUid);
  const [inspectedCard, setInspectedCard] = useState<CardAction | null>(null);
  const [voluntaryMortgageOpen, setVoluntaryMortgageOpen] = useState(false);

  // Eligible properties owned by current user that are eligible to mortgage
  const myMortgageableProperties = Object.entries(gameState.properties)
    .filter(([_, prop]) => prop.ownerUid === userUid && !prop.isMortgaged && prop.ownershipState === 'OWNED')
    .map(([idx, prop]) => {
      const spaceIndex = Number(idx);
      const space = BOARD_SPACES[spaceIndex];
      const mortgageVal = calculateMortgageValue(spaceIndex, prop);
      return { spaceIndex, space, prop, mortgageVal };
    });

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
      }, 55);
      return () => clearInterval(interval);
    } else {
      if (gameState.dice) {
        setDisplayDice([gameState.dice.first, gameState.dice.second]);
      }
      setRollingPips([[], []]);
    }
  }, [isRolling, gameState.dice]);

  // Section 7: Automatically bridge activeMoneyTransaction to floating toast in bottom-left corner
  useEffect(() => {
    // Requirement 4: Wait until pawn finishes walking and lands on destination before displaying notification
    if (walkingAnimation) return;

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
        eventId: tx.id,
        type: isPayer ? 'warning' : 'success',
        title: typeLabel,
        message: tx.description,
        amount: tx.amount,
        flow: isPayer ? 'DEBIT' : isRecipient ? 'CREDIT' : undefined,
      });
    }
  }, [gameState.activeMoneyTransaction, userUid, walkingAnimation]);

  // Section 7b: Automatically bridge activeCardPopup to floating toast in bottom-left corner (3-second auto-dismiss)
  useEffect(() => {
    // Wait until token arrives at tile
    if (walkingAnimation) return;

    if (gameState.activeCardPopup) {
      const popup = gameState.activeCardPopup;
      const isCivic = popup.deck === 'CIVIC';
      const deckName = isCivic ? 'Civic Fund' : 'Market Buzz';

      useToastStore.getState().addToast({
        eventId: `card_${gameState.turnNumber}_${popup.deck}_${popup.ruleIndex}`,
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
    }
  }, [gameState.activeCardPopup, gameState.turnNumber, walkingAnimation]);

  // Determine which space should have the glowing / zoomed in state-update effect
  const highlightedSpaceIndex =
    walkingAnimation ? walkingAnimation.currentPos : (activePlayer?.position ?? null);

  // Active player location & Pointed Comment Box computations
  const playerPos = activePlayer ? activePlayer.position : 0;
  const playerSpace = BOARD_SPACES[playerPos];
  const playerPropState = gameState.properties[playerPos];

  // Collision-aware viewport clamping popup positioning hook
  const popupRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const popupPos = usePopupPosition(playerPos, popupRef, boardContainerRef);

  // Authoritative bail amount & property terminology
  const authoritativeBail = getAuthoritativeBailAmount(gameState);
  const propertyNoun = getPropertyNoun(playerSpace);

  // Property purchase affordability & unowned eligibility (Requirement 4 & 5)
  const spacePrice = playerSpace && 'price' in playerSpace ? (playerSpace as { price: number }).price : 0;
  const canAffordCity = (activePlayer?.cash ?? 0) >= spacePrice;

  // Mortgaged property is NEVER treated as unowned
  const isUnownedPurchasable = Boolean(
    playerSpace &&
    'price' in playerSpace &&
    !playerPropState?.ownerUid &&
    !playerPropState?.isMortgaged &&
    playerPropState?.ownershipState !== 'MORTGAGED' &&
    playerPropState?.ownershipState !== 'BLOCKED'
  );

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

  // Mortgaged City Reacquisition (Requirement 3: Only offered upon landing on own mortgaged city)
  const isOwnMortgagedCity = Boolean(
    isMyTurn &&
    !walkingAnimation &&
    activePlayer &&
    gameState.reacquisitionOpportunity &&
    gameState.reacquisitionOpportunity.status === 'PENDING' &&
    gameState.reacquisitionOpportunity.spaceIndex === playerPos &&
    gameState.reacquisitionOpportunity.playerUid === activePlayer.uid &&
    playerPropState?.ownerUid === activePlayer.uid &&
    (playerPropState?.isMortgaged || playerPropState?.ownershipState === 'MORTGAGED') &&
    playerPropState?.ownershipState !== 'BLOCKED'
  );

  const reacquisitionCost =
    gameState.reacquisitionOpportunity?.cost ??
    (playerPropState?.mortgagePayout && playerPropState.mortgagePayout > 0
      ? playerPropState.mortgagePayout
      : calculateMortgageValue(playerPos, playerPropState));

  const canAffordReacquire = (activePlayer?.cash ?? 0) >= reacquisitionCost;

  // Requirement 2: Derived polished player-facing turn indicator without technical debug info
  const playerFacingTurnMessage = (() => {
    if (walkingAnimation) {
      return isMyTurn ? 'Processing Move...' : `Moving ${activePlayer?.displayName || 'Player'}...`;
    }
    if (isMyTurn) {
      if (gameState.phase === 'AWAIT_ROLL') return 'Your Turn — Roll the Dice';
      if (gameState.phase === 'JAIL_DECISION') return `Your Turn — In Jail (Pay ₹${authoritativeBail.toLocaleString('en-IN')} Bail or Try Doubles)`;
      if (gameState.phase === 'PROPERTY_DECISION') return `Your Turn — ${propertyNoun} Decision`;
      if (gameState.phase === 'ACTION_REQUIRED') return 'Action Required — Financial Resolution';
      return 'Your Turn — Manage or End Turn';
    }
    return `Waiting for ${activePlayer?.displayName || 'Player'}`;
  })();

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
          dedupKey: noticeKey,
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
          dedupKey: noticeKey,
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
          dedupKey: noticeKey,
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

  // Requirement 5: Premium digital board game 3D dice appearance with clear pips and authentic depth
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
    const activeDots =
      isRolling && rollingPips[dieIndex].length > 0
        ? rollingPips[dieIndex]
        : dots[safeVal] || [4];

    return (
      <div
        className={cn(
          'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-2 border-stone-800/80 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 dark:from-zinc-100 dark:to-zinc-200 shadow-[0_6px_16px_rgba(0,0,0,0.35),inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.2)] grid grid-cols-3 grid-rows-3 p-1.5 sm:p-2 gap-1.5 sm:gap-2 transition-all duration-100 select-none',
          isRolling && 'shadow-[0_0_18px_rgba(234,88,12,0.8)] scale-105',
          !isRolling && gameState.dice && 'animate-dice-settle'
        )}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {activeDots.includes(i) && (
              <div
                className={cn(
                  'rounded-full transition-colors duration-75',
                  // Iconic central pip of 1 has rich signature Indian Terracotta styling
                  !isRolling && safeVal === 1 && i === 4
                    ? 'w-2.5 h-2.5 sm:w-3 sm:h-3 bg-indian-terracotta-600 ring-1 ring-amber-500/70 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.6)]'
                    : 'w-1.5 h-1.5 sm:w-2 sm:h-2 bg-slate-950 shadow-[inset_0_1px_2px_rgba(0,0,0,0.7),0_1px_1px_rgba(255,255,255,0.5)]',
                  isRolling && 'bg-indian-terracotta-600 animate-pulse'
                )}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      ref={boardContainerRef}
      data-testid="monopoly-board-grid"
      className="relative w-full h-full max-h-full aspect-square mx-auto p-0.5 sm:p-1 bg-indian-parchment-200 border-2 border-indian-parchment-400 rounded-xl shadow-board-elevation select-none flex flex-col justify-center overflow-hidden"
    >
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

        {/* Dedicated Elevated Player Tokens Layer (Requirement 3: Never obscured by backgrounds, artwork, or borders) */}
        <div
          className="absolute inset-0 grid gap-[1px] pointer-events-none z-35 overflow-visible"
          style={{
            gridTemplateColumns: '1.35fr repeat(9, 1fr) 1.35fr',
            gridTemplateRows: '1.4fr repeat(9, 1fr) 1.4fr',
          }}
        >
          {BOARD_SPACES.map((space) => {
            const coord = getSpaceGridCoord(space.spaceIndex);
            const playersHere = gameState.players.filter((p) => {
              const effectivePos =
                walkingAnimation && walkingAnimation.uid === p.uid
                  ? walkingAnimation.currentPos
                  : p.position;
              return effectivePos === space.spaceIndex;
            });

            if (playersHere.length === 0) return null;

            return (
              <div
                key={`elevated-tokens-${space.spaceIndex}`}
                style={{ gridRow: coord.row, gridColumn: coord.col }}
                className="relative w-full h-full flex items-end justify-center pb-1 pointer-events-none overflow-visible"
              >
                <div className="flex items-center justify-center -space-x-1 sm:-space-x-1.5 shrink-0 z-40 filter drop-shadow-md">
                  {playersHere.map((p) => {
                    const isWalkingThisPawn = walkingAnimation?.uid === p.uid;
                    const isActivePawn = gameState.currentPlayerUid === p.uid;
                    return (
                      <div
                        key={`elevated-pawn-${p.uid}-${space.spaceIndex}`}
                        title={`${p.displayName} (${space.name})`}
                        style={{ backgroundColor: p.colorToken }}
                        className={cn(
                          'w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white shadow-token-glow flex items-center justify-center text-[9px] sm:text-[10px] text-white font-black shrink-0 transition-transform duration-150',
                          isWalkingThisPawn && 'scale-125 ring-2 ring-amber-400 animate-bounce',
                          isActivePawn && !isWalkingThisPawn && 'animate-pulse scale-105 ring-1 ring-white'
                        )}
                      >
                        {p.displayName.charAt(0).toUpperCase()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

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
            {/* Panel 1: Civic Fund (All 12 Community Treasury Rules Indexed 1..12 — Desktop: visible; Mobile: compact drawer) */}
            <div className="hidden md:flex md:w-[37%] max-w-[280px] min-w-[160px] h-full rounded-xl bg-gradient-to-br from-indian-terracotta-800 via-amber-950 to-stone-900 text-white p-1.5 border-2 border-amber-400/80 shadow-xl flex-col justify-between overflow-hidden shrink-0">
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
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5 sm:gap-2 z-20 shrink-0 px-1 [perspective:1000px] w-full max-w-sm mx-auto">
              {/* Mobile Quick-Rule Access Buttons */}
              <div className="md:hidden flex items-center justify-center gap-1.5 mb-0.5">
                <button
                  type="button"
                  onClick={() => setInspectedCard(CIVIC_FUND_CARDS[0])}
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-200 bg-amber-950/80 border border-amber-500/50 flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Gift className="w-2.5 h-2.5 text-amber-300" />
                  <span>Civic Fund (12)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectedCard(MARKET_BUZZ_CARDS[0])}
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold text-emerald-200 bg-emerald-950/80 border border-emerald-500/50 flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Flame className="w-2.5 h-2.5 text-emerald-300" />
                  <span>Market Buzz (12)</span>
                </button>
              </div>

              {/* Interactive 3D Tumbling Dice with Authentic Perspective Roll Effect */}
              <div
                onClick={isMyTurn && gameState.phase === 'AWAIT_ROLL' && !isRolling && !walkingAnimation ? onRollDice : undefined}
                className={cn(
                  'flex items-center gap-2.5 sm:gap-3.5 transition-all p-2 rounded-2xl min-h-[44px]',
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
                  className="px-5 py-2.5 rounded-full font-black text-xs text-white bg-gradient-to-r from-indian-terracotta-500 to-indian-terracotta-600 hover:from-indian-terracotta-600 hover:to-indian-terracotta-700 shadow-md active:scale-95 transition-all flex items-center gap-1.5 border border-indian-terracotta-400 animate-pulse-subtle cursor-pointer min-h-[44px]"
                >
                  <Dices className="w-4 h-4" />
                  <span>{isRolling ? 'Rolling...' : 'ROLL DICE'}</span>
                </button>
              ) : isMyTurn && (gameState.phase === 'MANAGEMENT' || gameState.phase === 'TURN_END') && !walkingAnimation ? (
                <div className="flex items-center gap-1.5">
                  {myMortgageableProperties.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setVoluntaryMortgageOpen(true)}
                      className="px-3 py-2 rounded-full font-bold text-xs text-amber-200 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 shadow-md active:scale-95 transition-all flex items-center gap-1 cursor-pointer min-h-[44px]"
                    >
                      <Landmark className="w-3.5 h-3.5" />
                      <span>Mortgage</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDispatch?.('END_TURN')}
                    className="px-4 py-2 rounded-full font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 shadow-md active:scale-95 transition-all flex items-center gap-1.5 border border-emerald-400 cursor-pointer min-h-[44px]"
                  >
                    <span>END TURN</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : isMyTurn && gameState.phase === 'JAIL_DECISION' && !walkingAnimation ? (
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={() => onDispatch?.('PAY_BAIL')}
                    disabled={activePlayer ? activePlayer.cash < authoritativeBail : false}
                    className={cn(
                      'px-3 py-2 rounded-full font-bold text-xs text-white shadow-xs flex items-center gap-1.5 transition-all min-h-[44px]',
                      activePlayer && activePlayer.cash < authoritativeBail
                        ? 'bg-gray-500 opacity-60 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-500 active:scale-95 cursor-pointer'
                    )}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Pay ₹{authoritativeBail.toLocaleString('en-IN')} Bail</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDispatch?.('TRY_DOUBLES')}
                    className="px-3 py-2 rounded-full font-bold text-xs text-white bg-amber-600 hover:bg-amber-500 active:scale-95 shadow-xs cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                  >
                    <Dices className="w-3.5 h-3.5" />
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
                <span className="text-[8.5px] font-bold text-indian-navy-800 bg-white/90 px-2.5 py-0.5 rounded-full border border-indian-parchment-300 shadow-2xs">
                  {isMyTurn ? 'Your Turn' : `Waiting for ${activePlayer?.displayName || 'Player'}`}
                </span>
              )}
            </div>

            {/* Panel 2: Market Buzz (All 12 Fortune & Chance Rules Indexed 1..12 — Desktop: visible; Mobile: compact drawer) */}
            <div className="hidden md:flex md:w-[37%] max-w-[280px] min-w-[160px] h-full rounded-xl bg-gradient-to-br from-teal-900 via-emerald-950 to-stone-900 text-white p-1.5 border-2 border-emerald-400/80 shadow-xl flex-col justify-between overflow-hidden shrink-0">
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

          {/* Bottom Center: Polished Player-Facing Turn Indicator (Requirement 2: Zero internal state/phase debug info) */}
          <div className="z-10 text-[8.5px] sm:text-[9.5px] text-indian-navy-900 dark:text-indian-parchment-100 font-bold bg-white/90 dark:bg-indian-navy-900/90 px-3 py-0.5 rounded-full border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs shrink-0 flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full shrink-0', isMyTurn ? 'bg-indian-terracotta-500 animate-ping' : 'bg-gray-400')} />
            <span>{playerFacingTurnMessage}</span>
          </div>
        </div>

        {/* Requirement 3: POINTED COMMENT BOX with Viewport Clamping & Collision Awareness */}
        {((isPropertyDecision && isUnownedPurchasable && canAffordCity) || canBuildHere || (isOwnMortgagedCity && canAffordReacquire)) && (
          <div
            ref={popupRef}
            style={popupPos.style}
            className="w-64 sm:w-72 p-3.5 rounded-2xl bg-[#070A12]/95 text-white border-2 border-amber-400 shadow-[0_12px_36px_rgba(0,0,0,0.85)] flex flex-col gap-2.5 animate-scale-in text-xs backdrop-blur-md"
          >
            {/* Dynamic Pointer Arrow aligned with target space */}
            <div
              style={popupPos.arrowStyle}
              className={cn(
                'w-0 h-0',
                popupPos.placement === 'top' &&
                  'border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-amber-400',
                popupPos.placement === 'bottom' &&
                  'border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-amber-400'
              )}
            />

            {/* Pointed Box Content: Buy Property Prompt */}
              {isPropertyDecision && isUnownedPurchasable && canAffordCity && 'price' in playerSpace && (
                <>
                  <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                    <span className="font-serif font-black text-xs text-amber-200">
                      🏙️ Buy {propertyNoun}?
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
                      className="flex-1 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[44px]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Buy {propertyNoun}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDispatch?.('DECLINE_PROPERTY')}
                      className="px-3.5 py-2 rounded-xl font-bold text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 active:scale-95 transition-all cursor-pointer min-h-[44px]"
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
                      className="flex-1 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[44px]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{playerPropState?.buildings === 4 ? 'Build Tower' : 'Build House'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDispatch?.('END_TURN')}
                      className="px-3.5 py-2 rounded-xl font-bold text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 active:scale-95 transition-all cursor-pointer min-h-[44px]"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}

              {/* Pointed Box Content: Reacquire Mortgaged Property Prompt (Requirement 3 & 4) */}
              {isOwnMortgagedCity && canAffordReacquire && (
                <>
                  <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                    <span className="font-serif font-black text-xs text-amber-200">
                      🔄 Reacquire {propertyNoun}?
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
                      onClick={() =>
                        onDispatch?.('UNMORTGAGE', {
                          spaceIndex: playerPos,
                          landingId: gameState.reacquisitionOpportunity?.landingId,
                        })
                      }
                      className="flex-1 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer min-h-[44px]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Reacquire {propertyNoun}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDispatch?.('DECLINE_PROPERTY')}
                      className="px-3.5 py-2 rounded-xl font-bold text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 active:scale-95 transition-all cursor-pointer min-h-[44px]"
                    >
                      Decline
                    </button>
                  </div>
                </>
              )}
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
          turnTimeRemaining={gameState.turnTimeRemaining}
          onDispatch={onDispatch}
        />
      )}

      {/* VOLUNTARY MORTGAGE SELECTION MODAL (Center pop-up box where player mortgages a city) */}
      {voluntaryMortgageOpen && myMortgageableProperties.length > 0 && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-[#090D1A] border-2 border-amber-500/80 shadow-[0_16px_48px_rgba(0,0,0,0.95)] text-white overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-amber-950 via-[#180A0A] to-[#1F1010] border-b border-amber-500/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-sm sm:text-base tracking-wide text-amber-300 uppercase">
                    Mortgage Cities (Raise Capital)
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-300">
                      Mortgaging a city provides 50% value and restarts turn timer
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVoluntaryMortgageOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh] custom-scrollbar text-xs">
              <div className="flex items-center justify-between px-1">
                <span className="font-bold text-[11px] uppercase tracking-wider text-gray-400">
                  Select City to Mortgage ({myMortgageableProperties.length})
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{gameState.turnTimeRemaining ?? 30}s timer</span>
                </span>
              </div>

              {myMortgageableProperties.map(({ spaceIndex, space, prop, mortgageVal }) => (
                <div
                  key={spaceIndex}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-amber-400/40 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-sm block truncate text-white">
                        {space.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        {prop.buildings === 5 ? (
                          <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                            <Building2 className="w-3.5 h-3.5" /> Commercial Tower
                          </span>
                        ) : prop.buildings > 0 ? (
                          <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                            <Home className="w-3.5 h-3.5" /> {prop.buildings} House{prop.buildings > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span>Undeveloped Plot</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block uppercase">Instant Payout</span>
                      <span className="font-mono font-black text-sm text-amber-300">
                        +₹{mortgageVal.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onDispatch?.('MORTGAGE', { spaceIndex });
                        if (myMortgageableProperties.length <= 1) {
                          setVoluntaryMortgageOpen(false);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-indian-navy-950 active:scale-95 transition-all shadow-md cursor-pointer"
                    >
                      Mortgage City
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-[11px] text-gray-400">
                You can reacquire mortgaged cities on subsequent turns with a 10% statutory interest charge.
              </span>
              <button
                type="button"
                onClick={() => setVoluntaryMortgageOpen(false)}
                className="px-4 py-1.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                Close
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
