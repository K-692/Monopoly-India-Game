/**
 * Indian Monopoly - Ruleset Baseline & Host Custom Rules
 */

import {
  AIRPORT_SPACES,
  BOARD_SPACES,
  PROPERTY_GROUPS,
  RAILWAY_SPACES,
  TRANSIT_SPACES,
  UTILITY_SPACES,
} from './board-config';
import { BoardSpaceDefinition, PendingFinancialObligation, PropertyDefinition, PropertyState } from './game-types';

export const RULESET_VERSION = '1.1.0';

export const STARTING_CASH_MIN = 5000;
export const STARTING_CASH_MAX = 50000;
export const STARTING_CASH_STEP = 5000;
export const STARTING_CASH_DEFAULT = 20000;
export const STARTING_CASH_OPTIONS = [
  5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000,
] as const;
export type StartingCashOption = (typeof STARTING_CASH_OPTIONS)[number];

/**
 * Validates whether the given cash value satisfies starting cash rules:
 * - Must be a number
 * - Must be between ₹5,000 and ₹50,000 (inclusive)
 * - Must be an exact multiple of ₹5,000
 */
export function isValidStartingCash(val: unknown): val is number {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return false;
  return (
    val >= STARTING_CASH_MIN &&
    val <= STARTING_CASH_MAX &&
    val % STARTING_CASH_STEP === 0
  );
}

export const PASS_START_REWARD_OPTIONS = [1000, 2000, 3000] as const;
export type PassStartRewardOption = (typeof PASS_START_REWARD_OPTIONS)[number];

export interface HostCustomRules {
  startingCash: number; // Configurable: ₹5,000 to ₹50,000 in steps of ₹5,000 (default ₹20,000)
  passStartReward: number; // Statutory standard: ₹3,000
  turnTimerSeconds: number; // 3, 15, 30, 45, 60
  maxPlayers: number; // 2..6
  jailBail: number;
  doubleRentMonopoly?: boolean;
  allowAuctions: boolean;
  gameMode: 'STANDARD' | 'TIMED_45' | 'TIMED_60';
}

export const DEFAULT_HOST_RULES: HostCustomRules = {
  startingCash: 20000,
  passStartReward: 3000,
  turnTimerSeconds: 30,
  maxPlayers: 6,
  jailBail: 500,
  allowAuctions: true,
  gameMode: 'STANDARD',
};

export const GAME_CONSTANTS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  STARTING_CASH: 20000,
  START_REWARD: 3000,
  JAIL_BAIL: 500,
  MAX_JAIL_DOUBLES_ATTEMPTS: 3,
  GST_CHECKPOST_AMOUNT: 500,
  INFRASTRUCTURE_LEVY_AMOUNT: 500,
  FINANCIAL_RESOLUTION_TIMER_SECONDS: 120,
  MAX_HOUSES: 4,
  TOWER_BUILDING_LEVEL: 5,
  MORTGAGE_RATE: 0.5,
  UNMORTGAGE_INTEREST: 0.1, // 10% premium on mortgage redemption
  EMOTE_RATE_LIMIT_COUNT: 3,
  EMOTE_RATE_LIMIT_WINDOW_MS: 5000,
  EMOTE_DISPLAY_DURATION_MS: 5000,
  GET_OUT_OF_JAIL_TRADABLE: false, // Invariant: Get Out of Jail cards are personal and non-tradable
};

/**
 * Authoritative accessor for game session bail amount.
 * Reads the session's host-configured rules first, falling back to canonical constant only if undefined.
 */
export function getAuthoritativeBailAmount(
  state?: { rules?: { jailBail?: number } } | null
): number {
  if (state?.rules?.jailBail && typeof state.rules.jailBail === 'number' && state.rules.jailBail > 0) {
    return state.rules.jailBail;
  }
  return GAME_CONSTANTS.JAIL_BAIL;
}

/**
 * Standardizes property terminology across all UI, popups, and financial descriptions.
 * Returns 'City' for developable municipal spaces (type: 'PROPERTY'),
 * and 'Property' for non-city properties (Stations, Airports, Utilities).
 */
