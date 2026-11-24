/**
 * Indian Monopoly - Autonomous Computer Player (CPU) Decision Engine
 *
 * Provides a pure, deterministic, and strategic decision-making policy for
 * computer-controlled players. Operates authoritatively without cloud AI or
 * external network dependencies.
 *
 * All decisions use the exact same validation rules, prices, and constraints
 * that govern human players.
 */

import {
  AIRPORT_SPACES,
  BOARD_SPACES,
  PROPERTY_GROUPS,
  RAILWAY_SPACES,
  UTILITY_SPACES,
} from '../board-config';
import {
  GameActionType,
  GameState,
  PlayerState,
  PropertyDefinition,
  PropertyState,
  TransitDefinition,
  UtilityDefinition,
} from '../game-types';
import {
  calculateBuildingCost,
  calculateMortgageValue,
  calculateReacquisitionCost,
  calculateRent,
  canBuildOnProperty,
  DEFAULT_HOST_RULES,
  GAME_CONSTANTS,
  getAuthoritativeBailAmount,
  HostCustomRules,
} from '../ruleset';

export interface CpuActionDecision {
  type: GameActionType;
  payload?: Record<string, unknown>;
  reason: string;
}

export interface CpuSellPriorityResult {
  selectedIndices: number[];
  totalPayout: number;
  canCover: boolean;
}

/**
 * Evaluates jail decisions for a computer player:
 * 1. Use Bail Key if available.
 * 2. Pay statutory ₹500 bail if cash reserves are healthy.
 * 3. Attempt doubles if low on cash or preserving liquidity.
 */
export function decideJailAction(
  state: GameState,
  cpuPlayer: PlayerState
): CpuActionDecision {
  // Priority 1: Bail Key inventory (Get Out of Jail card)
  if (cpuPlayer.jailFreeCards > 0) {
    return {
      type: 'USE_JAIL_CARD',
      reason: `${cpuPlayer.displayName} used a Bail Key to exit Central Jail.`,
    };
  }

  const bailAmount = getAuthoritativeBailAmount(state);

  // Priority 2: Pay bail if affordable with comfortable cash reserve (>= ₹2,000 or on attempt 2+)
  if (
    cpuPlayer.cash >= bailAmount &&
    (cpuPlayer.cash >= 2000 || cpuPlayer.jailTurns >= 2)
  ) {
    return {
      type: 'PAY_BAIL',
      reason: `${cpuPlayer.displayName} paid ₹${bailAmount} statutory bail to exit Central Jail.`,
    };
  }

  // Priority 3: Roll for doubles
  return {
    type: 'TRY_DOUBLES',
    reason: `${cpuPlayer.displayName} attempted to roll doubles to exit Central Jail.`,
  };
}


// ===========================================================================
// CPU MONEY PLANNER
// ---------------------------------------------------------------------------
// CPU players think like a careful human before spending:
//  1. "What can hit me on my next roll?" - every space 2..12 steps ahead is
//     checked for opponent rent, taxes and card risk, weighted by dice odds.
//  2. "How dangerous is the board overall?" - the costliest opponent city
//     anywhere on the board (opponents keep building over time).
//  3. "What can I fall back on?" - undeveloped assets that are not part of a
//     complete colour set can be sold to the bank in an emergency, and START
//     salary may be coming soon.
// From these a cash reserve is worked out. A purchase or construction only
// happens when the cash left afterwards still covers that reserve. Purchases
// with strong strategic value (completing a colour set, blocking an opponent,
// the second airport/railway) are allowed to dip deeper into the reserve.
// ===========================================================================

export type CpuStrategicTier = 'CRITICAL' | 'HIGH' | 'NORMAL';

