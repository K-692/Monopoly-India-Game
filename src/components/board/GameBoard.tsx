import React, { useState, useEffect, useRef, useCallback } from 'react';
import { avatarLabel, avatarBg } from '@/domain/avatar';
import { createPortal } from 'react-dom';
import { BOARD_SPACES, CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS, getCardFinancialEffect } from '@/domain/board-config';
import { CardAction, GameActionType, GameEvent, GameState, WalkingAnimationState } from '@/domain/game-types';
import { BoardSpaceTile } from './BoardSpaceTile';
import { CityDeedModal } from './CityDeedModal';
import { FinancialResolutionModal } from './FinancialResolutionModal';
import { usePopupPosition } from './use-popup-position';
import { getSpaceGridCoord } from './board-layout-utils';
import { calculateBuildingCost, calculateMortgageValue, calculateReacquisitionCost, canBuildOnProperty, getAuthoritativeBailAmount, getPropertyNoun, getSortedEligibleSellToBankProperties } from '@/domain/ruleset';
import { ToastContainer } from '@/components/feedback/ToastContainer';
import { PingIndicator } from '@/components/feedback/PingIndicator';
import { PopupTurnTimer } from '@/components/feedback/PopupTurnTimer';
import { useToastStore } from '@/components/feedback/toast-store';
import { sound } from '@/lib/audio/sound-engine';
import { X, Gift, Flame, Check, ArrowRight, KeyRound, Landmark, Building2, Home, Clock, Bot, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface GameBoardProps {
  gameState: GameState;
  selectedSpaceIndex: number | null;
  onSelectSpace: (index: number | null) => void;
  isRolling: boolean;
  pendingCommandType?: string | null;
  onRollDice?: () => void;
  onDismissCardPopup?: () => void;
  onDismissMoneyAck?: () => void;
  onDispatch?: (type: GameActionType, payload?: Record<string, unknown>) => void;
  isMyTurn?: boolean;
  userUid?: string;
  lastEvent?: GameEvent;
  walkingAnimation?: WalkingAnimationState | null;
}

/** Shared compact size for the board-centre turn controls (fits two rows inside the fixed controls row). */
const CONTROL_BUTTON_CLASS =
  'h-9 px-3 rounded-full font-bold text-[11px] whitespace-nowrap flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all min-w-0';

export const GameBoard: React.FC<GameBoardProps> = React.memo(({
  gameState,
  selectedSpaceIndex,
  onSelectSpace,
  isRolling,
  pendingCommandType,
  onRollDice,
  onDismissCardPopup: _onDismissCardPopup,
  onDismissMoneyAck: _onDismissMoneyAck,
  onDispatch,
  isMyTurn = true,
  userUid,
  walkingAnimation,
}) => {
  const activePlayer = gameState.players.find((p) => p.uid === gameState.currentPlayerUid);
  const [inspectedCard, setInspectedCard] = useState<CardAction | null>(null);
  const [voluntaryMortgageOpen, setVoluntaryMortgageOpen] = useState(false);
  const [isBoardInspecting, setIsBoardInspecting] = useState(false);

  // Eligible properties owned by current user that are eligible to mortgage (authoritative domain utility)
  const myMortgageableProperties = userUid
    ? getSortedEligibleSellToBankProperties(userUid, gameState.properties)
    : [];

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
    if (gameState.activeMoneyTransaction) {
      const tx = gameState.activeMoneyTransaction;
      const isRecipient = tx.recipientUid === userUid;

      // Section 5: Start-Pass Notification Privacy & Immediate Trigger
      // Only show the credited amount to the relevant player who crossed START!
      // Triggers immediately as player crosses START without waiting for entire walking sequence to finish.
      // START salary is credited and announced by the game store at the moment the pawn crosses START
      if (tx.type === 'START_REWARD') {
        void isRecipient;
        return;
      }
    }

    // For destination-dependent landing notices (Rent, Tax, City Purchase), wait until pawn finishes walking
    if (walkingAnimation) return;

    if (gameState.activeMoneyTransaction) {
      const tx = gameState.activeMoneyTransaction;
      const isPayer = tx.payerUid === userUid;
      const isRecipient = tx.recipientUid === userUid;

      const typeLabel =
        tx.type === 'RENT'
          ? 'Rent Payment'
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

  // Requirement 6: Authoritative Player-Specific Cash Credit & Debit Transaction Sounds
  // - Plays cash credit sound when the local player's balance increases.
  // - Plays cash debit sound when the local player's balance decreases.
  // - Completely silent for other players' transactions.
  // - Deduplicated by transactionId; initial mount/reconnect populates seen IDs to prevent replay.
  const playedTxIdsRef = useRef<Set<string>>(new Set());
  const initialTxHydratedRef = useRef(false);

  useEffect(() => {
    if (!gameState.transactions || !userUid) return;

    // On initial mount / reconnect, hydrate all existing transaction IDs so historical transactions don't play sounds
    if (!initialTxHydratedRef.current) {
      initialTxHydratedRef.current = true;
      for (const tx of gameState.transactions) {
        playedTxIdsRef.current.add(tx.transactionId);
      }
      return;
    }

    // Process new transactions
    for (const tx of gameState.transactions) {
      if (playedTxIdsRef.current.has(tx.transactionId)) continue;
      playedTxIdsRef.current.add(tx.transactionId);

      // Only play sounds for THIS authenticated local player
      if (tx.playerUid === userUid) {
        if (tx.direction === 'CREDIT') {
          sound.play('CASH_CREDIT');
        } else if (tx.direction === 'DEBIT') {
          sound.play('CASH_DEBIT');
        }
      }
    }
  }, [gameState.transactions, userUid]);

  // Requirement: Human Player Turn Alert (Localized Audio Notification)
  // - Plays a short, pleasant notification tone strictly on the active human player's local device.
  // - Never broadcast room-wide, never triggered for CPU turns.
  // - Deduplicated: plays exactly once per genuine turn transition across re-renders and timer countdown ticks.
  // - Initial mount and reconnections hydrate the turn reference without playing an alert.
  const lastAlertedTurnKeyRef = useRef<string | null>(null);
  const initialTurnHydratedRef = useRef(false);

  const { turnNumber, currentPlayerUid, status, players } = gameState;

  useEffect(() => {
    if (!userUid) return;

    const currentTurnKey = `${turnNumber}_${currentPlayerUid}`;

    // On initial mount / reconnect, hydrate the current turn key to prevent playing an old alert
    if (!initialTurnHydratedRef.current) {
      initialTurnHydratedRef.current = true;
      lastAlertedTurnKeyRef.current = currentTurnKey;
      return;
    }

    if (lastAlertedTurnKeyRef.current !== currentTurnKey) {
      lastAlertedTurnKeyRef.current = currentTurnKey;

      if (status !== 'COMPLETED' && currentPlayerUid === userUid) {
        const activePlayer = players.find((p) => p.uid === userUid);
        const isCpu = Boolean(activePlayer?.isCpu || activePlayer?.playerType === 'COMPUTER');
        if (activePlayer && !isCpu && !activePlayer.isBankrupt && !activePlayer.isDisqualified) {
          sound.play('TURN_ALERT');
        }
      }
    }
  }, [turnNumber, currentPlayerUid, status, players, userUid]);

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

  // Big "YOUR TURN" banner: shown only on this player's screen from the start of their turn until the
  // dice are rolled (by the player, or automatically when the turn timer runs out).
  const meNow = gameState.players.find((p) => p.uid === userUid);
  const turnKey = `${gameState.gameId}_${gameState.turnNumber}_${gameState.currentPlayerUid}`;
  // Once the player has rolled this turn (Space, dice click or auto-roll) the banner never comes back,
  // even while the roll result is still on its way or after a doubles re-roll.
  const [rolledTurnKey, setRolledTurnKey] = useState<string | null>(null);
  const turnStartRollIdRef = useRef<{ key: string; rollId: string | null } | null>(null);
  if (!turnStartRollIdRef.current || turnStartRollIdRef.current.key !== turnKey) {
    turnStartRollIdRef.current = { key: turnKey, rollId: gameState.dice?.rollId ?? null };
  }
  const rollStartedNow =
    isRolling ||
    Boolean(walkingAnimation) ||
    pendingCommandType === 'ROLL_DICE' ||
    pendingCommandType === 'TRY_DOUBLES' ||
    (gameState.dice?.rollId ?? null) !== turnStartRollIdRef.current.rollId;
  useEffect(() => {
    if (rollStartedNow && gameState.currentPlayerUid === userUid) setRolledTurnKey(turnKey);
  }, [rollStartedNow, turnKey, gameState.currentPlayerUid, userUid]);
  const hasRolledThisTurn = rolledTurnKey === turnKey || rollStartedNow;
  const showYourTurn =
    !hasRolledThisTurn &&
    Boolean(userUid) &&
    gameState.currentPlayerUid === userUid &&
    gameState.status !== 'COMPLETED' &&
    !meNow?.isBankrupt &&
    !meNow?.isDisqualified &&
    (gameState.phase === 'AWAIT_ROLL' || gameState.phase === 'JAIL_DECISION') &&
    !gameState.handoff?.isActive &&
    !gameState.pendingFinancialObligation &&
    !isRolling &&
    !walkingAnimation &&
    (!gameState.movement || gameState.movement.isComplete) &&
    pendingCommandType !== 'ROLL_DICE' &&
    pendingCommandType !== 'TRY_DOUBLES';

  // Central Jail Transition Detection & Center Board Notification
  const prevJailStatusRef = useRef<Record<string, boolean> | null>(null);
  const [jailNotification, setJailNotification] = useState<{
    id: string;
    playerName: string;
  } | null>(null);

  useEffect(() => {
    if (!prevJailStatusRef.current) {
      // First mount or initial reconnect: initialize without triggering notification
      prevJailStatusRef.current = Object.fromEntries(
        gameState.players.map((p) => [p.uid, Boolean(p.inJail)])
      );
      return;
    }

    gameState.players.forEach((p) => {
      const wasJailed = Boolean(prevJailStatusRef.current?.[p.uid]);
      const nowJailed = Boolean(p.inJail);

      if (!wasJailed && nowJailed) {
        // Genuine transition into Central Jail — displayed exclusively at board center over dice
        const notifId = `jail_${p.uid}_${gameState.turnNumber}_${Date.now()}`;
        setJailNotification({ id: notifId, playerName: p.displayName });
      }

      if (prevJailStatusRef.current) {
        prevJailStatusRef.current[p.uid] = nowJailed;
      }
    });
  }, [gameState.players, gameState.turnNumber]);

  useEffect(() => {
    if (!jailNotification) return;
    const timer = setTimeout(() => {
      setJailNotification(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [jailNotification]);

  // Determine which space should have the glowing / zoomed in state-update effect
  const highlightedSpaceIndex =
    walkingAnimation ? walkingAnimation.currentPos : (activePlayer?.position ?? null);

  // Active player location & Pointed Comment Box computations
  const playerPos = activePlayer ? activePlayer.position : 0;
  const playerSpace = BOARD_SPACES[playerPos];
  const playerPropState = gameState.properties[playerPos];

  // Buy / Build / Reacquire prompt: placed next to the tile the player landed on (viewport-clamped)
  const popupRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const popupPos = usePopupPosition(playerPos, popupRef, boardContainerRef);

  // Authoritative bail amount & property terminology
  const authoritativeBail = getAuthoritativeBailAmount(gameState);
  const propertyNoun = getPropertyNoun(playerSpace);

  // Property purchase affordability & unowned eligibility (Requirement 4 & 5)
  const isBankAcquisition = Boolean(
    (playerPropState?.soldToBankReacquisitionCost && playerPropState.soldToBankReacquisitionCost > 0) ||
    (playerPropState?.soldToBankPayout && playerPropState.soldToBankPayout > 0)
  );
  const acquisitionPrice = isBankAcquisition
    ? calculateReacquisitionCost(playerPos, playerPropState)
    : (playerSpace && 'price' in playerSpace ? (playerSpace as { price: number }).price : 0);
  const canAffordCity = (activePlayer?.cash ?? 0) >= acquisitionPrice;

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

  // Build checks (Section 2)
  const isDevelopableCity =
    playerSpace?.type === 'PROPERTY' &&
    playerPropState?.ownerUid === activePlayer?.uid &&
    !playerPropState?.isMortgaged &&
    playerPropState.buildings < 5;

  const currentBuildingsOnSpace = playerPropState?.buildings ?? 0;
  const buildingCost = playerSpace?.type === 'PROPERTY' ? calculateBuildingCost(playerSpace.spaceIndex, currentBuildingsOnSpace) : 0;
  const canAffordBuild = (activePlayer?.cash ?? 0) >= buildingCost && buildingCost > 0;

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
    calculateReacquisitionCost(playerPos, playerPropState);

  const canAffordReacquire = (activePlayer?.cash ?? 0) >= reacquisitionCost;

  const isCpuTurn = Boolean(activePlayer && (activePlayer.isCpu || activePlayer.playerType === 'COMPUTER'));

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
          message: `Insufficient balance to reacquire this ${propertyNoun.toLowerCase()}.`,
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
    propertyNoun,
    gameState.turnNumber,
    playerPos,
    onDispatch,
  ]);

  // Requirement 3.B: Decline action handler with distinct alert feedback tone
  const handleDeclineAction = useCallback(() => {
    sound.play('DECLINE_ACTION');
    onDispatch?.('DECLINE_PROPERTY');
  }, [onDispatch]);

  // Requirement 3.A: Alert tone for Property/City Purchase Prompt
  const lastPurchasePromptKeyRef = useRef<string | null>(null);

  const isShowingPurchasePrompt = Boolean(
    isMyTurn &&
    !isCpuTurn &&
    isPropertyDecision &&
    isUnownedPurchasable &&
    canAffordCity &&
    playerSpace &&
    'price' in playerSpace
  );

  useEffect(() => {
    if (!isShowingPurchasePrompt) return;

    const promptKey = `${gameState.turnNumber}_${playerPos}_purchase`;
    if (lastPurchasePromptKeyRef.current !== promptKey) {
      lastPurchasePromptKeyRef.current = promptKey;
      sound.play('PURCHASE_PROMPT');
    }
  }, [isShowingPurchasePrompt, gameState.turnNumber, playerPos]);

  // Requirement 1: Global gameplay context-sensitive keyboard shortcuts (Space, S, Enter, N)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Never trigger on repeated keys (holding key down)
      if (e.repeat) return;

      // 2. Ignore when typing inside input fields, textareas, selects, or content-editable elements
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.getAttribute?.('role') === 'textbox')
      ) {
        return;
      }

      // 3. Do not trigger when rules modal or external dialog is open
      if (document.getElementById('rules-modal-title')) return;

      // 4. Keyboard shortcuts only active for local human player holding the current turn
      if (!isMyTurn || isCpuTurn) return;

      // 5. Read-only board inspection mode suppresses gameplay actions
      if (isBoardInspecting) return;

      const canAct =
        !isRolling &&
        !walkingAnimation &&
        !gameState.handoff?.isActive &&
        (!gameState.movement || gameState.movement.isComplete);

      // --- Spacebar: Context-Sensitive Roll / Try Double / End Turn ---
      if (e.code === 'Space') {
        // Prevent default spacebar scrolling whenever holding the active turn
        e.preventDefault();

        if (canAct) {
          // Context 1: Roll dice during roll phase
          if (gameState.phase === 'AWAIT_ROLL') {
            onRollDice?.();
            return;
          }

          // Context 2: Try Double while in Central Jail
          if (gameState.phase === 'JAIL_DECISION') {
            onDispatch?.('TRY_DOUBLES');
            return;
          }

          // Context 3: End turn when eligible (cannot bypass unresolved mandatory decision popup or build opportunity)
          if (gameState.phase === 'MANAGEMENT' || gameState.phase === 'TURN_END') {
            if (canBuildHere || isShowingPurchasePrompt || (isOwnMortgagedCity && canAffordReacquire)) {
              return;
            }
            onDispatch?.('END_TURN');
            return;
          }
        }
        return;
      }

      // --- S: Sell to Bank ---
      if (e.key === 's' || e.key === 'S') {
        if (canAct) {
          if (!voluntaryMortgageOpen && myMortgageableProperties.length > 0) {
            e.preventDefault();
            setVoluntaryMortgageOpen(true);
            return;
          }
        }
      }

      // --- Enter: Context-Sensitive Accept / Bail / Build House/Tower ---
      if (e.key === 'Enter') {
        if (canAct) {
          // Context 1: Build House / Tower when building prompt is actively available
          if (canBuildHere && playerSpace?.type === 'PROPERTY') {
            e.preventDefault();
            onDispatch?.('BUILD', { spaceIndex: playerPos });
            return;
          }

          // Context 2: Central Jail Bail (Use Card or Pay Bail)
          if (gameState.phase === 'JAIL_DECISION') {
            e.preventDefault();
            if (activePlayer?.jailFreeCards && activePlayer.jailFreeCards > 0) {
              onDispatch?.('USE_JAIL_CARD');
            } else if (activePlayer && activePlayer.cash >= authoritativeBail) {
              onDispatch?.('PAY_BAIL');
            }
            return;
          }

          // Context 3: Accept Property Purchase Prompt
          if (isShowingPurchasePrompt) {
            e.preventDefault();
            onDispatch?.('BUY_PROPERTY', { spaceIndex: playerPos });
            return;
          }

          // Context 4: Accept Reacquire Mortgaged Property from Bank
          if (isOwnMortgagedCity && canAffordReacquire) {
            e.preventDefault();
            onDispatch?.('UNMORTGAGE', {
              spaceIndex: playerPos,
              landingId: gameState.reacquisitionOpportunity?.landingId,
            });
            return;
          }
        }
        return;
      }

      // --- N: Context-Sensitive Decline / Done ---
      if (e.key === 'n' || e.key === 'N') {
        if (canAct) {
          // A. Decline Property Purchase Prompt
          if (isShowingPurchasePrompt) {
            e.preventDefault();
            handleDeclineAction();
            return;
          }

          // B. Decline Reacquire from Bank
          if (isOwnMortgagedCity && canAffordReacquire) {
            e.preventDefault();
            handleDeclineAction();
            return;
          }

          // C. Skip Building (Done building for this turn) - performs exact same action as clicking Done
          if (canBuildHere && playerSpace?.type === 'PROPERTY') {
            e.preventDefault();
            onDispatch?.('END_TURN', { confirmBuildSkip: true });
            return;
          }
        }

        // D. Close voluntary mortgage modal if open
        if (voluntaryMortgageOpen) {
          e.preventDefault();
          setVoluntaryMortgageOpen(false);
          return;
        }

        // E. Close card inspection modal if open
        if (inspectedCard) {
          e.preventDefault();
          setInspectedCard(null);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isMyTurn,
    isCpuTurn,
    isBoardInspecting,
    isRolling,
    walkingAnimation,
    gameState.handoff?.isActive,
    gameState.movement,
    gameState.phase,
    gameState.reacquisitionOpportunity?.landingId,
    onRollDice,
    onDispatch,
    isShowingPurchasePrompt,
    playerPos,
    isOwnMortgagedCity,
    canAffordReacquire,
    canBuildHere,
    playerSpace,
    voluntaryMortgageOpen,
    myMortgageableProperties.length,
    activePlayer,
    authoritativeBail,
    inspectedCard,
    handleDeclineAction,
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

  // Turn-level idle state: no pawn movement, handoff or board inspection in progress
  const isTurnIdle =
    !walkingAnimation && !gameState.handoff?.isActive && (!gameState.movement || gameState.movement.isComplete);
  // The dice are the roll control: a normal roll, or "roll for doubles" while in Central Jail
  const canClickDiceToRoll =
    isMyTurn &&
    (gameState.phase === 'AWAIT_ROLL' || gameState.phase === 'JAIL_DECISION') &&
    !isRolling &&
    pendingCommandType !== 'ROLL_DICE' &&
    pendingCommandType !== 'TRY_DOUBLES' &&
    isTurnIdle &&
    !isBoardInspecting;
  const handleDiceClick = () => {
    if (gameState.phase === 'JAIL_DECISION') onDispatch?.('TRY_DOUBLES');
    else onRollDice?.();
  };
  // Sell to Bank stays available for the whole turn: before rolling (incl. jail) and after rolling until END TURN
  const showSellToBank =
    isMyTurn &&
    isTurnIdle &&
    myMortgageableProperties.length > 0 &&
    ['AWAIT_ROLL', 'JAIL_DECISION', 'PROPERTY_DECISION', 'MANAGEMENT', 'TURN_END'].includes(gameState.phase);
  const activeTurnName = activePlayer?.displayName || '—';
  const sellToBankButton = showSellToBank ? (
    <button
      type="button"
      data-testid="sell-to-bank-btn"
      onClick={() => setVoluntaryMortgageOpen(true)}
      className={cn(CONTROL_BUTTON_CLASS, 'text-amber-200 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 cursor-pointer')}
    >
      <Landmark className="w-3.5 h-3.5" />
      <span>Sell to Bank</span>
    </button>
  ) : null;

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
                        style={avatarBg(p, p.colorToken)}
                        data-testid={`board-token-${p.uid}`}
                        className={
                          p.avatarEmoji
                            ? // Emoji avatar: the emoji alone, no circle, border, ring or glow
                              cn(
                                'w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-lg sm:text-xl leading-none shrink-0 transition-transform duration-150',
                                isWalkingThisPawn && 'scale-125 animate-bounce',
                                isActivePawn && !isWalkingThisPawn && 'animate-pulse scale-110'
                              )
                            : cn(
                                'w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white shadow-token-glow flex items-center justify-center text-[9px] sm:text-[10px] text-white font-black shrink-0 transition-transform duration-150',
                                isWalkingThisPawn && 'scale-125 ring-2 ring-amber-400 animate-bounce',
                                isActivePawn && !isWalkingThisPawn && 'animate-pulse scale-105 ring-1 ring-white'
                              )
                        }
                      >
                        {avatarLabel(p)}
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
          {/* Middle Row: Civic Fund Indexed List, 3D Dice Rolling Arena, and Market Buzz Indexed List */}
          <div className="w-full flex-1 flex items-stretch justify-between gap-1.5 sm:gap-3 my-auto z-10 px-1 sm:px-2 min-h-0">
            {/* Panel 1: Civic Fund (All 11 Community Treasury Rules Indexed 2..12 — Desktop: visible; Mobile: compact drawer) */}
            <div className="hidden md:flex md:w-[37%] max-w-[280px] min-w-[112px] h-full rounded-xl bg-gradient-to-br from-indian-terracotta-800 via-amber-950 to-stone-900 text-white p-1.5 border-2 border-amber-400/80 shadow-xl flex-col justify-between overflow-hidden shrink">
              <div className="flex items-center justify-between border-b border-amber-300/40 pb-0.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-amber-300" />
                  <span className="font-serif font-black text-[10px] sm:text-[11px] md:text-[12.5px] tracking-wide text-amber-100 uppercase">
                    CIVIC FUND
                  </span>
                </div>
                <span className="text-[7.5px] sm:text-[8.5px] font-black text-amber-300 bg-amber-900/80 px-1.5 py-0.2 rounded border border-amber-400/40 shadow-2xs">
                  11 Rules
                </span>
              </div>

              {/* All 11 Rules Listed Simultaneously (No Scrollbar, Increased Font Size) */}
              <div className="flex-1 flex flex-col justify-between py-0.5 select-none overflow-hidden min-h-0">
                {CIVIC_FUND_CARDS.map((card, idx) => {
                  const ruleNum = idx + 2;
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
                      {(() => {
                        const effect = getCardFinancialEffect(card);
                        if (card.amount) {
                          if (effect === 'LOSS') {
                            return (
                              <span className="shrink-0 text-[8.5px] sm:text-[9.5px] md:text-[10px] font-black text-red-400 ml-1">
                                - ₹{Math.abs(card.amount).toLocaleString('en-IN')}
                              </span>
                            );
                          }
                          if (effect === 'GAIN') {
                            return (
                              <span className="shrink-0 text-[8.5px] sm:text-[9.5px] md:text-[10px] font-black text-emerald-300 ml-1">
                                + ₹{card.amount.toLocaleString('en-IN')}
                              </span>
                            );
                          }
                          return (
                            <span className="shrink-0 text-[8.5px] sm:text-[9.5px] md:text-[10px] font-black text-amber-300 ml-1">
                              ₹{card.amount.toLocaleString('en-IN')}
                            </span>
                          );
                        }
                        return (
                          <span className="shrink-0 text-[8px] sm:text-[9px] font-bold text-amber-300/90 ml-1">
                            {ruleNum === 9 ? 'Jail Pass' : (ruleNum === 10 ? 'To Jail' : '')}
                          </span>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              <div className="text-[7px] sm:text-[8px] text-amber-200/90 font-black tracking-wider text-center border-t border-amber-300/30 pt-0.5 shrink-0 uppercase">
                COMMUNITY TREASURY
              </div>
            </div>

            {/* In-Board Dice Roll Arena: Symmetrically Centered 3D Dice & Controls */}
            <div className="flex-1 flex flex-col items-center z-20 min-w-[200px] shrink-0 min-h-0 h-full px-1 [perspective:1000px] w-full max-w-sm mx-auto">
              {/* Top slot (white space above the dice): turn, ping, mobile rule buttons */}
              <div className="flex-1 basis-0 min-h-0 w-full flex flex-col items-center justify-end gap-1 pb-1.5">
              {/* Area above the ping: Turn label, with the YOUR TURN banner on top of it when it is my turn */}
              <div className="relative flex-1 min-h-0 w-full flex flex-col items-center justify-end">
              <div
                data-testid="board-turn-label"
                className="max-w-full truncate text-[11px] sm:text-xs font-bold text-indian-navy-900 dark:text-indian-parchment-100"
                title={`Turn: ${activeTurnName}`}
              >
                Turn: <span className="font-black text-indian-terracotta-600 dark:text-amber-300">{activeTurnName}</span>
              </div>
              {showYourTurn && (
                <div
                  key={turnKey}
                  data-testid="your-turn-banner"
                  aria-live="assertive"
                  className="absolute inset-x-0 bottom-0 z-[60] flex items-end justify-center pointer-events-none"
                >
                  <div className="animate-scale-in px-4 py-1.5 sm:px-6 sm:py-2 rounded-2xl bg-gradient-to-br from-indian-terracotta-500/95 to-amber-500/95 border-[3px] border-white shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                    <span className="block font-serif font-black text-2xl sm:text-3xl lg:text-4xl tracking-wider text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.4)] whitespace-nowrap">
                      YOUR TURN
                    </span>
                  </div>
                </div>
              )}
              </div>
              <PingIndicator variant="inline" />
              {/* Mobile Quick-Rule Access Buttons */}
              <div className="md:hidden flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setInspectedCard(CIVIC_FUND_CARDS[0])}
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-200 bg-amber-950/80 border border-amber-500/50 flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Gift className="w-2.5 h-2.5 text-amber-300" />
                  <span>Civic Fund (11)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectedCard(MARKET_BUZZ_CARDS[0])}
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold text-emerald-200 bg-emerald-950/80 border border-emerald-500/50 flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Flame className="w-2.5 h-2.5 text-emerald-300" />
                  <span>Market Buzz (11)</span>
                </button>
              </div>
              </div>

              {/* Dice, rolled total and turn controls */}
              <div className="shrink-0 flex flex-col items-center gap-1.5 sm:gap-2">

              {/* Interactive 3D Tumbling Dice with Authentic Perspective Roll Effect */}
              <div
                data-testid="board-dice-container"
                onClick={canClickDiceToRoll ? handleDiceClick : undefined}
                role={canClickDiceToRoll ? 'button' : undefined}
                aria-label={canClickDiceToRoll ? (gameState.phase === 'JAIL_DECISION' ? 'Roll for doubles' : 'Roll the dice') : undefined}
                title={canClickDiceToRoll ? (gameState.phase === 'JAIL_DECISION' ? 'Click the dice to roll for doubles (Space)' : 'Click the dice to roll (Space)') : undefined}
                className={cn(
                  'relative flex items-center justify-center gap-2.5 sm:gap-3.5 transition-all p-2 rounded-2xl min-h-[44px]',
                  canClickDiceToRoll
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

                {/* Explicit Positioning Anchor for Board Inspection Mode & Central Jail Notification */}
                <div
                  id="board-inspection-dice-anchor"
                  data-testid="board-inspection-dice-anchor"
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-[130]"
                >
                  {/* Central Jail notice: the only pop-up shown in front of the dice (absolute, so nothing moves) */}
                {jailNotification && !isBoardInspecting && (
                    <div className="pointer-events-auto shrink-0 select-none z-[135]">
                      <div
                        data-testid="jail-center-notification"
                        className="animate-scale-in w-[250px] max-w-[90vw] p-2.5 rounded-2xl bg-[#090D1A] border-2 border-red-500 shadow-[0_16px_40px_rgba(0,0,0,0.95)] text-white flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded-xl bg-red-600/30 border border-red-500/60 flex items-center justify-center text-red-400 shrink-0">
                          <ShieldAlert className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9.5px] uppercase font-black tracking-wider text-red-400 block leading-tight">
                            CENTRAL JAIL
                          </span>
                          <p className="text-[11.5px] sm:text-xs font-bold text-gray-100 leading-tight truncate mt-0.5">
                            {jailNotification.playerName} sent to Central Jail
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setJailNotification(null)}
                          className="w-5 h-5 rounded-md hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer shrink-0"
                          aria-label="Dismiss jail notification"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Center Controls row: FIXED height so the dice, turn label and ping above never move.
                  The dice themselves are the roll control. */}
              <div data-testid="board-controls-row" className="h-[84px] w-full shrink-0 flex items-center justify-center">
              {isMyTurn && (gameState.phase === 'AWAIT_ROLL' || gameState.phase === 'PROPERTY_DECISION') && isTurnIdle ? (
                sellToBankButton
              ) : isMyTurn && (gameState.phase === 'MANAGEMENT' || gameState.phase === 'TURN_END') && isTurnIdle ? (
                <div className="flex items-center justify-center gap-1.5">
                  {sellToBankButton}
                  {!(canBuildHere || isShowingPurchasePrompt || (isOwnMortgagedCity && canAffordReacquire)) && (
                    <button
                      type="button"
                      disabled={pendingCommandType === 'END_TURN'}
                      onClick={() => onDispatch?.('END_TURN')}
                      className={cn(
                        CONTROL_BUTTON_CLASS,
                        'text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border border-emerald-400',
                        pendingCommandType === 'END_TURN' ? 'opacity-75 cursor-wait' : 'cursor-pointer'
                      )}
                    >
                      <span>{pendingCommandType === 'END_TURN' ? 'Ending...' : 'END TURN'}</span>
                      <ArrowRight className={cn('w-3.5 h-3.5', pendingCommandType === 'END_TURN' && 'animate-pulse')} />
                    </button>
                  )}
                </div>
              ) : isMyTurn && gameState.phase === 'JAIL_DECISION' && isTurnIdle ? (
                <div className="grid grid-cols-2 gap-1.5 w-full max-w-[260px]">
                  {Boolean(activePlayer?.jailFreeCards && activePlayer.jailFreeCards > 0) && (
                    <button
                      type="button"
                      disabled={pendingCommandType === 'USE_JAIL_CARD'}
                      onClick={() => onDispatch?.('USE_JAIL_CARD')}
                      className={cn(CONTROL_BUTTON_CLASS, 'w-full text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400 cursor-pointer')}
                      title="Use your Get Out of Jail card to leave Central Jail immediately (strictly non-tradable)"
                    >
                      <KeyRound className="w-3.5 h-3.5 shrink-0 text-emerald-200" />
                      <span className="truncate">{pendingCommandType === 'USE_JAIL_CARD' ? 'Using...' : `Jail Card (${activePlayer?.jailFreeCards})`}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDispatch?.('PAY_BAIL')}
                    disabled={pendingCommandType === 'PAY_BAIL' || (activePlayer ? activePlayer.cash < authoritativeBail : false)}
                    className={cn(
                      CONTROL_BUTTON_CLASS,
                      'w-full text-white',
                      activePlayer && activePlayer.cash < authoritativeBail
                        ? 'bg-gray-500 opacity-60 cursor-not-allowed'
                        : pendingCommandType === 'PAY_BAIL'
                        ? 'bg-red-700 opacity-80 cursor-wait'
                        : 'bg-red-600 hover:bg-red-500 cursor-pointer'
                    )}
                  >
                    <KeyRound className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{pendingCommandType === 'PAY_BAIL' ? 'Paying...' : `Pay ₹${authoritativeBail.toLocaleString('en-IN')} Bail`}</span>
                  </button>
                  {sellToBankButton && <div className="w-full [&>button]:w-full">{sellToBankButton}</div>}
                </div>
              ) : null}
              </div>
              </div>

              {/* Bottom slot (white space below the dice): low-balance settlement card and
                  notifications. Contained and scrollable so nothing spills over the board. */}
              <div
                data-testid="board-notice-area"
                className="flex-1 basis-0 min-h-0 w-full max-w-[300px] flex flex-col items-stretch gap-1.5 py-1.5 overflow-y-auto overflow-x-hidden no-scrollbar"
              >
                {/* my-auto centres the notices vertically in the free space while still scrolling when it overflows */}
                <div className="my-auto w-full flex flex-col items-stretch gap-1.5">
                {/* Low-balance settlement card for other players (portal target) */}
                <div id="board-notice-slot" data-testid="board-notice-slot" className="w-full empty:hidden" />
                <ToastContainer variant="inline" />
                </div>
              </div>
            </div>

            {/* Panel 2: Market Buzz (All 11 Fortune & Chance Rules Indexed 2..12 — Desktop: visible; Mobile: compact drawer) */}
            <div className="hidden md:flex md:w-[37%] max-w-[280px] min-w-[112px] h-full rounded-xl bg-gradient-to-br from-teal-900 via-emerald-950 to-stone-900 text-white p-1.5 border-2 border-emerald-400/80 shadow-xl flex-col justify-between overflow-hidden shrink">
              <div className="flex items-center justify-between border-b border-emerald-300/40 pb-0.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="font-serif font-black text-[10px] sm:text-[11px] md:text-[12.5px] tracking-wide text-emerald-100 uppercase">
                    MARKET BUZZ
                  </span>
                </div>
                <span className="text-[7.5px] sm:text-[8.5px] font-black text-emerald-300 bg-emerald-900/80 px-1.5 py-0.2 rounded border border-emerald-400/40 shadow-2xs">
                  11 Rules
                </span>
              </div>

              {/* All 11 Rules Listed Simultaneously (No Scrollbar, Increased Font Size) */}
              <div className="flex-1 flex flex-col justify-between py-0.5 select-none overflow-hidden min-h-0">
                {MARKET_BUZZ_CARDS.map((card, idx) => {
                  const ruleNum = idx + 2;
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
                      {(() => {
                        const effect = getCardFinancialEffect(card);
                        if (card.amount && card.actionType !== 'MOVE_RELATIVE') {
                          if (effect === 'LOSS') {
                            return (
                              <span className="shrink-0 text-[8.5px] sm:text-[9.5px] md:text-[10px] font-black text-red-400 ml-1">
                                - ₹{Math.abs(card.amount).toLocaleString('en-IN')}
                              </span>
                            );
                          }
                          if (effect === 'GAIN') {
                            return (
                              <span className="shrink-0 text-[8.5px] sm:text-[9.5px] md:text-[10px] font-black text-emerald-300 ml-1">
                                + ₹{card.amount.toLocaleString('en-IN')}
                              </span>
                            );
                          }
                        }
                        return (
                          <span className="shrink-0 text-[8px] sm:text-[9px] font-bold text-teal-300/90 ml-1">
                            {ruleNum === 5 ? '-3 Spaces' : (ruleNum === 9 ? 'To Jail' : (ruleNum === 2 ? 'To Start' : (ruleNum === 3 ? 'To CP' : (ruleNum === 12 ? 'To Marine' : ''))))}
                          </span>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              <div className="text-[7px] sm:text-[8px] text-teal-200/90 font-black tracking-wider text-center border-t border-emerald-300/30 pt-0.5 shrink-0 uppercase">
                FORTUNE & CHANCE
              </div>
            </div>
          </div>
        </div>

      </div>

        {/* Buy / Build / Reacquire prompt: rendered at the top layer (portal) next to the landed tile so it is never hidden under other elements */}
        {((isPropertyDecision && isUnownedPurchasable && canAffordCity) ||
          (isCpuTurn && gameState.phase === 'PROPERTY_DECISION' && !walkingAnimation && isUnownedPurchasable) ||
          canBuildHere ||
          (isOwnMortgagedCity && canAffordReacquire)) &&
          typeof document !== 'undefined' &&
          createPortal(
          <div
            ref={popupRef}
            data-testid="board-decision-popup"
            style={popupPos.style}
            className="w-64 sm:w-72 p-3 rounded-2xl bg-[#070A12]/95 text-white border-2 border-amber-400 shadow-[0_12px_36px_rgba(0,0,0,0.85)] flex flex-col gap-2.5 animate-scale-in text-xs backdrop-blur-md"
          >
            {/* Pointer arrow towards the landed tile */}
            <div
              style={popupPos.arrowStyle}
              className={cn(
                'w-0 h-0',
                popupPos.placement === 'top' &&
                  'border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-amber-400',
                popupPos.placement === 'bottom' &&
                  'border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-amber-400',
                popupPos.placement === 'right' &&
                  'border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-amber-400',
                popupPos.placement === 'left' &&
                  'border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[8px] border-l-amber-400'
              )}
              data-testid="board-decision-popup-arrow"
              data-placement={popupPos.placement}
            />

            {/* Pointed Box Content: CPU Property Decision View */}
            {isCpuTurn && gameState.phase === 'PROPERTY_DECISION' && isUnownedPurchasable && playerSpace && 'price' in playerSpace && (
              <>
                <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                  <span className="font-serif font-black text-xs text-amber-200">
                    {isBankAcquisition ? `🏛️ Acquire ${propertyNoun}?` : `🏙️ Buy ${propertyNoun}?`}
                  </span>
                  <span className="font-black text-emerald-400 text-xs">
                    ₹{acquisitionPrice.toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-[11px] text-gray-200 leading-tight">
                  <strong className="text-white">{activePlayer?.displayName} (CPU)</strong> is evaluating {isBankAcquisition ? 'acquisition of' : 'purchasing'} <strong className="text-white">{playerSpace.name}</strong> for ₹{acquisitionPrice.toLocaleString('en-IN')}.
                </p>
                <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center gap-1.5 text-blue-300 font-bold text-[11px]">
                  <Bot className="w-3.5 h-3.5 animate-pulse" />
                  <span>{activePlayer?.displayName} is deciding...</span>
                </div>
              </>
            )}

            {/* Pointed Box Content: Buy / Acquire Property Prompt */}
              {isPropertyDecision && isUnownedPurchasable && canAffordCity && 'price' in playerSpace && (
                <>
                  <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                    <span className="font-serif font-black text-xs text-amber-200">
                      {isBankAcquisition ? `🏛️ Acquire ${propertyNoun}?` : `🏙️ Buy ${propertyNoun}?`}
                    </span>
                    <span className="font-black text-emerald-400 text-xs">
                      ₹{acquisitionPrice.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-200 leading-tight">
                    {isBankAcquisition ? (
                      <>
                        Acquire <strong className="text-white">{playerSpace.name}</strong> from bank for ₹{acquisitionPrice.toLocaleString('en-IN')}? All existing developments are preserved!
                      </>
                    ) : (
                      <>
                        Acquire <strong className="text-white">{playerSpace.name}</strong> for ₹{playerSpace.price.toLocaleString('en-IN')}? (Bank Sale Payout: ₹{calculateMortgageValue(playerPos, playerPropState).toLocaleString('en-IN')})
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      data-testid="buy-property-btn"
                      disabled={pendingCommandType === 'BUY_PROPERTY'}
                      onClick={() => onDispatch?.('BUY_PROPERTY', { spaceIndex: playerPos })}
                      className={cn(
                        "flex-1 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1 min-h-[44px]",
                        pendingCommandType === 'BUY_PROPERTY' ? "opacity-75 cursor-wait" : "cursor-pointer"
                      )}
                    >
                      <Check className={cn("w-3.5 h-3.5", pendingCommandType === 'BUY_PROPERTY' && "animate-spin")} />
                      <span>{pendingCommandType === 'BUY_PROPERTY' ? 'Purchasing...' : isBankAcquisition ? `Acquire ${propertyNoun}` : `Buy ${propertyNoun}`}</span>
                    </button>
                    <button
                      type="button"
                      data-testid="decline-property-btn"
                      disabled={pendingCommandType === 'DECLINE_PROPERTY'}
                      onClick={handleDeclineAction}
                      className={cn(
                        "px-3.5 py-2 rounded-xl font-bold text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 active:scale-95 transition-all min-h-[44px]",
                        pendingCommandType === 'DECLINE_PROPERTY' ? "opacity-75 cursor-wait" : "cursor-pointer"
                      )}
                    >
                      {pendingCommandType === 'DECLINE_PROPERTY' ? 'Declining...' : 'Decline'}
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
                      ₹{buildingCost.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-200 leading-tight">
                    Construct {playerPropState?.buildings === 4 ? 'Commercial Tower' : `House #${(playerPropState?.buildings ?? 0) + 1}`} on <strong className="text-white">{playerSpace.name}</strong>?
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      disabled={pendingCommandType === 'BUILD'}
                      onClick={() => onDispatch?.('BUILD', { spaceIndex: playerPos })}
                      className={cn(
                        "flex-1 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1 min-h-[44px]",
                        pendingCommandType === 'BUILD' ? "opacity-75 cursor-wait" : "cursor-pointer"
                      )}
                    >
                      <Check className={cn("w-3.5 h-3.5", pendingCommandType === 'BUILD' && "animate-spin")} />
                      <span>{pendingCommandType === 'BUILD' ? 'Building...' : playerPropState?.buildings === 4 ? 'Build Tower' : 'Build House'}</span>
                    </button>
                    <button
                      type="button"
                      data-testid="build-done-btn"
                      title="Skip building and end turn (Shortcut: N)"
                      disabled={pendingCommandType === 'END_TURN'}
                      onClick={() => onDispatch?.('END_TURN', { confirmBuildSkip: true })}
                      className={cn(
                        "px-3.5 py-2 rounded-xl font-bold text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 active:scale-95 transition-all min-h-[44px]",
                        pendingCommandType === 'END_TURN' ? "opacity-75 cursor-wait" : "cursor-pointer"
                      )}
                    >
                      {pendingCommandType === 'END_TURN' ? 'Ending...' : 'Done'}
                    </button>
                  </div>
                </>
              )}

              {/* Pointed Box Content: Reacquire Property from Bank Prompt */}
              {isOwnMortgagedCity && canAffordReacquire && (
                <>
                  <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                    <span className="font-serif font-black text-xs text-amber-200">
                      Reacquire {propertyNoun} from Bank?
                    </span>
                    <span className="font-black text-emerald-400 text-xs">
                      ₹{reacquisitionCost.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-200 leading-tight">
                    Reacquire <strong className="text-white">{playerSpace.name}</strong> from the bank for ₹{reacquisitionCost.toLocaleString('en-IN')}? All existing developments are preserved and rent collection will resume.
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      data-testid="reacquire-confirm-btn"
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
                      data-testid="reacquire-decline-btn"
                      onClick={handleDeclineAction}
                      className="px-3.5 py-2 rounded-xl font-bold text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 active:scale-95 transition-all cursor-pointer min-h-[44px]"
                    >
                      Decline
                    </button>
                  </div>
                </>
              )}
          </div>,
            document.body
          )}

      {/* MANDATORY FINANCIAL RESOLUTION WINDOW (Section 6) */}
      {gameState.pendingFinancialObligation && (
        <FinancialResolutionModal
          obligation={gameState.pendingFinancialObligation}
          players={gameState.players}
          properties={gameState.properties}
          currentUserUid={userUid || 'player_1'}
          currentPlayerUid={gameState.currentPlayerUid}
          turnTimeRemaining={gameState.turnTimeRemaining}
          onDispatch={onDispatch}
          onInspectionModeChange={setIsBoardInspecting}
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
                    Sell Properties to Bank (Raise Capital)
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-300">
                      Selling a property to the bank pays its payout value and makes it available for acquisition
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
                  Select Property to Sell to Bank ({myMortgageableProperties.length})
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{gameState.turnTimeRemaining ?? 30}s timer</span>
                </span>
              </div>

              {myMortgageableProperties.map(({ spaceIndex, space, prop, mortgageVal, maxTariff }) => (
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
                      <span className="text-[10px] text-gray-400 block uppercase font-mono">
                        Max Tariff: ₹{maxTariff.toLocaleString('en-IN')}
                      </span>
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
                      Sell to Bank
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-[11px] text-gray-400">
                Properties sold to bank retain existing houses and can be acquired by any player landing on that space.
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
          activePlayerEmoji={activePlayer?.avatarEmoji}
          activePlayerColor={activePlayer?.colorToken}
          turnTimeRemaining={gameState.turnTimeRemaining ?? 30}
          onClose={() => onSelectSpace(null)}
          onDispatch={isBoardInspecting ? undefined : onDispatch}
          readOnly={isBoardInspecting}
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
          activePlayerEmoji={activePlayer?.avatarEmoji}
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

            {inspectedCard.amount && inspectedCard.actionType !== 'MOVE_RELATIVE' && (() => {
              const effect = getCardFinancialEffect(inspectedCard);
              if (effect === 'LOSS') {
                return (
                  <div className="pt-2">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-red-950 text-red-400 border border-red-500/50 shadow-sm">
                      Cost: - ₹{Math.abs(inspectedCard.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              }
              if (effect === 'GAIN') {
                return (
                  <div className="pt-2">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-emerald-950 text-emerald-400 border border-emerald-500/50 shadow-sm">
                      Reward: + ₹{inspectedCard.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              }
              return (
                <div className="pt-2">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-white text-indian-navy-950 shadow-sm">
                    Amount: ₹{inspectedCard.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});
