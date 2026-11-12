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

import { BOARD_SPACES } from '../board-config';
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
  calculateMortgageValue,
  calculateReacquisitionCost,
  canBuildOnProperty,
  getAuthoritativeBailAmount,
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
    if (cpuPlayer.cash >= opp.cost) {
      return {
        type: 'UNMORTGAGE',
        payload: { spaceIndex: opp.spaceIndex },
        reason: `${cpuPlayer.displayName} reacquired property at space ${opp.spaceIndex} for ₹${opp.cost}.`,
      };
    }
    return {
      type: 'DECLINE_REACQUISITION',
      reason: `${cpuPlayer.displayName} declined reacquisition due to insufficient balance.`,
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

  // Strategic evaluation:
  // In Monopoly, acquiring properties is critical for rental income.
  // We keep a small buffer of ₹300, unless the purchase completes a monopoly or acquires infrastructure.
  const isMonopolyCandidate =
    space.type === 'PROPERTY' &&
    checkIfCompletesMonopoly(cpuPlayer.uid, space as PropertyDefinition, state.properties);

  const isInfrastructure = space.type === 'TRANSIT' || space.type === 'UTILITY';

  const minBuffer = isMonopolyCandidate || isInfrastructure ? 0 : 300;

  if (cpuPlayer.cash - price >= minBuffer || isBankAcquisition) {
    return {
      type: 'BUY_PROPERTY',
      reason: isBankAcquisition
        ? `${cpuPlayer.displayName} acquired bank-sold property ${space.name} for ₹${price} inheriting all developments.`
        : `${cpuPlayer.displayName} purchased ${space.name} for ₹${price}.`,
    };
  }

  // If cash is extremely tight and purchase does not yield high strategic value
  return {
    type: 'BUY_PROPERTY', // Still prefer purchasing as long as cash >= price
    reason: `${cpuPlayer.displayName} purchased ${space.name} for ₹${price}.`,
  };
}

/**
 * Checks whether acquiring this property would give the player a complete color group monopoly.
 */
function checkIfCompletesMonopoly(
  playerUid: string,
  targetSpace: PropertyDefinition,
  properties: Record<number, PropertyState>
): boolean {
  const group = targetSpace.group;
  const groupSpaces = BOARD_SPACES.filter(
    (s): s is PropertyDefinition & { type: 'PROPERTY' } =>
      s.type === 'PROPERTY' && (s as PropertyDefinition).group === group
  );

  // Check if player owns all other properties in this group
  for (const s of groupSpaces) {
    if (s.spaceIndex === targetSpace.spaceIndex) continue;
    const prop = properties[s.spaceIndex];
    if (!prop || prop.ownerUid !== playerUid) {
      return false;
    }
  }
  return true;
}

/**
 * Evaluates building decisions during MANAGEMENT phase:
 * In Indian Monopoly, a player can build a house/tower on a city when:
 * 1. The player is visiting that city (cpuPlayer.position === spaceIndex).
 * 2. It is not the same turn they bought it.
 * 3. Cash reserve is healthy (at least ₹1,500 retained).
 * 4. Maximum tower level not yet reached.
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

  const propDef = space as PropertyDefinition;
  const cost = propDef.buildingCost;

  // Check cash reserve requirement
  if (cpuPlayer.cash - cost < LIQUIDITY_RESERVE) return null;

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