export interface CpuFinancialOutlook {
  /** Probability-weighted expected payment on the next roll. */
  nextRollExpectedCost: number;
  /** Largest likely payment on the next roll (common totals 4..10). */
  nextRollLikelyWorstCost: number;
  /** Largest possible payment on the next roll (any total 2..12). */
  nextRollWorstCost: number;
  /** Highest rent any opponent can currently charge anywhere on the board. */
  boardMaxOpponentRent: number;
  /** Bank sale value of assets the CPU could give up without hurting its sets. */
  expendableAssetValue: number;
  /** Probability of passing/landing on START during the next roll. */
  passStartProbability: number;
  /** Minimum cash the CPU never goes below by choice. */
  floorReserve: number;
  /** Final reserve that must stay in hand after a voluntary spend. */
  reserve: number;
}

const DICE_TOTAL_PROBABILITY: Record<number, number> = {
  2: 1 / 36, 3: 2 / 36, 4: 3 / 36, 5: 4 / 36, 6: 5 / 36, 7: 6 / 36,
  8: 5 / 36, 9: 4 / 36, 10: 3 / 36, 11: 2 / 36, 12: 1 / 36,
};

/** Average exposure from drawing a Civic Fund / Market Buzz card. */
const CARD_SPACE_RISK = 400;

function getRules(state: GameState): HostCustomRules {
  return (state.rules as HostCustomRules | undefined) ?? DEFAULT_HOST_RULES;
}

function isActiveOpponentOwner(state: GameState, ownerUid: string | null | undefined, cpuUid: string): PlayerState | null {
  if (!ownerUid || ownerUid === cpuUid) return null;
  const owner = state.players.find((p) => p.uid === ownerUid);
  if (!owner || owner.isBankrupt) return null;
  return owner;
}

/** Cash the CPU would have to pay when landing on a space after rolling `diceTotal`. */
function estimateLandingCost(state: GameState, cpuPlayer: PlayerState, spaceIndex: number, diceTotal: number): number {
  const space = BOARD_SPACES[spaceIndex];
  if (!space) return 0;

  if (space.type === 'PROPERTY' || space.type === 'TRANSIT' || space.type === 'UTILITY') {
    const prop = state.properties[spaceIndex];
    const owner = isActiveOpponentOwner(state, prop?.ownerUid, cpuPlayer.uid);
    if (!owner) return 0;
    return calculateRent(spaceIndex, state.properties, diceTotal, getRules(state), Boolean(owner.inJail));
  }
  if (space.type === 'TAX') {
    return (space as { amount?: number }).amount ?? GAME_CONSTANTS.GST_CHECKPOST_AMOUNT;
  }
  if (space.type === 'CARD') {
    return CARD_SPACE_RISK;
  }
  if (space.type === 'GO_TO_JAIL') {
    return getAuthoritativeBailAmount(state);
  }
  return 0;
}

/** True when the CPU owns every city of the group the given city belongs to. */
function ownsFullGroupOf(cpuUid: string, spaceIndex: number, properties: Record<number, PropertyState>): boolean {
  const space = BOARD_SPACES[spaceIndex];
  if (!space || space.type !== 'PROPERTY') return false;
  const members = PROPERTY_GROUPS[(space as PropertyDefinition).group];
  return Boolean(members?.every((idx) => properties[idx]?.ownerUid === cpuUid));
}

/**
 * Builds the CPU's financial picture: upcoming risk, board danger and fall-back options.
 * `fromPosition` defaults to the CPU's current position (where the next roll starts).
 */
