/**
 * Indian Monopoly - Pure Functional Authoritative Game Engine
 * Evaluates state transitions deterministically with zero side effects.
 */

import {
  AIRPORT_SPACES,
  BOARD_SPACES,
  CIVIC_FUND_CARDS,
  MARKET_BUZZ_CARDS,
  TRANSIT_SPACES,
} from '../board-config';
import {
  CardAction,
  FinancialTransaction,
  FinancialTransactionType,
  GameCommand,
  GameEvent,
  GameState,
  PlayerState,
  PropertyDefinition,
  TransitDefinition,
  UtilityDefinition,
} from '../game-types';
import {
  calculateMortgageValue,
  calculateNetWorth,
  calculateRent,
  canBuildOnProperty,
  GAME_CONSTANTS,
} from '../ruleset';
import { generateFairDicePair } from './dice-fairness';

export class GameEngineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'GameEngineError';
  }
}

export interface EngineResult {
  nextState: GameState;
  event: GameEvent;
}

/**
 * Authoritative ledger recorder. Atomically records financial credits and debits.
 */
function recordTx(
  state: GameState,
  playerUid: string,
  type: FinancialTransactionType,
  direction: 'CREDIT' | 'DEBIT',
  amount: number,
  balanceBefore: number,
  balanceAfter: number,
  description: string,
  extra?: {
    transactionId?: string;
    spaceIndex?: number;
    propertyName?: string;
    counterpartyUid?: string | null;
    counterpartyName?: string | null;
    eventId?: string;
  }
): FinancialTransaction {
  if (!state.transactions) {
    state.transactions = [];
  }
  const transactionId = extra?.transactionId || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tx: FinancialTransaction = {
    transactionId,
    gameSessionId: state.gameId,
    playerUid,
    type,
    direction,
    amount,
    balanceBefore,
    balanceAfter,
    spaceIndex: extra?.spaceIndex,
    propertyName: extra?.propertyName,
    counterpartyUid: extra?.counterpartyUid ?? null,
    counterpartyName: extra?.counterpartyName ?? null,
    description,
    timestamp: Date.now(),
    eventId: extra?.eventId,
  };
  state.transactions.push(tx);
  return tx;
}