export function getPropertyNoun(
  space?: { type: string } | null
): 'City' | 'Property' {
  if (space && space.type === 'PROPERTY') {
    return 'City';
  }
  return 'Property';
}

/**
 * Authoritative Airport Rent Table
 * Visiting player pays significant airport visiting rent based on number of airports owned by owner.
 * - 1 Airport owned: ₹1,000
 * - 2 Airports owned: ₹2,500
 */
export const AIRPORT_RENT_TABLE: Record<number, number> = {
  1: 1000,
  2: 2500,
};

/**
 * Authoritative Railway Rent Table
 * - 1 Railway owned: ₹250
 * - 2 Railways owned: ₹500
 */
export const RAILWAY_RENT_TABLE: Record<number, number> = {
  1: 250,
  2: 500,
};

/**
 * Checks if a player owns all properties in a given color group.
 */
export function hasFullColorGroup(
  group: keyof typeof PROPERTY_GROUPS,
  ownerUid: string,
  properties: Record<number, PropertyState>
): boolean {
  const memberIndices = PROPERTY_GROUPS[group];
  return memberIndices.every(
    (spaceIdx) => properties[spaceIdx]?.ownerUid === ownerUid
  );
}

/**
 * Calculates current rent for any space given board state and dice total.
 */
export function calculateRent(
  spaceIndex: number,
  properties: Record<number, PropertyState>,
  diceTotal: number = 7,
  _rules: HostCustomRules = DEFAULT_HOST_RULES,
  isOwnerInJail: boolean = false
): number {
  // User Rule: If the player is in jail, he/she should not earn any money from other players
  if (isOwnerInJail) {
    return 0;
  }

  const space = BOARD_SPACES[spaceIndex];
  if (!space) return 0;

  const propState = properties[spaceIndex];
  if (!propState || !propState.ownerUid || propState.isMortgaged || propState.ownershipState === 'MORTGAGED' || propState.ownershipState === 'BLOCKED') {
    return 0;
  }

  const ownerUid = propState.ownerUid;

  if (space.type === 'PROPERTY') {
    const p = space as PropertyDefinition;
    // If buildings exist
    if (propState.buildings === 5) return p.rentTower;
    if (propState.buildings === 4) return p.rentHouse4;
    if (propState.buildings === 3) return p.rentHouse3;
    if (propState.buildings === 2) return p.rentHouse2;
    if (propState.buildings === 1) return p.rentHouse1;

    // Unimproved property rent
    return p.baseRent;
  }

  if (space.type === 'TRANSIT') {
    // Separate distinct rent for Airports vs Railways
    if (AIRPORT_SPACES.includes(spaceIndex)) {
      const ownedAirports = AIRPORT_SPACES.filter(
        (idx) =>
          properties[idx]?.ownerUid === ownerUid &&
          !properties[idx]?.isMortgaged &&
          properties[idx]?.ownershipState !== 'MORTGAGED' &&
          properties[idx]?.ownershipState !== 'BLOCKED'
      ).length;
      return AIRPORT_RENT_TABLE[ownedAirports] ?? 0;
    }

    if (RAILWAY_SPACES.includes(spaceIndex)) {
      const ownedRailways = RAILWAY_SPACES.filter(
        (idx) =>
          properties[idx]?.ownerUid === ownerUid &&
          !properties[idx]?.isMortgaged &&
          properties[idx]?.ownershipState !== 'MORTGAGED' &&
          properties[idx]?.ownershipState !== 'BLOCKED'
      ).length;
      return RAILWAY_RENT_TABLE[ownedRailways] ?? 0;
    }

    // Fallback for general transit
    const ownedCount = TRANSIT_SPACES.filter(
      (idx) =>
        properties[idx]?.ownerUid === ownerUid &&
        !properties[idx]?.isMortgaged &&
        properties[idx]?.ownershipState !== 'MORTGAGED' &&
        properties[idx]?.ownershipState !== 'BLOCKED'
    ).length;

    if (ownedCount === 0) return 0;
    return 250 * Math.pow(2, ownedCount - 1);
  }

  if (space.type === 'UTILITY') {
    const ownedCount = UTILITY_SPACES.filter(
      (idx) =>
        properties[idx]?.ownerUid === ownerUid &&
        !properties[idx]?.isMortgaged &&
        properties[idx]?.ownershipState !== 'MORTGAGED' &&
        properties[idx]?.ownershipState !== 'BLOCKED'
    ).length;

    if (ownedCount >= 2) {
      return 10 * diceTotal;
    }
    if (ownedCount === 1) {
      return 4 * diceTotal;
    }
    return 0;
  }

  return 0;
}

