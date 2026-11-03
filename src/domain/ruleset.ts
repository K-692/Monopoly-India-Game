/**
 * Indian Monopoly - Ruleset Baseline & Mathematical Formulas
 */

import { BOARD_SPACES, PROPERTY_GROUPS, TRANSIT_SPACES, UTILITY_SPACES } from './board-config';
import { PropertyDefinition, PropertyState } from './game-types';

export const RULESET_VERSION = '1.0.0';

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
  EMOTE_DISPLAY_DURATION_MS: 6000,
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
  diceTotal: number = 7
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

    // Unimproved: double rent if whole group owned
    if (hasFullColorGroup(p.group, ownerUid, properties)) {
      return p.baseRent * 2;
    }
    return p.baseRent;
  }

  if (space.type === 'TRANSIT') {
    // Count active (unmortgaged) transit spaces owned by same player
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
 * Checks if a player can build a house/tower on a property (enforcing even-building rule).
 */
export function canBuildOnProperty(
  spaceIndex: number,
  playerUid: string,
  properties: Record<number, PropertyState>,
  playerCash: number
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

  if (!hasFullColorGroup(space.group, playerUid, properties)) {
    return { allowed: false, reason: 'Must own all properties in the color set to build' };
  }

  const groupIndices = PROPERTY_GROUPS[space.group];
  // Any mortgaged property in the group prevents development
  const hasMortgagedInGroup = groupIndices.some((idx) => properties[idx]?.isMortgaged);
  if (hasMortgagedInGroup) {
    return { allowed: false, reason: 'Cannot build while any property in the group is mortgaged' };
  }

  if (propState.buildings >= GAME_CONSTANTS.TOWER_BUILDING_LEVEL) {
    return { allowed: false, reason: 'Maximum development (Commercial Tower) already reached' };
  }

  if (playerCash < space.buildingCost) {
    return { allowed: false, reason: `Insufficient cash (needs ₹${space.buildingCost})` };
  }

  // Enforce even-building rule: difference between max and min buildings in group <= 1
  const currentLevel = propState.buildings;
  const groupLevels = groupIndices.map((idx) => properties[idx]?.buildings ?? 0);
  const minLevel = Math.min(...groupLevels);

  if (currentLevel > minLevel) {
    return { allowed: false, reason: 'Must develop evenly across all properties in the group' };
  }

  return { allowed: true };
}

/**
 * Calculates net worth of a player (cash + unmortgaged property value + half mortgaged value + buildings value).
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