export function applyGameCommand(
  currentState: GameState,
  command: GameCommand,
  actorUid: string,
  injectedDice?: [number, number],
  options?: { cardRuleIndex?: number }
): EngineResult {
  // Validate basic state preconditions
  if (currentState.status === 'COMPLETED') {
    throw new GameEngineError('GAME_ALREADY_COMPLETED', 'Game has already concluded');
  }

  if (command.expectedVersion !== currentState.version) {
    // If it's a UI dismiss action or acknowledgment, handle gracefully without rejecting with VERSION_CONFLICT
    if (command.type === 'DISMISS_CARD_POPUP' || command.type === 'DISMISS_MONEY_ACK') {
      const state: GameState = JSON.parse(JSON.stringify(currentState));
      if (command.type === 'DISMISS_CARD_POPUP') state.activeCardPopup = null;
      if (command.type === 'DISMISS_MONEY_ACK') state.activeMoneyTransaction = null;
      return {
        nextState: state,
        event: {
          sequence: state.version,
          commandId: command.commandId,
          actorUid,
          type: command.type,
          summary: 'Dismissed acknowledgment',
          payload: {},
          createdAt: Date.now(),
          versionAfter: state.version,
        },
      };
    }

    throw new GameEngineError(
      'VERSION_CONFLICT',
      `Stale version (client expected ${command.expectedVersion}, current is ${currentState.version})`,
      true
    );
  }

  // Clone state immutably for atomic transition
  const state: GameState = JSON.parse(JSON.stringify(currentState));
  let summary = '';
  let eventPayload: Record<string, unknown> = {};

  switch (command.type) {
    case 'ROLL_DICE': {
      if (actorUid !== state.currentPlayerUid) {
        throw new GameEngineError('NOT_YOUR_TURN', 'It is not your turn to roll');
      }
      if (state.phase !== 'AWAIT_ROLL') {
        throw new GameEngineError('INVALID_PHASE', `Cannot roll in phase ${state.phase}`);
      }

      const player = state.players.find((p) => p.uid === actorUid);
      if (!player || player.isBankrupt) {
        throw new GameEngineError('INVALID_ACTION', 'Player is inactive or bankrupt');
      }

      if (player.inJail) {
        throw new GameEngineError('INVALID_ACTION', 'Must resolve jail status before normal roll');
      }

      // Clear any prior turn transient alerts
      state.activeMoneyTransaction = null;
      state.activeCardPopup = null;

      // Generate fair server dice (1-6) without modulo bias
      const [f1, f2] = injectedDice || generateFairDicePair();
      const d1 = f1;
      const d2 = f2;
      const isDouble = d1 === d2;
      const consecutiveDoubles = isDouble
        ? (state.dice?.consecutiveDoubles ?? 0) + 1
        : 0;

      const rollId =
        'roll_' +
        state.turnNumber +
        '_' +
        Date.now() +
        '_' +
        Math.random().toString(36).slice(2, 8);

      state.dice = {
        rollId,
        first: d1,
        second: d2,
        isDouble,
        consecutiveDoubles,
        rolledAt: Date.now(),
      };

      summary = `${player.displayName} rolled ${d1} + ${d2} = ${d1 + d2}${isDouble ? ' (Doubles!)' : ''}`;
      eventPayload = { rollId, d1, d2, isDouble, consecutiveDoubles };

      // Three consecutive doubles sends player directly to Central Jail
      if (consecutiveDoubles >= 3) {
        player.inJail = true;
        player.jailTurns = 0;
        player.position = 10;
        state.phase = 'TURN_END';
        summary += ` — 3 consecutive doubles! Sent to Central Jail!`;
        break;
      }

      // Normal movement
      const oldPos = player.position;
      const steps = d1 + d2;
      const newPos = (oldPos + steps) % 40;
      player.position = newPos;

      // Passing or landing on START awards host-configured reward (default ₹2,000)
      const passReward = state.rules?.passStartReward ?? GAME_CONSTANTS.START_REWARD;
      if (newPos < oldPos && oldPos + steps >= 40) {
        const prevCash = player.cash;
        player.cash += passReward;
        recordTx(
          state,
          player.uid,
          'START_REWARD',
          'CREDIT',
          passReward,
          prevCash,
          player.cash,
          `${player.displayName} collected ₹${passReward.toLocaleString('en-IN')} reward for passing START!`
        );
        summary += ` — Passed START, collected ₹${passReward}!`;
        state.activeMoneyTransaction = {
          id: `start_${Date.now()}`,
          type: 'START_REWARD',
          payerName: 'Bank',
          payerUid: 'BANK',
          recipientName: player.displayName,
          recipientUid: player.uid,
          amount: passReward,
          description: `${player.displayName} collected ₹${passReward.toLocaleString('en-IN')} reward for passing START!`,
        };
      }

      // Resolve destination space
      const landingOptions =
        options ??
        (typeof command.payload?.cardRuleIndex === 'number'
          ? { cardRuleIndex: command.payload.cardRuleIndex }
          : undefined);
      resolveLandingSpace(state, player, newPos, d1 + d2, landingOptions);
      break;
    }

    case 'BUY_PROPERTY': {
      if (actorUid !== state.currentPlayerUid) {
        throw new GameEngineError('NOT_YOUR_TURN', 'Only active player can buy property');
      }
      const player = state.players.find((p) => p.uid === actorUid);
      if (!player) throw new GameEngineError('INVALID_ACTION', 'Player not found');

      const space = BOARD_SPACES[player.position];
      if (
        !space ||
        (space.type !== 'PROPERTY' && space.type !== 'TRANSIT' && space.type !== 'UTILITY')
      ) {
        throw new GameEngineError('INVALID_ACTION', 'Current space is not purchasable');
      }

      const propState = state.properties[space.spaceIndex];
      if (propState.ownerUid || propState.ownershipState === 'BLOCKED') {
        throw new GameEngineError('INVALID_ACTION', 'Property is already owned or blocked');
      }

      const price = (space as PropertyDefinition | TransitDefinition | UtilityDefinition).price;
      // Requirement 2.3: Backend validation before processing purchase
      if (player.cash < price) {
        throw new GameEngineError('INSUFFICIENT_FUNDS', 'Insufficient balance to purchase this property.');
      }

      const prevCash = player.cash;
      player.cash -= price;
      propState.ownerUid = player.uid;
      propState.ownershipState = 'OWNED';
      propState.boughtOnTurn = state.turnNumber;
      state.pendingAction = null;
      state.phase = 'MANAGEMENT';

      recordTx(
        state,
        player.uid,
        'CITY_PURCHASE',
        'DEBIT',
        price,
        prevCash,
        player.cash,
        `${player.displayName} purchased ${space.name} for ₹${price.toLocaleString('en-IN')}.`,
        { spaceIndex: space.spaceIndex, propertyName: space.name }
      );

      state.activeMoneyTransaction = {
        id: `buy_${Date.now()}`,
        type: 'BUY_PROPERTY',
        payerName: player.displayName,
        payerUid: player.uid,
        recipientName: 'Bank',
        recipientUid: 'BANK',
        amount: price,
        description: `${player.displayName} purchased ${space.name} for ₹${price.toLocaleString('en-IN')}.`,
      };

      summary = `${player.displayName} bought ${space.name} for ₹${price}`;
      eventPayload = { spaceIndex: space.spaceIndex, price };
      break;
    }

    case 'DECLINE_PROPERTY':
    case 'DECLINE_REACQUISITION': {
      if (actorUid !== state.currentPlayerUid) {
        throw new GameEngineError('NOT_YOUR_TURN', 'Only active player can decline');
      }
      const player = state.players.find((p) => p.uid === actorUid);
      if (state.reacquisitionOpportunity && state.reacquisitionOpportunity.spaceIndex === player?.position) {
        state.reacquisitionOpportunity.status = 'DECLINED';
      }
      state.pendingAction = null;
      state.phase = 'MANAGEMENT';
      summary = `${player?.displayName ?? 'Player'} declined to buy or reacquire property`;
      break;
    }

    case 'PAY_BAIL': {
      const player = state.players.find((p) => p.uid === actorUid);
      const bailAmount = state.rules?.jailBail ?? GAME_CONSTANTS.JAIL_BAIL;
      if (!player || !player.inJail) {
        throw new GameEngineError('INVALID_ACTION', 'Player is not in jail');
      }
      if (player.cash < bailAmount) {
        throw new GameEngineError('INSUFFICIENT_FUNDS', `Need ₹${bailAmount} for bail`);
      }

      const prevCash = player.cash;
      player.cash -= bailAmount;
      player.inJail = false;
      player.jailTurns = 0;
      player.escapedJailThisTurn = false;
      state.phase = 'AWAIT_ROLL';

      recordTx(
        state,
        player.uid,
        'JAIL_PAYMENT',
        'DEBIT',
        bailAmount,
        prevCash,
        player.cash,
        `${player.displayName} paid ₹${bailAmount.toLocaleString('en-IN')} bail and was released from Central Jail.`
      );

      state.activeMoneyTransaction = {
        id: `bail_${Date.now()}`,
        type: 'BAIL',
        payerName: player.displayName,
        payerUid: player.uid,
        recipientName: 'Court / Bank',
        recipientUid: 'BANK',
        amount: bailAmount,
        description: `${player.displayName} paid ₹${bailAmount.toLocaleString('en-IN')} bail and was released from Central Jail.`,
      };
      summary = `${player.displayName} paid ₹${bailAmount} bail and is free`;
      break;
    }

    case 'USE_JAIL_CARD': {
      const player = state.players.find((p) => p.uid === actorUid);
      if (!player || !player.inJail) {
        throw new GameEngineError('INVALID_ACTION', 'Player is not in jail');
      }
      if (player.jailFreeCards <= 0) {
        throw new GameEngineError('INVALID_ACTION', 'No Get Out of Jail Free card available');
      }

      player.jailFreeCards -= 1;
      player.inJail = false;
      player.jailTurns = 0;
      player.escapedJailThisTurn = false;
      state.phase = 'AWAIT_ROLL';
      summary = `${player.displayName} used a Get Out of Jail Free card!`;
      break;
    }

    case 'TRY_DOUBLES': {
      const player = state.players.find((p) => p.uid === actorUid);
      if (!player || !player.inJail) {
        throw new GameEngineError('INVALID_ACTION', 'Player is not in jail');
      }

      const [f1, f2] = injectedDice || generateFairDicePair();
      const d1 = f1;
      const d2 = f2;
      const isDouble = d1 === d2;

      const rollId =
        'roll_jail_' +
        state.turnNumber +
        '_' +
        Date.now() +
        '_' +
        Math.random().toString(36).slice(2, 8);

      state.dice = {
        rollId,
        first: d1,
        second: d2,
        isDouble,
        consecutiveDoubles: 0,
        rolledAt: Date.now(),
      };

      summary = `${player.displayName} rolled ${d1} & ${d2} in jail`;

      // Requirement 1.1: If double rolled on attempt 1, 2, or 3:
      // Immediately released, moves according to dice result.
      // Must NOT receive another turn simply because they rolled a double while escaping jail!
      if (isDouble) {
        player.inJail = false;
        player.jailTurns = 0;
        player.escapedJailThisTurn = true;
        player.position = (10 + d1 + d2) % 40;
        summary += ' — Doubles! Released from jail!';
        resolveLandingSpace(state, player, player.position, d1 + d2);
      } else {
        // Failed attempt: increment counter, do NOT move
        player.jailTurns += 1;
        player.escapedJailThisTurn = false;
        summary += ` — Not doubles (attempt ${player.jailTurns}/${GAME_CONSTANTS.MAX_JAIL_DOUBLES_ATTEMPTS}). Remains in jail.`;
        state.phase = 'TURN_END';
      }
      break;
    }

    case 'BUILD': {
      const spaceIdx = Number(command.payload.spaceIndex);
      const player = state.players.find((p) => p.uid === actorUid);
      if (!player) throw new GameEngineError('INVALID_ACTION', 'Player not found');

      const space = BOARD_SPACES[spaceIdx] as PropertyDefinition;
      // Requirement 2.2 & 2.3: Validate cash before construction
      if (player.cash < space.buildingCost) {
        throw new GameEngineError('INSUFFICIENT_FUNDS', 'Insufficient balance to build on this property.');
      }

      const check = canBuildOnProperty(
        spaceIdx,
        actorUid,
        state.properties,
        player.cash,
        player.position,
        state.turnNumber
      );
      if (!check.allowed) {
        throw new GameEngineError('INVALID_ACTION', check.reason || 'Cannot build here');
      }

      const prevCash = player.cash;
      player.cash -= space.buildingCost;
      state.properties[spaceIdx].buildings += 1;

      const level = state.properties[spaceIdx].buildings;
      const buildingName = level === 5 ? 'Commercial Tower' : `House #${level}`;
      const txType: FinancialTransactionType = level === 5 ? 'BUILDING_PURCHASE' : 'HOUSE_PURCHASE';

      recordTx(
        state,
        player.uid,
        txType,
        'DEBIT',
        space.buildingCost,
        prevCash,
        player.cash,
        `${player.displayName} constructed ${buildingName} on ${space.name} for ₹${space.buildingCost.toLocaleString('en-IN')}.`,
        { spaceIndex: spaceIdx, propertyName: space.name }
      );

      state.activeMoneyTransaction = {
        id: `build_${Date.now()}`,
        type: 'BUILD',
        payerName: player.displayName,
        payerUid: player.uid,
        recipientName: 'Bank',
        recipientUid: 'BANK',
        amount: space.buildingCost,
        description: `${player.displayName} constructed ${buildingName} on ${space.name} for ₹${space.buildingCost.toLocaleString('en-IN')}.`,
      };
      summary = `${player.displayName} built a ${buildingName} on ${space.name}`;
      eventPayload = { spaceIndex: spaceIdx, level };
      break;
    }

    case 'MORTGAGE': {
      const spaceIdx = Number(command.payload.spaceIndex);
      const player = state.players.find((p) => p.uid === actorUid);
      const propState = state.properties[spaceIdx];
      const space = BOARD_SPACES[spaceIdx];

      // Eligible during player's turn or when facing a pending financial obligation
      const isObligationDebtor = state.pendingFinancialObligation?.debtorUid === actorUid;
      if (actorUid !== state.currentPlayerUid && !isObligationDebtor) {
        throw new GameEngineError('NOT_YOUR_TURN', 'You can only mortgage properties during your turn or debt resolution');
      }
      if (!player) throw new GameEngineError('INVALID_ACTION', 'Player not found');
      if (!propState || propState.ownerUid !== actorUid) {
        throw new GameEngineError('INVALID_ACTION', 'You do not own this property');
      }
      if (propState.isMortgaged || propState.ownershipState === 'MORTGAGED') {
        throw new GameEngineError('INVALID_ACTION', 'Already mortgaged');
      }
      if (propState.ownershipState === 'BLOCKED') {
        throw new GameEngineError('INVALID_ACTION', 'Blocked property cannot be mortgaged');
      }

      // Requirement 6.2 & 6.7: Calculate mortgage payout accounting for development investment
      // Buildings/houses are preserved intact and not liquidated
      const mortgageAmount = calculateMortgageValue(spaceIdx, propState);

      const prevCash = player.cash;
      player.cash += mortgageAmount;
      propState.isMortgaged = true;
      propState.ownershipState = 'MORTGAGED';
      propState.mortgagePayout = mortgageAmount;

      recordTx(
        state,
        player.uid,
        'MORTGAGE_PROCEEDS',
        'CREDIT',
        mortgageAmount,
        prevCash,
        player.cash,
        `${player.displayName} mortgaged ${space.name} for ₹${mortgageAmount.toLocaleString('en-IN')}.`,
        { spaceIndex: spaceIdx, propertyName: space.name }
      );

      summary = `${player.displayName} mortgaged ${space.name} for ₹${mortgageAmount}`;
      eventPayload = { spaceIndex: spaceIdx, mortgageAmount };

      // Restart turn timer when player mortgages a property to grant ample time for further actions/resolution
      state.turnTimeRemaining = state.rules?.turnTimerSeconds ?? 30;
      break;
    }

    case 'UNMORTGAGE': {
      const spaceIdx = Number(command.payload.spaceIndex);
      const player = state.players.find((p) => p.uid === actorUid);
      const propState = state.properties[spaceIdx];
      const space = BOARD_SPACES[spaceIdx];

      if (actorUid !== state.currentPlayerUid) {
        throw new GameEngineError('NOT_YOUR_TURN', 'Only active player can reacquire properties');
      }
      if (!player) throw new GameEngineError('INVALID_ACTION', 'Player not found');
      if (!propState || propState.ownerUid !== actorUid) {
        throw new GameEngineError('INVALID_ACTION', 'You do not own this property');
      }
      if (!propState.isMortgaged && propState.ownershipState !== 'MORTGAGED') {
        throw new GameEngineError('INVALID_ACTION', 'Property is not mortgaged');
      }
      if (propState.ownershipState === 'BLOCKED') {
        throw new GameEngineError('INVALID_ACTION', 'Property is blocked and cannot be reacquired');
      }

      // Requirement 3: Mortgage reacquisition must require landing on that specific city again in an eligible turn
      const opportunity = state.reacquisitionOpportunity;
      const isValidLanding =
        opportunity &&
        opportunity.status === 'PENDING' &&
        opportunity.playerUid === actorUid &&
        opportunity.turnNumber === state.turnNumber &&
        opportunity.spaceIndex === spaceIdx &&
        player.position === spaceIdx;

      if (!isValidLanding) {
        throw new GameEngineError(
          'INVALID_ACTION',
          'Mortgaged property can only be reacquired by landing on it during an eligible turn.'
        );
      }

      // Requirement 6.6: Reacquisition cost must equal the exact mortgage amount originally received!
      let fallbackMortgage = 0;
      if ('mortgageValue' in space) {
        fallbackMortgage = (space as unknown as { mortgageValue: number }).mortgageValue;
      } else if ('price' in space) {
        fallbackMortgage = Math.floor((space as unknown as { price: number }).price / 2);
      }
      const reacquisitionCost =
        propState.mortgagePayout && propState.mortgagePayout > 0
          ? propState.mortgagePayout
          : fallbackMortgage;

      if (player.cash < reacquisitionCost) {
        throw new GameEngineError(
          'INSUFFICIENT_FUNDS',
          `Insufficient balance to reacquire this property (needs ₹${reacquisitionCost.toLocaleString('en-IN')}).`
        );
      }

      const prevCash = player.cash;
      player.cash -= reacquisitionCost;
      propState.isMortgaged = false;
      propState.ownershipState = 'OWNED';
      propState.mortgagePayout = 0;
      // All existing development (houses/tower) remains intact!

      // Fulfill reacquisition opportunity
      opportunity.status = 'REACQUIRED';
      state.reacquisitionOpportunity = null;
      state.pendingAction = null;
      state.phase = 'MANAGEMENT';

      recordTx(
        state,
        player.uid,
        'MORTGAGE_REACQUISITION',
        'DEBIT',
        reacquisitionCost,
        prevCash,
        player.cash,
        `${player.displayName} reacquired mortgaged property ${space.name} for ₹${reacquisitionCost.toLocaleString('en-IN')}.`,
        { spaceIndex: spaceIdx, propertyName: space.name }
      );

      summary = `${player.displayName} reacquired ${space.name} for ₹${reacquisitionCost}`;
      eventPayload = { spaceIndex: spaceIdx, cost: reacquisitionCost };
      break;
    }

    case 'RESOLVE_OBLIGATION': {
      const obligation = state.pendingFinancialObligation;
      if (!obligation) {
        throw new GameEngineError('INVALID_ACTION', 'No pending financial obligation exists');
      }
      if (actorUid !== obligation.debtorUid) {
        throw new GameEngineError('NOT_YOUR_TURN', 'Only debtor can resolve obligation');
      }

      const debtor = state.players.find((p) => p.uid === obligation.debtorUid);
      if (!debtor) throw new GameEngineError('INVALID_ACTION', 'Debtor not found');

      if (debtor.cash < obligation.amountDue) {
        throw new GameEngineError(
          'INSUFFICIENT_FUNDS',
          `Need ₹${obligation.amountDue.toLocaleString('en-IN')}, have ₹${debtor.cash.toLocaleString('en-IN')}. Please mortgage more properties or Give Up.`
        );
      }

      const creditor = obligation.creditorUid
        ? state.players.find((p) => p.uid === obligation.creditorUid)
        : null;

      const debtorPrev = debtor.cash;
      debtor.cash -= obligation.amountDue;

      const spaceName = obligation.spaceIndex !== undefined ? BOARD_SPACES[obligation.spaceIndex]?.name : 'debt';
      const isAirport = obligation.paymentType === 'AIRPORT_RENT';
      const sharedTxId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      recordTx(
        state,
        debtor.uid,
        isAirport ? 'AIRPORT_RENT_PAID' : (obligation.paymentType === 'TAX' ? 'TAX_PAYMENT' : 'RENT_PAID'),
        'DEBIT',
        obligation.amountDue,
        debtorPrev,
        debtor.cash,
        `${debtor.displayName} resolved obligation and paid ₹${obligation.amountDue.toLocaleString('en-IN')} to ${creditor?.displayName || 'Bank'} for ${spaceName}.`,
        { transactionId: sharedTxId, spaceIndex: obligation.spaceIndex, propertyName: spaceName, counterpartyUid: creditor?.uid, counterpartyName: creditor?.displayName }
      );

      if (creditor) {
        const creditorPrev = creditor.cash;
        creditor.cash += obligation.amountDue;
        recordTx(
          state,
          creditor.uid,
          isAirport ? 'AIRPORT_RENT_RECEIVED' : 'RENT_RECEIVED',
          'CREDIT',
          obligation.amountDue,
          creditorPrev,
          creditor.cash,
          `${creditor.displayName} received ₹${obligation.amountDue.toLocaleString('en-IN')} from ${debtor.displayName} for ${spaceName}.`,
          { transactionId: sharedTxId, spaceIndex: obligation.spaceIndex, propertyName: spaceName, counterpartyUid: debtor.uid, counterpartyName: debtor.displayName }
        );
      }

      obligation.status = 'RESOLVED';
      state.pendingFinancialObligation = null;
      state.phase = 'MANAGEMENT';
      summary = `${debtor.displayName} resolved pending payment of ₹${obligation.amountDue}.`;
      break;
    }

    case 'GIVE_UP': {
      const obligation = state.pendingFinancialObligation;
      const debtor = state.players.find((p) => p.uid === actorUid);
      if (!debtor) throw new GameEngineError('INVALID_ACTION', 'Player not found');
      if (debtor.isBankrupt || debtor.isDisqualified) {
        throw new GameEngineError('INVALID_ACTION', 'Player has already surrendered or left');
      }

      // Transfer any remaining cash to creditor if surrender happens during an active financial obligation
      if (obligation && obligation.debtorUid === actorUid && obligation.creditorUid) {
        const creditor = state.players.find((p) => p.uid === obligation.creditorUid);
        const remainingCash = debtor.cash;
        if (remainingCash > 0 && creditor) {
          debtor.cash = 0;
          creditor.cash += remainingCash;
          const sharedTxId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          recordTx(
            state,
            debtor.uid,
            'DISQUALIFICATION_ADJUSTMENT',
            'DEBIT',
            remainingCash,
            remainingCash,
            0,
            `${debtor.displayName} gave up; transferred remaining ₹${remainingCash.toLocaleString('en-IN')} to ${creditor.displayName}.`,
            { transactionId: sharedTxId, counterpartyUid: creditor.uid, counterpartyName: creditor.displayName }
          );
          recordTx(
            state,
            creditor.uid,
            'DISQUALIFICATION_ADJUSTMENT',
            'CREDIT',
            remainingCash,
            creditor.cash - remainingCash,
            creditor.cash,
            `${creditor.displayName} received ₹${remainingCash.toLocaleString('en-IN')} surrender payout from ${debtor.displayName}.`,
            { transactionId: sharedTxId, counterpartyUid: debtor.uid, counterpartyName: debtor.displayName }
          );
        }
      }

      debtor.isBankrupt = true;
      debtor.isDisqualified = true;

      // Requirement 8: Disqualified player's properties enter permanently BLOCKED state!
      // Must NOT become unowned; historical ownership, mortgage status, and building records are preserved!
      for (const prop of Object.values(state.properties)) {
        if (prop && prop.ownerUid === debtor.uid) {
          prop.ownershipState = 'BLOCKED';
          // Preserve prop.isMortgaged and prop.buildings intact
        }
      }

      if (obligation && obligation.debtorUid === actorUid) {
        obligation.status = 'CANCELLED';
        state.pendingFinancialObligation = null;
      }
      if (state.pendingAction?.playerUid === debtor.uid) {
        state.pendingAction = null;
      }
      if (state.reacquisitionOpportunity?.playerUid === debtor.uid) {
        state.reacquisitionOpportunity = null;
      }

      recordTx(
        state,
        debtor.uid,
        'DISQUALIFICATION_ADJUSTMENT',
        'DEBIT',
        0,
        debtor.cash,
        debtor.cash,
        `${debtor.displayName} surrendered and gave up. All owned properties permanently marked BLOCKED.`
      );

      summary = `${debtor.displayName} chose Give Up and is disqualified. Properties are blocked.`;

      // Requirement 7: If it is their turn, advance safely. If not, do not interrupt current player!
      if (state.currentPlayerUid === debtor.uid) {
        advanceTurn(state);
      }
      break;
    }

    case 'END_TURN': {
      if (actorUid !== state.currentPlayerUid) {
        throw new GameEngineError('NOT_YOUR_TURN', 'Only active player can end turn');
      }
      if (state.pendingAction) {
        throw new GameEngineError('INVALID_ACTION', 'Must resolve pending action before ending turn');
      }
      if (state.pendingFinancialObligation) {
        throw new GameEngineError('INVALID_ACTION', 'Must resolve financial obligation or Give Up before ending turn');
      }

      const currentActive = state.players.find((p) => p.uid === actorUid);

      // Single roll invariant: rolling doubles never grants an additional roll or turn. Only one time rolling is allowed.
      if (currentActive?.escapedJailThisTurn) {
        currentActive.escapedJailThisTurn = false;
      }

      // Advance to next solvent player
      advanceTurn(state);
      const nextPlayer = state.players.find((p) => p.uid === state.currentPlayerUid);
      summary = `Turn completed. It is now ${nextPlayer?.displayName}'s turn.`;
      break;
    }

    case 'DISMISS_CARD_POPUP': {
      state.activeCardPopup = null;
      summary = 'Acknowledged card rule.';
      break;
    }

    case 'DISMISS_MONEY_ACK': {
      state.activeMoneyTransaction = null;
      summary = 'Acknowledged money transaction.';
      break;
    }

    default:
      throw new GameEngineError('INVALID_ACTION', `Unsupported action ${command.type}`);
  }

  // Check for any player whose cash <= 0 and has no places to mortgage (Complete Bankruptcy Invariant)
  for (const p of state.players) {
    if (!p.isBankrupt && p.cash <= 0) {
      const hasMortgageable = Object.values(state.properties).some(
        (prop) => prop && prop.ownerUid === p.uid && !prop.isMortgaged && prop.ownershipState === 'OWNED'
      );
      if (!hasMortgageable && !state.pendingFinancialObligation) {
        p.isBankrupt = true;
        p.isDisqualified = true;
        p.cash = 0;
        // Requirement 6.5: Block all properties of disqualified player
        for (const prop of Object.values(state.properties)) {
          if (prop && prop.ownerUid === p.uid) {
            prop.ownershipState = 'BLOCKED';
            prop.isMortgaged = false;
          }
        }
        if (state.pendingAction?.playerUid === p.uid) {
          state.pendingAction = null;
          state.phase = 'MANAGEMENT';
        }
        summary = `⚠️ ${p.displayName} is completely bankrupt with ₹0 cash and no properties to mortgage!`;
        if (state.currentPlayerUid === p.uid) {
          advanceTurn(state);
        }
      }
    }
  }

  // Recalculate net worth for all players
  for (const p of state.players) {
    p.netWorth = calculateNetWorth(p.uid, p.cash, state.properties);
  }

  // Check victory condition: only 1 solvent player remaining
  const solventPlayers = state.players.filter((p) => !p.isBankrupt);
  if (solventPlayers.length <= 1 && state.players.length > 1) {
    state.status = 'COMPLETED';
    state.completedAt = Date.now();
    state.winnerUid = solventPlayers[0]?.uid ?? null;
    summary = `🏆 Game Over! ${solventPlayers[0]?.displayName} is victorious!`;
  }

  state.version += 1;
  state.updatedAt = Date.now();

  const event: GameEvent = {
    sequence: state.version,
    commandId: command.commandId,
    actorUid,
    type: command.type,
    summary,
    payload: eventPayload,
    createdAt: Date.now(),
    versionAfter: state.version,
  };

  return { nextState: state, event };
}

