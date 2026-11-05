/**
 * Indian Monopoly - Pure Initial State Generator with Host Rules
 */

import { BOARD_SPACES } from '../board-config';
import { FinancialTransaction, GameState, PlayerState, PropertyState, RoomMember } from '../game-types';
import { DEFAULT_HOST_RULES, HostCustomRules, RULESET_VERSION } from '../ruleset';

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
  members: Record<string, RoomMember>,
  customRules: HostCustomRules = DEFAULT_HOST_RULES
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
        ownershipState: 'UNOWNED',
        isMortgaged: false,
        mortgagePayout: 0,
        buildings: 0,
      };
    }
  }

  // Initialize players with host-configured starting cash
  const startingCash = customRules.startingCash || DEFAULT_HOST_RULES.startingCash;
  const timerLimit = customRules.turnTimerSeconds || DEFAULT_HOST_RULES.turnTimerSeconds;

  const players: PlayerState[] = memberList.map((m, index) => ({
    uid: m.uid,
    displayName: m.displayName || `Player ${index + 1}`,
    photoURL: m.photoURL || null,
    cash: startingCash,
    netWorth: startingCash,
    position: 0, // START
    inJail: false,
    jailTurns: 0,
    jailFreeCards: 0,
    isBankrupt: false,
    colorToken: m.colorToken || PLAYER_COLORS[index % PLAYER_COLORS.length],
    turnTimeoutCount: 0,
  }));

  const now = Date.now();

  const transactions: FinancialTransaction[] = players.map((p, idx) => ({
    transactionId: `tx_init_${p.uid}_${now}`,
    gameSessionId: gameId,
    playerUid: p.uid,
    type: 'STARTING_BALANCE',
    direction: 'CREDIT',
    amount: startingCash,
    balanceBefore: 0,
    balanceAfter: startingCash,
    description: `Initial starting capital of ₹${startingCash.toLocaleString('en-IN')} allocated from Reserve Bank.`,
    timestamp: now + idx,
  }));

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
    pendingFinancialObligation: null,
    transactions,
    dice: null,
    auction: null,
    activeTrade: null,
    winnerUid: null,
    turnTimeRemaining: timerLimit,
    turnTimeLimit: timerLimit,
    rules: customRules,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
}
