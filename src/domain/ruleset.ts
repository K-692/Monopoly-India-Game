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
import { PropertyDefinition, PropertyState } from './game-types';

export const RULESET_VERSION = '1.1.0';

export const STARTING_CASH_OPTIONS = [5000, 10000, 20000] as const;
export type StartingCashOption = (typeof STARTING_CASH_OPTIONS)[number];

export const PASS_START_REWARD_OPTIONS = [1000, 2000, 3000] as const;
export type PassStartRewardOption = (typeof PASS_START_REWARD_OPTIONS)[number];

export interface HostCustomRules {
  startingCash: number; // Dynamic options: 5000, 10000, 20000
  passStartReward: number; // Dynamic options: 1000, 2000, 3000
  turnTimerSeconds: number; // 15, 30, 45, 60, 90
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
  maxPlayers: 4,
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
 * Calculates authoritative mortgage value of a property.
 * Baseline: 50% of original property purchase price.
 * Accounts for development investment (50% of house/building expenditure),
 * capped so the payout never exceeds original property purchase price.
 */
export function calculateMortgageValue(
  spaceIndex: number,
  propState?: PropertyState
): number {
  const space = BOARD_SPACES[spaceIndex];
  if (!space || !('price' in space)) return 0;

  const basePrice = space.price;
  const baseMortgage = Math.floor(basePrice * GAME_CONSTANTS.MORTGAGE_RATE);

  if (space.type === 'PROPERTY') {
    const p = space as PropertyDefinition;
    const buildings = propState?.buildings ?? 0;
    const buildingInvestment = buildings * p.buildingCost;
    const devMortgage = Math.floor(buildingInvestment * GAME_CONSTANTS.MORTGAGE_RATE);
    // Payout must never exceed original property purchase price
    return Math.min(basePrice, baseMortgage + devMortgage);
  }

  return baseMortgage;
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

  if (playerCash < space.buildingCost) {
    return { allowed: false, reason: `Insufficient cash (needs ₹${space.buildingCost.toLocaleString('en-IN')})` };
  }

  return { allowed: true };
}

/**
 * Calculates net worth of a player.
 */
export function calculateNetWorth(
  playerUid: string,
  cash: number,
  properties: Record<number, PropertyState>
): number {
  let propertyVal = 0;

  for (const space of BOARD_SPACES) {
    const propState = properties[space.spaceIndex];
    if (propState && propState.ownerUid === playerUid && propState.ownershipState !== 'BLOCKED') {
      if ('price' in space) {
        if (propState.isMortgaged || propState.ownershipState === 'MORTGAGED') {
          propertyVal += propState.mortgagePayout ?? space.mortgageValue;
        } else {
          propertyVal += space.price;
        }
      }
      if (space.type === 'PROPERTY') {
        propertyVal += propState.buildings * (space as PropertyDefinition).buildingCost;
      }
    }
  }

  return cash + propertyVal;
}