/**
 * Resolves consequences of landing on spaceIndex.
 */
function resolveLandingSpace(
  state: GameState,
  player: PlayerState,
  spaceIndex: number,
  diceTotal: number,
  options?: { rentMultiplier?: number; cardRuleIndex?: number }
): void {
  const space = BOARD_SPACES[spaceIndex];
  if (!space) return;

  switch (space.type) {
    case 'PROPERTY':
    case 'TRANSIT':
    case 'UTILITY': {
      const propState = state.properties[spaceIndex];
      if (!propState.ownerUid && propState.ownershipState !== 'BLOCKED') {
        const price = (space as PropertyDefinition | TransitDefinition | UtilityDefinition).price;
        // Requirement 2.1: City purchase insufficient balance check
        if (player.cash >= price) {
          state.phase = 'PROPERTY_DECISION';
          state.pendingAction = {
            type: 'BUY_OR_AUCTION',
            playerUid: player.uid,
            spaceIndex,
          };
        } else {
          // Insufficient balance to purchase -> do not show purchase popup
          state.phase = 'MANAGEMENT';
          state.pendingAction = null;
        }
      } else if (
        propState.ownerUid &&
        propState.ownerUid !== player.uid &&
        !propState.isMortgaged &&
        propState.ownershipState === 'OWNED'
      ) {
        const owner = state.players.find((p) => p.uid === propState.ownerUid);
        const isOwnerInJail = Boolean(owner?.inJail);

        // User Rule: If owner is in jail, they cannot earn rent
        let rentDue = calculateRent(spaceIndex, state.properties, diceTotal, undefined, isOwnerInJail);
        if (options?.rentMultiplier) {
          rentDue *= options.rentMultiplier;
        }

        const isAirport = AIRPORT_SPACES.includes(spaceIndex);
        const rentTxTypeDebtor: FinancialTransactionType = isAirport ? 'AIRPORT_RENT_PAID' : 'RENT_PAID';
        const rentTxTypeCreditor: FinancialTransactionType = isAirport ? 'AIRPORT_RENT_RECEIVED' : 'RENT_RECEIVED';

        if (rentDue > 0) {
          const sharedTxId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          if (player.cash >= rentDue) {
            const debtorPrev = player.cash;
            player.cash -= rentDue;

            recordTx(
              state,
              player.uid,
              rentTxTypeDebtor,
              'DEBIT',
              rentDue,
              debtorPrev,
              player.cash,
              `${player.displayName} paid ₹${rentDue.toLocaleString('en-IN')} ${isAirport ? 'airport rent' : 'rent'} to ${owner?.displayName} for ${space.name}.`,
              { transactionId: sharedTxId, spaceIndex, propertyName: space.name, counterpartyUid: owner?.uid, counterpartyName: owner?.displayName }
            );

            if (owner) {
              const ownerPrev = owner.cash;
              owner.cash += rentDue;
              recordTx(
                state,
                owner.uid,
                rentTxTypeCreditor,
                'CREDIT',
                rentDue,
                ownerPrev,
                owner.cash,
                `${owner.displayName} received ₹${rentDue.toLocaleString('en-IN')} ${isAirport ? 'airport rent' : 'rent'} from ${player.displayName} for ${space.name}.`,
                { transactionId: sharedTxId, spaceIndex, propertyName: space.name, counterpartyUid: player.uid, counterpartyName: player.displayName }
              );
            }

            state.phase = 'MANAGEMENT';
            state.activeMoneyTransaction = {
              id: `rent_${Date.now()}`,
              type: 'RENT',
              payerName: player.displayName,
              payerUid: player.uid,
              recipientName: owner?.displayName,
              recipientUid: owner?.uid,
              amount: rentDue,
              description: `${player.displayName} paid ₹${rentDue.toLocaleString('en-IN')} rent to ${owner?.displayName} for landing on ${space.name}.`,
            };
          } else {
            // Insufficient balance! Check for mortgageable properties
            const eligibleProperties = Object.values(state.properties).some(
              (p) => p && p.ownerUid === player.uid && !p.isMortgaged && p.ownershipState === 'OWNED'
            );

            if (eligibleProperties) {
              // Requirement 6.1: Pause current transaction, enter mandatory financial resolution
              state.phase = 'ACTION_REQUIRED';
              state.turnTimeRemaining = state.rules?.turnTimerSeconds ?? 30;
              state.pendingFinancialObligation = {
                obligationId: `ob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                debtorUid: player.uid,
                creditorUid: owner?.uid ?? null,
                amountDue: rentDue,
                paymentType: isAirport ? 'AIRPORT_RENT' : 'RENT',
                spaceIndex,
                status: 'PENDING',
                createdAt: Date.now(),
                idempotencyKey: `rent_${spaceIndex}_${state.turnNumber}`,
              };
            } else {
              // Completely bankrupt: zero mortgageable properties
              const paid = player.cash;
              const debtorPrev = player.cash;
              player.cash = 0;
              if (paid > 0 && owner) {
                owner.cash += paid;
                const sharedTxId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                recordTx(
                  state,
                  player.uid,
                  rentTxTypeDebtor,
                  'DEBIT',
                  paid,
                  debtorPrev,
                  0,
                  `${player.displayName} transferred remaining ₹${paid.toLocaleString('en-IN')} to ${owner.displayName} before bankruptcy.`,
                  { transactionId: sharedTxId, spaceIndex, propertyName: space.name, counterpartyUid: owner.uid, counterpartyName: owner.displayName }
                );
                recordTx(
                  state,
                  owner.uid,
                  rentTxTypeCreditor,
                  'CREDIT',
                  paid,
                  owner.cash - paid,
                  owner.cash,
                  `${owner.displayName} received remaining ₹${paid.toLocaleString('en-IN')} from ${player.displayName}.`,
                  { transactionId: sharedTxId, spaceIndex, propertyName: space.name, counterpartyUid: player.uid, counterpartyName: player.displayName }
                );
              }

              player.isBankrupt = true;
              player.isDisqualified = true;
              for (const prop of Object.values(state.properties)) {
                if (prop && prop.ownerUid === player.uid) {
                  prop.ownershipState = 'BLOCKED';
                }
              }
              state.phase = 'MANAGEMENT';
              state.pendingAction = null;
              state.pendingFinancialObligation = null;
              advanceTurn(state);
            }
          }
        } else {
          // Zero rent
          state.phase = 'MANAGEMENT';
        }
      } else if (
        propState.ownerUid === player.uid &&
        (propState.isMortgaged || propState.ownershipState === 'MORTGAGED') &&
        propState.ownershipState !== 'BLOCKED'
      ) {
        // Requirement 3: Mortgage Reacquisition Must Require Landing Again!
        const reacquisitionCost =
          propState.mortgagePayout && propState.mortgagePayout > 0
            ? propState.mortgagePayout
            : calculateMortgageValue(spaceIndex, propState);

        const landingId = `reacquire_${state.turnNumber}_${spaceIndex}_${Date.now()}`;
        state.reacquisitionOpportunity = {
          landingId,
          turnNumber: state.turnNumber,
          playerUid: player.uid,
          spaceIndex,
          cost: reacquisitionCost,
          status: 'PENDING',
        };

        if (player.cash >= reacquisitionCost) {
          state.phase = 'PROPERTY_DECISION';
          state.pendingAction = {
            type: 'BUY_OR_AUCTION',
            playerUid: player.uid,
            spaceIndex,
          };
        } else {
          state.reacquisitionOpportunity.status = 'DECLINED';
          state.phase = 'MANAGEMENT';
          state.pendingAction = null;
        }
      } else {
        // Owned by current player (unmortgaged) or blocked
        state.phase = 'MANAGEMENT';
      }
      break;
    }

    case 'TAX': {
      const taxAmount = space.amount;
      if (player.cash >= taxAmount) {
        const prevCash = player.cash;
        player.cash -= taxAmount;
        recordTx(
          state,
          player.uid,
          'TAX_PAYMENT',
          'DEBIT',
          taxAmount,
          prevCash,
          player.cash,
          `${player.displayName} paid ₹${taxAmount.toLocaleString('en-IN')} tax for ${space.name}.`,
          { spaceIndex, propertyName: space.name }
        );
        state.phase = 'MANAGEMENT';
        state.activeMoneyTransaction = {
          id: `tax_${Date.now()}`,
          type: 'TAX',
          payerName: player.displayName,
          payerUid: player.uid,
          recipientName: 'Bank',
          recipientUid: 'BANK',
          amount: taxAmount,
          description: `${player.displayName} paid ₹${taxAmount.toLocaleString('en-IN')} tax for landing on ${space.name}.`,
        };
      } else {
        const hasMortgageable = Object.values(state.properties).some(
          (p) => p && p.ownerUid === player.uid && !p.isMortgaged && p.ownershipState === 'OWNED'
        );

        if (hasMortgageable) {
          state.phase = 'ACTION_REQUIRED';
          state.turnTimeRemaining = state.rules?.turnTimerSeconds ?? 30;
          state.pendingFinancialObligation = {
            obligationId: `ob_tax_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            debtorUid: player.uid,
            creditorUid: null, // Bank
            amountDue: taxAmount,
            paymentType: 'TAX',
            spaceIndex,
            status: 'PENDING',
            createdAt: Date.now(),
            idempotencyKey: `tax_${spaceIndex}_${state.turnNumber}`,
          };
        } else {
          player.cash = 0;
          player.isBankrupt = true;
          player.isDisqualified = true;
          for (const prop of Object.values(state.properties)) {
            if (prop && prop.ownerUid === player.uid) {
              prop.ownershipState = 'BLOCKED';
            }
          }
          state.phase = 'MANAGEMENT';
          state.pendingAction = null;
          state.pendingFinancialObligation = null;
          advanceTurn(state);
        }
      }
      break;
    }

    case 'CARD': {
      // If a player reaches Civic Fund or Market Buzz with a total number from the dice,
      // that index rule (1..12) gets applied.
      const deck = space.deck === 'CIVIC' ? CIVIC_FUND_CARDS : MARKET_BUZZ_CARDS;
      const ruleIndex =
        options?.cardRuleIndex ??
        (diceTotal >= 1 && diceTotal <= deck.length
          ? diceTotal
          : ((state.turnNumber % deck.length) + 1));
      const card = deck[ruleIndex - 1];
      state.activeCardPopup = {
        deck: space.deck,
        card,
        ruleIndex,
        playerUid: player.uid,
      };
      applyCardEffect(state, player, card);
      // Only transition to MANAGEMENT if card effect didn't transition to PROPERTY_DECISION, ACTION_REQUIRED, or TURN_END
      if (
        state.phase !== 'PROPERTY_DECISION' &&
        state.phase !== 'ACTION_REQUIRED' &&
        state.phase !== 'TURN_END'
      ) {
        state.phase = 'MANAGEMENT';
      }
      break;
    }

    case 'GO_TO_JAIL': {
      player.inJail = true;
      player.jailTurns = 0;
      player.position = 10;
      state.phase = 'TURN_END';
      break;
    }

    case 'START':
    case 'JAIL':
    case 'REST_HOUSE':
    default:
      state.phase = 'MANAGEMENT';
      break;
  }
}

/**
 * Helper to process authoritative payments for cards with financial obligations.
 */
function handleCardPayment(
  state: GameState,
  player: PlayerState,
  amount: number,
  cardTitle: string,
  cardId: string
): void {
  if (amount <= 0) return;
  if (player.cash >= amount) {
    const prev = player.cash;
    player.cash -= amount;
    recordTx(
      state,
      player.uid,
      'CARD_PENALTY',
      'DEBIT',
      amount,
      prev,
      player.cash,
      `${player.displayName} paid ₹${amount.toLocaleString('en-IN')} for card: ${cardTitle}.`
    );
  } else {
    // Insufficient cash: check for mortgageable properties
    const hasMortgageable = Object.values(state.properties).some(
      (p) => p && p.ownerUid === player.uid && !p.isMortgaged && p.ownershipState === 'OWNED'
    );
    if (hasMortgageable) {
      state.phase = 'ACTION_REQUIRED';
      state.turnTimeRemaining = state.rules?.turnTimerSeconds ?? 30;
      state.pendingFinancialObligation = {
        obligationId: `ob_card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        debtorUid: player.uid,
        creditorUid: null, // Bank
        amountDue: amount,
        paymentType: 'CARD',
        status: 'PENDING',
        createdAt: Date.now(),
        idempotencyKey: `card_${cardId}_${state.turnNumber}`,
      };
    } else {
      const paid = player.cash;
      player.cash = 0;
      if (paid > 0) {
        recordTx(
          state,
          player.uid,
          'CARD_PENALTY',
          'DEBIT',
          paid,
          paid,
          0,
          `${player.displayName} paid remaining ₹${paid.toLocaleString('en-IN')} for card: ${cardTitle} before bankruptcy.`
        );
      }
      player.isBankrupt = true;
      player.isDisqualified = true;
      for (const prop of Object.values(state.properties)) {
        if (prop && prop.ownerUid === player.uid) {
          prop.ownershipState = 'BLOCKED';
        }
      }
      state.phase = 'MANAGEMENT';
      state.pendingAction = null;
      state.pendingFinancialObligation = null;
      advanceTurn(state);
    }
  }
}

/**
 * Applies drawn card consequences.
 */
function applyCardEffect(state: GameState, player: PlayerState, card: CardAction): void {
  switch (card.actionType) {
    case 'CASH_BANK': {
      const amt = card.amount ?? 0;
      const prev = player.cash;
      player.cash += amt;
      recordTx(
        state,
        player.uid,
        'CARD_REWARD',
        'CREDIT',
        amt,
        prev,
        player.cash,
        `${player.displayName} received ₹${amt.toLocaleString('en-IN')} from card: ${card.title}.`
      );
      break;
    }
    case 'PAY_BANK': {
      const amt = card.amount ?? 0;
      handleCardPayment(state, player, amt, card.title, card.id);
      break;
    }
    case 'CASH_PLAYERS': {
      // User Rule: If the player is in jail, he/she should not earn any money from other players
      if (player.inJail) break;
      const perPlayer = card.amount ?? 0;
      for (const other of state.players) {
        if (other.uid !== player.uid && !other.isBankrupt && !other.isDisqualified) {
          const paid = Math.min(other.cash, perPlayer);
          const otherPrev = other.cash;
          const playerPrev = player.cash;
          other.cash -= paid;
          player.cash += paid;
          const sharedTxId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          recordTx(
            state,
            other.uid,
            'CARD_PENALTY',
            'DEBIT',
            paid,
            otherPrev,
            other.cash,
            `${other.displayName} paid ₹${paid.toLocaleString('en-IN')} to ${player.displayName} for card: ${card.title}.`,
            { transactionId: sharedTxId, counterpartyUid: player.uid, counterpartyName: player.displayName }
          );
          recordTx(
            state,
            player.uid,
            'CARD_REWARD',
            'CREDIT',
            paid,
            playerPrev,
            player.cash,
            `${player.displayName} received ₹${paid.toLocaleString('en-IN')} from ${other.displayName} for card: ${card.title}.`,
            { transactionId: sharedTxId, counterpartyUid: other.uid, counterpartyName: other.displayName }
          );
        }
      }
      break;
    }
    case 'PAY_PLAYERS': {
      const perPlayer = card.amount ?? 0;
      const eligibleRecipients = state.players.filter(
        (other) => other.uid !== player.uid && !other.isBankrupt && !other.isDisqualified && !other.inJail
      );
      const totalNeeded = eligibleRecipients.length * perPlayer;
      if (totalNeeded <= 0) break;

      if (player.cash >= totalNeeded) {
        for (const other of eligibleRecipients) {
          const playerPrev = player.cash;
          const otherPrev = other.cash;
          player.cash -= perPlayer;
          other.cash += perPlayer;
          const sharedTxId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          recordTx(
            state,
            player.uid,
            'CARD_PENALTY',
            'DEBIT',
            perPlayer,
            playerPrev,
            player.cash,
            `${player.displayName} paid ₹${perPlayer.toLocaleString('en-IN')} to ${other.displayName} for card: ${card.title}.`,
            { transactionId: sharedTxId, counterpartyUid: other.uid, counterpartyName: other.displayName }
          );
          recordTx(
            state,
            other.uid,
            'CARD_REWARD',
            'CREDIT',
            perPlayer,
            otherPrev,
            other.cash,
            `${other.displayName} received ₹${perPlayer.toLocaleString('en-IN')} from ${player.displayName} for card: ${card.title}.`,
            { transactionId: sharedTxId, counterpartyUid: other.uid, counterpartyName: other.displayName }
          );
        }
      } else {
        const hasMortgageable = Object.values(state.properties).some(
          (p) => p && p.ownerUid === player.uid && !p.isMortgaged && p.ownershipState === 'OWNED'
        );
        if (hasMortgageable) {
          state.phase = 'ACTION_REQUIRED';
          state.turnTimeRemaining = state.rules?.turnTimerSeconds ?? 30;
          state.pendingFinancialObligation = {
            obligationId: `ob_card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            debtorUid: player.uid,
            creditorUid: null,
            amountDue: totalNeeded,
            paymentType: 'CARD',
            status: 'PENDING',
            createdAt: Date.now(),
            idempotencyKey: `card_${card.id}_${state.turnNumber}`,
          };
        } else {
          // Distribute available cash equally to recipients
          const perRecipient = Math.floor(player.cash / eligibleRecipients.length);
          for (const other of eligibleRecipients) {
            other.cash += perRecipient;
          }
          player.cash = 0;
          player.isBankrupt = true;
          player.isDisqualified = true;
          for (const prop of Object.values(state.properties)) {
            if (prop && prop.ownerUid === player.uid) {
              prop.ownershipState = 'BLOCKED';
            }
          }
          state.phase = 'MANAGEMENT';
          state.pendingAction = null;
          state.pendingFinancialObligation = null;
          advanceTurn(state);
        }
      }
      break;
    }
    case 'MOVE_TO':
      if (card.targetSpace !== undefined) {
        if (card.targetSpace < player.position || card.targetSpace === 0) {
          const prev = player.cash;
          player.cash += GAME_CONSTANTS.START_REWARD;
          recordTx(
            state,
            player.uid,
            'START_REWARD',
            'CREDIT',
            GAME_CONSTANTS.START_REWARD,
            prev,
            player.cash,
            `${player.displayName} collected ₹${GAME_CONSTANTS.START_REWARD.toLocaleString('en-IN')} START salary via card navigation.`
          );
        }
        player.position = card.targetSpace;
        resolveLandingSpace(state, player, player.position, 0);
      }
      break;
    case 'MOVE_RELATIVE':
      player.position = (player.position + (card.amount ?? 0) + 40) % 40;
      resolveLandingSpace(state, player, player.position, 0);
      break;
    case 'ADVANCE_NEXT_TRANSIT': {
      const nextTransit = TRANSIT_SPACES.find((idx) => idx > player.position) ?? TRANSIT_SPACES[0];
      if (nextTransit < player.position) {
        const prev = player.cash;
        player.cash += GAME_CONSTANTS.START_REWARD;
        recordTx(
          state,
          player.uid,
          'START_REWARD',
          'CREDIT',
          GAME_CONSTANTS.START_REWARD,
          prev,
          player.cash,
          `${player.displayName} collected ₹${GAME_CONSTANTS.START_REWARD.toLocaleString('en-IN')} START salary via transit travel card.`
        );
      }
      player.position = nextTransit;
      resolveLandingSpace(state, player, nextTransit, 0, { rentMultiplier: 2 });
      break;
    }
    case 'TRANSIT_DIVIDEND': {
      const ownedTransits = TRANSIT_SPACES.filter(
        (idx) => state.properties[idx]?.ownerUid === player.uid && state.properties[idx]?.ownershipState !== 'BLOCKED'
      ).length;
      const amt = ownedTransits * (card.amount ?? 400);
      const prev = player.cash;
      player.cash += amt;
      recordTx(
        state,
        player.uid,
        'CARD_REWARD',
        'CREDIT',
        amt,
        prev,
        player.cash,
        `${player.displayName} collected ₹${amt.toLocaleString('en-IN')} Transit Dividend.`
      );
      break;
    }
    case 'REPAIR_TAX': {
      let totalBlocks = 0;
      let totalTowers = 0;
      for (const prop of Object.values(state.properties)) {
        if (prop.ownerUid === player.uid && prop.ownershipState !== 'BLOCKED') {
          if (prop.buildings === 5) {
            totalTowers += 1;
          } else if (prop.buildings > 0) {
            totalBlocks += prop.buildings;
          }
        }
      }
      const cost = totalBlocks * (card.perHouse ?? 250) + totalTowers * (card.perTower ?? 750);
      handleCardPayment(state, player, cost, card.title, card.id);
      break;
    }
    case 'DEVELOPMENT_GRANT': {
      let totalBlocks = 0;
      let totalTowers = 0;
      for (const prop of Object.values(state.properties)) {
        if (prop.ownerUid === player.uid && prop.ownershipState !== 'BLOCKED') {
          if (prop.buildings === 5) {
            totalTowers += 1;
          } else if (prop.buildings > 0) {
            totalBlocks += prop.buildings;
          }
        }
      }
      const grant = totalBlocks * (card.perHouse ?? 100) + totalTowers * (card.perTower ?? 300);
      const prev = player.cash;
      player.cash += grant;
      recordTx(
        state,
        player.uid,
        'CARD_REWARD',
        'CREDIT',
        grant,
        prev,
        player.cash,
        `${player.displayName} received ₹${grant.toLocaleString('en-IN')} Municipal Development Grant.`
      );
      break;
    }
    case 'DEED_TAX': {
      const totalDeeds = Object.values(state.properties).filter(
        (p) => p.ownerUid === player.uid && p.ownershipState !== 'BLOCKED'
      ).length;
      const cost = totalDeeds * (card.amount ?? 250);
      handleCardPayment(state, player, cost, card.title, card.id);
      break;
    }
    case 'JAIL_FREE':
      player.jailFreeCards += 1;
      break;
    case 'GO_TO_JAIL':
      player.inJail = true;
      player.jailTurns = 0;
      player.position = 10;
      state.phase = 'TURN_END';
      break;
  }
}

