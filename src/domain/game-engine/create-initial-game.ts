/**
 * Indian Monopoly - Pure Initial State Generator
 */

import { BOARD_SPACES } from '../board-config';
import { GameState, PlayerState, PropertyState, RoomMember } from '../game-types';
import { GAME_CONSTANTS, RULESET_VERSION } from '../ruleset';

const PLAYER_COLORS = [
  '#C85A32', // Terracotta Rust
  '#1A2B4C', // Royal Navy
  '#E5A93C', // Mustard Gold
  '#2D6A4F', // Emerald Green
  '#9D0208', // Spice Crimson
  '#5C2D5A', // Royal Purple
];

export function createInitialGame(
  roomId: string,
  gameId: string,
  members: Record<string, RoomMember>
): GameState {
  const memberList = Object.values(members);
  const playerOrder = memberList.map((m) => m.uid);

  // Initialize all properties on the board as unowned
  const properties: Record<number, PropertyState> = {};
  for (const space of BOARD_SPACES) {
    if (
      space.type === 'PROPERTY' ||
      space.type === 'TRANSIT' ||
      space.type === 'UTILITY'
    ) {
      properties[space.spaceIndex] = {
        spaceIndex: space.spaceIndex,
        propertyId: space.id,
        ownerUid: null,
        isMortgaged: false,
        buildings: 0,
      };
    }
  }

  // Initialize players with starting cash ₹15,000
  const players: PlayerState[] = memberList.map((m, index) => ({
    uid: m.uid,
    displayName: m.displayName || `Player ${index + 1}`,
    photoURL: m.photoURL || null,
    cash: GAME_CONSTANTS.STARTING_CASH,
    netWorth: GAME_CONSTANTS.STARTING_CASH,
    position: 0, // START
    inJail: false,
    jailTurns: 0,
    jailFreeCards: 0,
    isBankrupt: false,
    colorToken: m.colorToken || PLAYER_COLORS[index % PLAYER_COLORS.length],
    turnTimeoutCount: 0,
  }));

  const now = Date.now();

  return {
    roomId,
    gameId,
    rulesetVersion: RULESET_VERSION,
    version: 1,
    status: 'IN_PROGRESS',
    playerOrder,
    currentPlayerUid: playerOrder[0],
    turnNumber: 1,
    phase: 'AWAIT_ROLL',
    players,
    properties,
    pendingAction: null,
    dice: null,
    auction: null,
    activeTrade: null,
    winnerUid: null,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
}