export function assessCpuFinancialOutlook(
  state: GameState,
  cpuPlayer: PlayerState,
  fromPosition: number = cpuPlayer.position
): CpuFinancialOutlook {
  const rules = getRules(state);
  const startingCash = rules.startingCash || GAME_CONSTANTS.STARTING_CASH;
  const salary = rules.passStartReward || GAME_CONSTANTS.START_REWARD;

  // 1. Next-roll exposure
  let expected = 0;
  let likelyWorst = 0;
  let worst = 0;
  let passStartProbability = 0;
  for (let total = 2; total <= 12; total++) {
    const probability = DICE_TOTAL_PROBABILITY[total];
    const target = (fromPosition + total) % 40;
    if (fromPosition + total >= 40) passStartProbability += probability;
    const cost = estimateLandingCost(state, cpuPlayer, target, total);
    expected += probability * cost;
    worst = Math.max(worst, cost);
    if (total >= 4 && total <= 10) likelyWorst = Math.max(likelyWorst, cost);
  }

  // 2. Board-wide danger (opponents' most expensive rent anywhere)
  let boardMaxOpponentRent = 0;
  for (const [idxStr, prop] of Object.entries(state.properties)) {
    const owner = isActiveOpponentOwner(state, prop?.ownerUid, cpuPlayer.uid);
    if (!owner) continue;
    const rent = calculateRent(Number(idxStr), state.properties, 7, rules, false);
    boardMaxOpponentRent = Math.max(boardMaxOpponentRent, rent);
  }

  // 3. Fall-back: assets the CPU could sell without breaking a colour set or losing houses
  let expendableAssetValue = 0;
  for (const [idxStr, prop] of Object.entries(state.properties)) {
    const idx = Number(idxStr);
    if (prop?.ownerUid !== cpuPlayer.uid) continue;
    if (prop.isMortgaged || prop.ownershipState === 'MORTGAGED' || prop.ownershipState === 'BLOCKED') continue;
    if (prop.buildings > 0) continue;
    if (ownsFullGroupOf(cpuPlayer.uid, idx, state.properties)) continue;
    expendableAssetValue += calculateMortgageValue(idx, prop);
  }

  const floorReserve = Math.max(1000, Math.round(startingCash * 0.075));

  // Combine: cover the likely worst hit fully, half of the rare worst case,
  // and keep a cushion against the board's biggest rent for later laps.
  const nearTermNeed = Math.max(likelyWorst, worst * 0.5) + expected * 0.5;
  const longTermNeed = boardMaxOpponentRent * 0.35;
  let reserve = Math.max(floorReserve, nearTermNeed, longTermNeed);

  // Fall-back credits: part of expendable assets and expected START salary
  const assetCredit = Math.min(reserve * 0.5, expendableAssetValue * 0.4);
  const salaryCredit = passStartProbability * salary * 0.5;
  reserve = Math.max(Math.round(floorReserve * 0.6), Math.round(reserve - assetCredit - salaryCredit));

  return {
    nextRollExpectedCost: Math.round(expected),
    nextRollLikelyWorstCost: likelyWorst,
    nextRollWorstCost: worst,
    boardMaxOpponentRent,
    expendableAssetValue,
    passStartProbability,
    floorReserve,
    reserve,
  };
}

/**
 * Rates how important an acquisition is for the CPU.
 * CRITICAL: completes the CPU's own colour set, re-buys a developed bank-sold city,
 *           or gives the second airport / railway / utility of a pair.
 * HIGH:     second city of a group, blocks an opponent's set, or any infrastructure.
 * NORMAL:   everything else.
 */
export function evaluateAcquisitionTier(
  state: GameState,
  cpuPlayer: PlayerState,
  spaceIndex: number
): CpuStrategicTier {
  const space = BOARD_SPACES[spaceIndex];
  const prop = state.properties[spaceIndex];
  if (!space) return 'NORMAL';

  if ((prop?.buildings ?? 0) > 0) return 'CRITICAL';

  if (space.type === 'PROPERTY') {
    const members = PROPERTY_GROUPS[(space as PropertyDefinition).group] ?? [];
    const others = members.filter((idx) => idx !== spaceIndex);
    const mine = others.filter((idx) => state.properties[idx]?.ownerUid === cpuPlayer.uid).length;
    if (others.length > 0 && mine === others.length) return 'CRITICAL';
    if (mine > 0) return 'HIGH';

    // Blocking: one opponent holds all other cities of this group
    const otherOwners = new Set(others.map((idx) => state.properties[idx]?.ownerUid ?? null));
    if (otherOwners.size === 1) {
      const [onlyOwner] = Array.from(otherOwners);
      if (isActiveOpponentOwner(state, onlyOwner, cpuPlayer.uid)) return 'HIGH';
    }
    return 'NORMAL';
  }

  const pairGroup =
    AIRPORT_SPACES.includes(spaceIndex) ? AIRPORT_SPACES :
    RAILWAY_SPACES.includes(spaceIndex) ? RAILWAY_SPACES :
    UTILITY_SPACES.includes(spaceIndex) ? UTILITY_SPACES : [];
  const ownsPartner = pairGroup.some(
    (idx) => idx !== spaceIndex && state.properties[idx]?.ownerUid === cpuPlayer.uid
  );
  if (ownsPartner) return 'CRITICAL';
  return 'HIGH';
}

