/**
 * Indian Monopoly - Ruleset Baseline & Host Custom Rules
 */

import { BOARD_SPACES, PROPERTY_GROUPS, TRANSIT_SPACES, UTILITY_SPACES } from './board-config';
import { PropertyDefinition, PropertyState } from './game-types';

export const RULESET_VERSION = '1.0.0';

export interface HostCustomRules {
  startingCash: number;
  passStartReward: number;
  turnTimerSeconds: number; // 15, 30, 45, 60, 90
  maxPlayers: number; // 2..6
  jailBail: number;
  doubleRentMonopoly: boolean;
  allowAuctions: boolean;
  gameMode: 'STANDARD' | 'TIMED_45' | 'TIMED_60';
}

export const DEFAULT_HOST_RULES: HostCustomRules = {
  startingCash: 15000,
  passStartReward: 2000,
  turnTimerSeconds: 30,
  maxPlayers: 4,
  jailBail: 500,
  doubleRentMonopoly: true,
  allowAuctions: true,
  gameMode: 'STANDARD',
};

export const GAME_CONSTANTS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  STARTING_CASH: 15000,
  START_REWARD: 2000,
  JAIL_BAIL: 500,
  MAX_JAIL_DOUBLES_ATTEMPTS: 3,
  GST_CHECKPOST_AMOUNT: 2000,
  INFRASTRUCTURE_LEVY_AMOUNT: 1000,
  MAX_HOUSES: 4,
  TOWER_BUILDING_LEVEL: 5,
  MORTGAGE_RATE: 0.5,
  UNMORTGAGE_INTEREST: 0.1, // 10% premium on mortgage redemption
  EMOTE_RATE_LIMIT_COUNT: 3,
  EMOTE_RATE_LIMIT_WINDOW_MS: 5000,
  EMOTE_DISPLAY_DURATION_MS: 5000,
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
  rules: HostCustomRules = DEFAULT_HOST_RULES
): number {
  const space = BOARD_SPACES[spaceIndex];
  if (!space) return 0;

  const propState = properties[spaceIndex];
  if (!propState || !propState.ownerUid || propState.isMortgaged) {
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

    // Unimproved: double rent if whole group owned and host rule enabled
    if (rules.doubleRentMonopoly && hasFullColorGroup(p.group, ownerUid, properties)) {
      return p.baseRent * 2;
    }
    return p.baseRent;
  }

  if (space.type === 'TRANSIT') {
    const ownedCount = TRANSIT_SPACES.filter(
      (idx) => properties[idx]?.ownerUid === ownerUid && !properties[idx]?.isMortgaged
    ).length;

    if (ownedCount === 0) return 0;
    // 1 transit: 250, 2: 500, 3: 1000, 4: 2000
    return 250 * Math.pow(2, ownedCount - 1);
  }

  if (space.type === 'UTILITY') {
    const ownedCount = UTILITY_SPACES.filter(
      (idx) => properties[idx]?.ownerUid === ownerUid && !properties[idx]?.isMortgaged
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
    if (propState && propState.ownerUid === playerUid) {
      if ('price' in space) {
        if (propState.isMortgaged) {
          propertyVal += space.mortgageValue;
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