/**
 * Determines current property tariff according to existing development level (0..5).
 * 0: baseRent, 1: rentHouse1, 2: rentHouse2, 3: rentHouse3, 4: rentHouse4, 5: rentTower.
 */
export function getCurrentPropertyTariff(
  space: PropertyDefinition,
  buildings: number = 0
): number {
  if (buildings === 1) return space.rentHouse1;
  if (buildings === 2) return space.rentHouse2;
  if (buildings === 3) return space.rentHouse3;
  if (buildings === 4) return space.rentHouse4;
  if (buildings === 5) return space.rentTower;
  return space.baseRent;
}

/**
 * Calculates authoritative Sell-to-Bank mortgage value of a property.
 * - Developable Cities (PROPERTY): Original city price + 80% of current tariff at existing development level.
 *   Formula: space.price + Math.floor(tariff * 0.80)
 * - Non-city assets (Railways, Airports, Utilities): Original deed purchase price (space.price).
 */
export function calculateMortgageValue(
  spaceIndex: number,
  propState?: PropertyState
): number {
  const space = BOARD_SPACES[spaceIndex];
  if (!space || !('price' in space)) return 0;

  if (space.type === 'PROPERTY') {
    const tariff = getCurrentPropertyTariff(
      space as PropertyDefinition,
      propState?.buildings ?? 0
    );
    return space.price + Math.floor(tariff * 0.8);
  }

  // Non-city assets: Railways, Airports, Utilities -> 100% of original deed purchase price
  return space.price;
}

/**
 * Calculates authoritative Reacquisition cost of a bank-owned property.
 * - If explicitly recorded on propState (soldToBankReacquisitionCost), returns that stored amount.
 * - Developable Cities (PROPERTY): Original city price + 50% of current tariff based on preserved development level.
 *   Formula: space.price + Math.floor(tariff * 0.50)
 * - Non-city assets (Railways, Airports, Utilities): Original deed purchase price (space.price).
 */
export function calculateReacquisitionCost(
  spaceIndex: number,
  propState?: PropertyState
): number {
  if (
    propState?.soldToBankReacquisitionCost != null &&
    propState.soldToBankReacquisitionCost > 0
  ) {
    return propState.soldToBankReacquisitionCost;
  }

  const space = BOARD_SPACES[spaceIndex];
  if (!space || !('price' in space)) return 0;

  if (space.type === 'PROPERTY') {
    const tariff = getCurrentPropertyTariff(
      space as PropertyDefinition,
      propState?.buildings ?? 0
    );
    return space.price + Math.floor(tariff * 0.5);
  }

  // Non-city assets: Railways, Airports, Utilities -> Original deed purchase price
  return space.price;
}

/**
 * Calculates authoritative construction cost for the next house or commercial tower on a city.
 * The cost strictly equals the tariff associated with the resulting development level of that city:
 * - Existing 0 houses -> House #1: rentHouse1
 * - Existing 1 house  -> House #2: rentHouse2
 * - Existing 2 houses -> House #3: rentHouse3
 * - Existing 3 houses -> House #4: rentHouse4
 * - Existing 4 houses -> Commercial Tower: rentTower
 * - Existing 5 (or already at maximum): returns 0 (rejects construction)
 */