/** Share of the reserve a CPU must keep after a purchase of the given tier. */
const TIER_RESERVE_FACTOR: Record<CpuStrategicTier, number> = {
  CRITICAL: 0.4,
  HIGH: 0.7,
  NORMAL: 1.0,
};

/** Smallest cash balance a CPU will ever leave itself with after a voluntary spend. */
const ABSOLUTE_MIN_CASH_AFTER_SPEND = 300;

/**
 * Decides whether spending `price` on an acquisition is a sound money decision.
 */
export function shouldCpuAcquire(
  state: GameState,
  cpuPlayer: PlayerState,
  spaceIndex: number,
  price: number
): { buy: boolean; tier: CpuStrategicTier; reserve: number; cashAfter: number } {
  const tier = evaluateAcquisitionTier(state, cpuPlayer, spaceIndex);
  const cashAfter = cpuPlayer.cash - price;
  if (cashAfter < 0) return { buy: false, tier, reserve: 0, cashAfter };

  // Strategic purchases may dip deeper into the reserve (see TIER_RESERVE_FACTOR).
  const outlook = assessCpuFinancialOutlook(state, cpuPlayer);
  const required = Math.max(
    ABSOLUTE_MIN_CASH_AFTER_SPEND,
    Math.round(outlook.reserve * TIER_RESERVE_FACTOR[tier])
  );
  return { buy: cashAfter >= required, tier, reserve: required, cashAfter };
}

/**
 * Counts buildings this CPU has just constructed on the given city during the
 * current visit (consecutive most-recent construction transactions of this player).
 */
function countBuildsThisVisit(state: GameState, cpuUid: string, spaceIndex: number): number {
  const txs = state.transactions ?? [];
  let count = 0;
  for (let i = txs.length - 1; i >= 0; i--) {
    const tx = txs[i];
    if (tx.playerUid !== cpuUid) break;
    const isBuild = tx.type === 'HOUSE_PURCHASE' || tx.type === 'BUILDING_PURCHASE';
    if (!isBuild || tx.spaceIndex !== spaceIndex) break;
    count++;
  }
  return count;
}

/**
 * Evaluates property acquisition and reacquisition decisions:
 * - Unowned cities, infrastructure (airports, stations), and utilities.
 * - Cities previously sold to the bank (at recorded sale payout, inheriting houses).
 * - Reacquisition of player's own mortgaged city when landing on it.
 */