/**
 * Advances turn to next solvent player in order.
 */
function advanceTurn(state: GameState): void {
  const currentIdx = state.playerOrder.indexOf(state.currentPlayerUid);
  const total = state.playerOrder.length;

  for (let step = 1; step <= total; step++) {
    const nextUid = state.playerOrder[(currentIdx + step) % total];
    const player = state.players.find((p) => p.uid === nextUid);
    if (player && !player.isBankrupt && !player.isDisqualified) {
      state.currentPlayerUid = nextUid;
      state.turnNumber += 1;
      state.dice = null;
      state.pendingAction = null;
      state.reacquisitionOpportunity = null;
      state.activeMoneyTransaction = null;
      state.activeCardPopup = null;
      state.turnTimeRemaining = state.turnTimeLimit || 30;

      // Reset turn-scoped escape flag
      player.escapedJailThisTurn = false;

      // Requirement 1.2: Automatic release on fourth eligible turn
      // If player failed 3 double attempts (jailTurns >= 3):
      // Automatically release without requiring another Try Double attempt!
      if (player.inJail && player.jailTurns >= GAME_CONSTANTS.MAX_JAIL_DOUBLES_ATTEMPTS) {
        player.inJail = false;
        player.jailTurns = 0;
        state.phase = 'AWAIT_ROLL';
        return;
      }

      state.phase = player.inJail ? 'JAIL_DECISION' : 'AWAIT_ROLL';
      return;
    }
  }
}