export function calculateBuildingCost(
  spaceIndex: number,
  currentBuildings: number = 0
): number {
  const space = BOARD_SPACES[spaceIndex];
  if (!space || space.type !== 'PROPERTY') return 0;
  if (currentBuildings >= GAME_CONSTANTS.TOWER_BUILDING_LEVEL) return 0;

  const p = space as PropertyDefinition;
  const nextLevel = currentBuildings + 1;
  if (nextLevel === 1) return p.rentHouse1;
  if (nextLevel === 2) return p.rentHouse2;
  if (nextLevel === 3) return p.rentHouse3;
  if (nextLevel === 4) return p.rentHouse4;
  if (nextLevel === 5) return p.rentTower;
  return 0;
}

/**
 * Checks if a player can build a house/tower on a property.
 * Rule: If the owner player is visiting the city with sufficient money, the player can build it.
 * Note: Building is allowed from the next turn, not in the same turn the player bought the city.
 */
export function canBuildOnProperty(
  spaceIndex: number,
  playerUid: string,
  properties: Record<number, PropertyState>,
  playerCash: number,
  playerPosition?: number,
  currentTurnNumber?: number
): { allowed: boolean; reason?: string } {
  const space = BOARD_SPACES[spaceIndex];
  if (!space || space.type !== 'PROPERTY') {
    return { allowed: false, reason: 'Not a developable city property' };
  }

  const propState = properties[spaceIndex];
  if (!propState || propState.ownerUid !== playerUid) {
    return { allowed: false, reason: 'You do not own this property' };
  }

  if (propState.isMortgaged) {
    return { allowed: false, reason: 'Property is currently mortgaged' };
  }

  // Not allowed in the same turn the city was bought (allowed from next turn)
  if (
    propState.boughtOnTurn !== undefined &&
    currentTurnNumber !== undefined &&
    currentTurnNumber <= propState.boughtOnTurn
  ) {
    return {
      allowed: false,
      reason: 'Building allowed from next turn, not in the same turn city was bought',
    };
  }

  // Owner player must be visiting this city
  if (playerPosition !== undefined && playerPosition !== spaceIndex) {
    return { allowed: false, reason: 'Must be visiting this city to build on it' };
  }

  if (propState.buildings >= GAME_CONSTANTS.TOWER_BUILDING_LEVEL) {
    return { allowed: false, reason: 'Maximum development (Commercial Tower) already reached' };
  }

  const cost = calculateBuildingCost(spaceIndex, propState.buildings);
  if (cost <= 0) {
    return { allowed: false, reason: 'Cannot construct further on this property' };
  }

  if (playerCash < cost) {
    return { allowed: false, reason: `Insufficient cash (needs ₹${cost.toLocaleString('en-IN')})` };
  }

  return { allowed: true };
}

/**
 * Calculates authoritative net worth of a player:
 * NET WORTH = Cash Balance + Total Owned Asset Value - Outstanding Liabilities
 *
 * Components:
 * - Cash Balance: Actual remaining cash (can be negative during debt crisis).
 * - Total Owned Asset Value:
 *   - Unmortgaged properties / transit / utilities: base deed price.
 *   - Mortgaged properties / transit / utilities: mortgage payout value.
 *   - Houses / commercial towers: cumulative invested development tariffs.
 *   - Bank-owned / unowned properties: ₹0 (not owned).
 * - Outstanding Liabilities:
 *   - Unfulfilled remaining amount due from pending financial obligation.
 */