export function decidePropertyAction(
  state: GameState,
  cpuPlayer: PlayerState
): CpuActionDecision {
  // Check for reacquisition opportunity (landing on own bank-sold or mortgaged property)
  const opp = state.reacquisitionOpportunity;
  if (
    opp &&
    opp.playerUid === cpuPlayer.uid &&
    opp.status === 'PENDING' &&
    opp.spaceIndex === cpuPlayer.position
  ) {
    const plan = shouldCpuAcquire(state, cpuPlayer, opp.spaceIndex, opp.cost);
    // Reacquiring an own city is at least HIGH value (restores rent income / colour set)
    const required = plan.tier === 'NORMAL'
      ? Math.max(ABSOLUTE_MIN_CASH_AFTER_SPEND, Math.round(plan.reserve * TIER_RESERVE_FACTOR.HIGH))
      : plan.reserve;
    if (cpuPlayer.cash >= opp.cost && plan.cashAfter >= required) {
      return {
        type: 'UNMORTGAGE',
        payload: { spaceIndex: opp.spaceIndex },
        reason: `${cpuPlayer.displayName} reacquired property at space ${opp.spaceIndex} for ₹${opp.cost}.`,
      };
    }
    return {
      type: 'DECLINE_REACQUISITION',
      reason: cpuPlayer.cash >= opp.cost
        ? `${cpuPlayer.displayName} declined reacquisition to keep a safe cash reserve of ₹${required}.`
        : `${cpuPlayer.displayName} declined reacquisition due to insufficient balance.`,
    };
  }

  const space = BOARD_SPACES[cpuPlayer.position];
  const propState = state.properties[cpuPlayer.position];

  if (!space || !propState) {
    return {
      type: 'DECLINE_PROPERTY',
      reason: 'Invalid space or property state.',
    };
  }

  // Determine acquisition price (bank-sold recorded payout or initial deed price)
  const isBankAcquisition = Boolean(
    (propState.soldToBankReacquisitionCost && propState.soldToBankReacquisitionCost > 0) ||
    (propState.soldToBankPayout && propState.soldToBankPayout > 0)
  );
  const price = isBankAcquisition
    ? calculateReacquisitionCost(cpuPlayer.position, propState)
    : (space as PropertyDefinition | TransitDefinition | UtilityDefinition).price ?? 0;

  // Cannot afford
  if (cpuPlayer.cash < price) {
    return {
      type: 'DECLINE_PROPERTY',
      reason: `${cpuPlayer.displayName} has insufficient funds (needs ₹${price}, has ₹${cpuPlayer.cash}).`,
    };
  }

  // Money-planned evaluation: keep enough cash for the dangers ahead.
  const plan = shouldCpuAcquire(state, cpuPlayer, cpuPlayer.position, price);
  if (plan.buy) {
    return {
      type: 'BUY_PROPERTY',
      reason: isBankAcquisition
        ? `${cpuPlayer.displayName} acquired bank-sold property ${space.name} for ₹${price} inheriting all developments.`
        : `${cpuPlayer.displayName} purchased ${space.name} for ₹${price}.`,
    };
  }

  return {
    type: 'DECLINE_PROPERTY',
    reason: `${cpuPlayer.displayName} skipped ${space.name} (₹${price}) to keep a safe cash reserve of ₹${plan.reserve}.`,
  };
}

/**
 * Evaluates building decisions during MANAGEMENT phase:
 * In Indian Monopoly, a player can build a house/tower on a city when:
 * 1. The player is visiting that city (cpuPlayer.position === spaceIndex).
 * 2. It is not the same turn they bought it.
 * 3. Maximum tower level not yet reached.
 *
 * Money planning (like a careful human player):
 * - Cash left after building must still cover the CPU's reserve (upcoming rents,
 *   taxes and board danger; never less than ₹1,500).
 * - Building on a city without the full colour set needs a 20% bigger cushion
 *   and stops at 4 houses; a Commercial Tower needs an extra 25% cushion.
 * - Each further level built in the same visit needs 50% more cushion, so a CPU
 *   only stacks several levels at once when it is clearly cash-rich.
 */
export function decideBuildingAction(
  state: GameState,
  cpuPlayer: PlayerState
): { spaceIndex: number; cost: number } | null {
  const LIQUIDITY_RESERVE = 1500;
  const currentPos = cpuPlayer.position;

  const prop = state.properties[currentPos];
  if (!prop || prop.ownerUid !== cpuPlayer.uid) return null;

  const space = BOARD_SPACES[currentPos];
  if (!space || space.type !== 'PROPERTY') return null;

  const cost = calculateBuildingCost(currentPos, prop.buildings);
  if (cost <= 0) return null;

  const outlook = assessCpuFinancialOutlook(state, cpuPlayer);
  const hasFullSet = ownsFullGroupOf(cpuPlayer.uid, currentPos, state.properties);

  // Without the full colour set a Commercial Tower is not worth it: stop at 4 houses there.
  if (!hasFullSet && prop.buildings >= 4) return null;

  // Houses pay back quickly (cost = new rent), so building may use a bit of the
  // reserve's fall-back cushion, but never below the ₹1,500 liquidity floor.
  let required = Math.max(LIQUIDITY_RESERVE, Math.round(outlook.reserve * 0.8));
  if (!hasFullSet) required = Math.round(required * 1.2);
  if (prop.buildings + 1 === GAME_CONSTANTS.TOWER_BUILDING_LEVEL) required = Math.round(required * 1.25);

  const buildsThisVisit = countBuildsThisVisit(state, cpuPlayer.uid, currentPos);
  if (buildsThisVisit >= 1) {
    // Extra levels in the same visit need a much stronger position
    required = Math.round(required * (1 + 0.5 * buildsThisVisit));
  }

  // Check cash reserve requirement
  if (cpuPlayer.cash - cost < required) return null;

  const check = canBuildOnProperty(
    currentPos,
    cpuPlayer.uid,
    state.properties,
    cpuPlayer.cash,
    currentPos,
    state.turnNumber
  );

  if (check.allowed) {
    return {
      spaceIndex: currentPos,
      cost,
    };
  }

  return null;
}

/**
 * Implements the required priority order for CPU Sell to Bank (mortgage) under financial pressure:
 *
 * 1. First, sell eligible cities that have no houses built on them (prop.buildings === 0).
 * 2. After exhausting eligible cities without buildings, consider other eligible properties without buildings (Transit / Utility).
 * 3. Among cities with buildings, prioritize selling the city with the HIGHEST number of houses first (towers first, then 4, 3, 2, 1).
 * 4. Stop once the pending obligation can be settled (do not sell more property than necessary).
 */
export function decideSellToBankProperties(
  state: GameState,
  cpuPlayer: PlayerState,
  obligationAmount: number
): CpuSellPriorityResult {
  const needed = Math.max(0, obligationAmount - cpuPlayer.cash);
  if (needed <= 0) {
    return { selectedIndices: [], totalPayout: 0, canCover: true };
  }

  // 1. Collect all eligible properties owned by debtor
  interface CandidateProperty {
    spaceIndex: number;
    spaceType: string;
    buildings: number;
    payout: number;
  }

  const candidates: CandidateProperty[] = [];

  for (const [idxStr, prop] of Object.entries(state.properties)) {
    const spaceIndex = Number(idxStr);
    if (prop.ownerUid !== cpuPlayer.uid) continue;
    if (prop.isMortgaged || prop.ownershipState === 'MORTGAGED') continue;
    if (prop.ownershipState === 'BLOCKED') continue;

    const space = BOARD_SPACES[spaceIndex];
    if (!space) continue;

    const payout = calculateMortgageValue(spaceIndex, prop);
    candidates.push({
      spaceIndex,
      spaceType: space.type,
      buildings: prop.buildings,
      payout,
    });
  }

  // Sort according to strict specification:
  // Group A: Cities (PROPERTY) without houses (buildings === 0)
  // Group B: Non-cities (TRANSIT, UTILITY) without houses
  // Group C: Cities with houses, sorted by HIGHEST number of houses first (buildings descending)
  candidates.sort((a, b) => {
    const isCityA = a.spaceType === 'PROPERTY';
    const isCityB = b.spaceType === 'PROPERTY';

    const hasHousesA = a.buildings > 0;
    const hasHousesB = b.buildings > 0;

    // Rule 1: Cities without houses come first
    if (isCityA && !hasHousesA && (!isCityB || hasHousesB)) return -1;
    if (isCityB && !hasHousesB && (!isCityA || hasHousesA)) return 1;

    // Rule 2: Non-cities without houses come before cities with houses
    if (!hasHousesA && hasHousesB) return -1;
    if (hasHousesA && !hasHousesB) return 1;

    // Rule 3: Among cities with buildings, highest number of houses first
    if (hasHousesA && hasHousesB) {
      if (b.buildings !== a.buildings) {
        return b.buildings - a.buildings; // Descending: 5, 4, 3, 2, 1
      }
    }

    // Secondary: higher payout first to minimize sales
    return b.payout - a.payout;
  });

  // Select properties incrementally until debt is covered
  const selectedIndices: number[] = [];
  let accumulatedPayout = 0;

  for (const c of candidates) {
    selectedIndices.push(c.spaceIndex);
    accumulatedPayout += c.payout;

    if (cpuPlayer.cash + accumulatedPayout >= obligationAmount) {
      return {
        selectedIndices,
        totalPayout: accumulatedPayout,
        canCover: true,
      };
    }
  }

  return {
    selectedIndices,
    totalPayout: accumulatedPayout,
    canCover: cpuPlayer.cash + accumulatedPayout >= obligationAmount,
  };
}