export function calculateNetWorth(
  playerUid: string,
  cash: number,
  properties: Record<number, PropertyState>,
  liabilities?: number | PendingFinancialObligation | null
): number {
  let assetVal = 0;

  for (const space of BOARD_SPACES) {
    const propState = properties[space.spaceIndex];
    if (propState && propState.ownerUid === playerUid && propState.ownershipState !== 'BLOCKED') {
      if ('price' in space) {
        if (propState.isMortgaged || propState.ownershipState === 'MORTGAGED') {
          assetVal += propState.mortgagePayout ?? space.mortgageValue;
        } else {
          assetVal += space.price;
        }
      }
      if (space.type === 'PROPERTY' && propState.buildings > 0) {
        const p = space as PropertyDefinition;
        let cumulativeBuildingInvestment = 0;
        if (propState.buildings >= 1) cumulativeBuildingInvestment += p.rentHouse1;
        if (propState.buildings >= 2) cumulativeBuildingInvestment += p.rentHouse2;
        if (propState.buildings >= 3) cumulativeBuildingInvestment += p.rentHouse3;
        if (propState.buildings >= 4) cumulativeBuildingInvestment += p.rentHouse4;
        if (propState.buildings >= 5) cumulativeBuildingInvestment += p.rentTower;
        assetVal += cumulativeBuildingInvestment;
      }
    }
  }

  let debt = 0;
  if (typeof liabilities === 'number') {
    debt = Math.max(0, liabilities);
  } else if (
    liabilities &&
    liabilities.debtorUid === playerUid &&
    (liabilities.status === 'PENDING' || liabilities.status === 'RESOLVING')
  ) {
    debt = Math.max(0, liabilities.remainingAmountDue ?? liabilities.amountDue);
  }

  return cash + assetVal - debt;
}

export interface EligibleSellToBankProperty {
  spaceIndex: number;
  space: BoardSpaceDefinition;
  prop: PropertyState;
  mortgageVal: number;
  maxTariff: number;
}

/**
 * Returns eligible properties owned by a debtor that can be sold to the bank,
 * sorted according to authoritative liquidation priority:
 * 1. Lowest actual Sell-to-Bank payout first (mortgageVal in ascending order)
 * 2. Fewer buildings first ((a.prop.buildings ?? 0) - (b.prop.buildings ?? 0)) when payouts are equal
 * 3. spaceIndex in ascending order as stable tie-breaker when payouts and buildings are equal.
 *
 * Excludes properties that are:
 * - Not owned by the debtor
 * - prop.ownershipState === 'UNOWNED'
 * - Already mortgaged (isMortgaged === true or ownershipState === 'MORTGAGED')
 * - Permanently blocked (ownershipState === 'BLOCKED')
 */
export function getSortedEligibleSellToBankProperties(
  debtorUid: string,
  properties: Record<number, PropertyState>
): EligibleSellToBankProperty[] {
  return Object.entries(properties)
    .filter(
      ([_, prop]) =>
        prop &&
        prop.ownerUid === debtorUid &&
        prop.ownershipState !== 'UNOWNED' &&
        !prop.isMortgaged &&
        prop.ownershipState !== 'MORTGAGED' &&
        prop.ownershipState !== 'BLOCKED'
    )
    .map(([idx, prop]) => {
      const spaceIndex = Number(idx);
      const space = BOARD_SPACES[spaceIndex];
      const mortgageVal = calculateMortgageValue(spaceIndex, prop);
      // Authoritative maximum potential tariff at current development level (dice = 12 for utilities)
      const maxTariff = calculateRent(spaceIndex, properties, 12, undefined, false);
      return {
        spaceIndex,
        space,
        prop,
        mortgageVal,
        maxTariff,
      };
    })
    .sort((a, b) => {
      if (a.mortgageVal !== b.mortgageVal) {
        return a.mortgageVal - b.mortgageVal;
      }
      const aBuildings = a.prop.buildings ?? 0;
      const bBuildings = b.prop.buildings ?? 0;
      if (aBuildings !== bBuildings) {
        return aBuildings - bBuildings;
      }
      return a.spaceIndex - b.spaceIndex;
    });
}

/**
 * Formats total gameplay elapsed time into HH:MM:SS format.
 * - Always starts from "00:00:00".
 * - Examples: 0 -> "00:00:00", 65 -> "00:01:05", 3600 -> "01:00:00", 3665 -> "01:01:05".
 * - Hours keep counting past 99 (e.g. 360000 -> "100:00:00").
 */
export function formatGameTimer(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