/**
 * Evaluates the next authoritative action for a computer player based on the current game phase.
 */
export function decideNextAction(
  state: GameState,
  cpuPlayer: PlayerState
): CpuActionDecision | null {
  if (state.status === 'COMPLETED') return null;

  // Case 1: Active Financial Obligation
  if (
    state.phase === 'ACTION_REQUIRED' &&
    state.pendingFinancialObligation &&
    state.pendingFinancialObligation.debtorUid === cpuPlayer.uid
  ) {
    const obligation = state.pendingFinancialObligation;

    // If player has enough liquid cash, resolve obligation immediately
    if (cpuPlayer.cash >= obligation.amountDue) {
      return {
        type: 'RESOLVE_OBLIGATION',
        reason: `${cpuPlayer.displayName} has sufficient cash to settle debt of ₹${obligation.amountDue}.`,
      };
    }

    // Need to Sell to Bank (mortgage)
    const sellPlan = decideSellToBankProperties(state, cpuPlayer, obligation.amountDue);

    if (sellPlan.selectedIndices.length > 0) {
      // Pick the next property in priority order
      const nextSpaceIdx = sellPlan.selectedIndices[0];
      const space = BOARD_SPACES[nextSpaceIdx];
      return {
        type: 'MORTGAGE',
        payload: { spaceIndices: [nextSpaceIdx], spaceIndex: nextSpaceIdx },
        reason: `${cpuPlayer.displayName} selected ${space?.name ?? `space ${nextSpaceIdx}`} to sell to bank for debt resolution.`,
      };
    }

    // No eligible properties and cannot afford debt -> must surrender / be disqualified
    return {
      type: 'GIVE_UP',
      payload: { reason: 'BANKRUPT' },
      reason: `${cpuPlayer.displayName} has exhausted all eligible properties and cannot cover debt.`,
    };
  }

  // Actions for the active player during their turn
  if (state.currentPlayerUid !== cpuPlayer.uid) {
    return null;
  }

  switch (state.phase) {
    case 'AWAIT_ROLL':
      return {
        type: 'ROLL_DICE',
        reason: `${cpuPlayer.displayName} rolls the dice.`,
      };

    case 'JAIL_DECISION':
      return decideJailAction(state, cpuPlayer);

    case 'PROPERTY_DECISION':
      return decidePropertyAction(state, cpuPlayer);

    case 'MANAGEMENT': {
      // Evaluate building opportunities first
      const buildTarget = decideBuildingAction(state, cpuPlayer);
      if (buildTarget) {
        const space = BOARD_SPACES[buildTarget.spaceIndex];
        return {
          type: 'BUILD',
          payload: { spaceIndex: buildTarget.spaceIndex },
          reason: `${cpuPlayer.displayName} builds on ${space?.name ?? `space ${buildTarget.spaceIndex}`}.`,
        };
      }
      // No more construction -> complete turn
      return {
        type: 'END_TURN',
        payload: { confirmBuildSkip: true },
        reason: `${cpuPlayer.displayName} finishes turn.`,
      };
    }

    case 'TURN_END':
      return {
        type: 'END_TURN',
        reason: `${cpuPlayer.displayName} finishes turn.`,
      };

    default:
      return null;
  }
}
