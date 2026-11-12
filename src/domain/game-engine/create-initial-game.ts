/**
 * Indian Monopoly - Pure Initial State Generator with Host Rules
 */

import { BOARD_SPACES } from '../board-config';
import { FinancialTransaction, GameState, PlayerState, PropertyState, RoomMember } from '../game-types';
import { DEFAULT_HOST_RULES, HostCustomRules, RULESET_VERSION, isValidStartingCash, PASS_START_REWARD_OPTIONS } from '../ruleset';

const PLAYER_COLORS = [
  '#C85A32', // Terracotta Rust
  '#1A2B4C', // Royal Navy
  '#E5A93C', // Mustard Gold
  '#2D6A4F', // Emerald Green
  '#9D0208', // Spice Crimson
  '#5C2D5A', // Royal Purple
];

/**
 * Unbiased cryptographically secure integer in [min, maxExclusive) using rejection sampling.
 */
export function secureRandomInt(min: number, maxExclusive: number): number {
  const range = maxExclusive - min;
  if (range <= 0) return min;

  // Node.js crypto
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crypto = require('crypto');
      if (typeof crypto.randomInt === 'function') {
        return crypto.randomInt(min, maxExclusive);
      }
    } catch {
      // fallback
    }
  }

  // Web Crypto API
  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto
      ? globalThis.crypto
      : typeof crypto !== 'undefined'
      ? crypto
      : null;

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const maxUint32 = 0xffffffff;
    const limit = maxUint32 - (maxUint32 % range);
    const buffer = new Uint32Array(1);
    while (true) {
      cryptoObj.getRandomValues(buffer);
      if (buffer[0] < limit) {
        return min + (buffer[0] % range);
      }
    }
  }

  throw new Error('Cryptographically secure random number generator is unavailable.');
}

/**
 * Unbiased Fisher-Yates shuffle of an array using cryptographically secure random bytes.
 */
export function secureFisherYatesShuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(0, i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export function createInitialGame(
  roomId: string,
  gameId: string,
  members: Record<string, RoomMember>,
  customRules: HostCustomRules = DEFAULT_HOST_RULES,
  startingPlayerUid?: string,
  options?: { forcedPlayerOrder?: string[]; randomizeOrder?: boolean }
): GameState {
  // Authoritative starting balance validation (Slider: ₹5,000 to ₹50,000 in increments of ₹5,000, default: ₹20,000)
  const startingCash = isValidStartingCash(customRules?.startingCash)
    ? customRules.startingCash
    : DEFAULT_HOST_RULES.startingCash;

  // Pass START reward: accepts valid options (1000, 2000, 3000), default: ₹3,000
  const passStartReward = (PASS_START_REWARD_OPTIONS as readonly number[]).includes(customRules?.passStartReward ?? 0)
    ? customRules.passStartReward
    : DEFAULT_HOST_RULES.passStartReward;

  const sanitizedRules: HostCustomRules = {
    ...customRules,
    startingCash,
    passStartReward,
    jailBail: 500,
  };

  const memberList = Object.values(members);
  const initialPlayerOrder = memberList.map((m) => m.uid);

  // Authoritative turn order selection
  let playerOrder: string[];
  if (options?.forcedPlayerOrder && options.forcedPlayerOrder.length === initialPlayerOrder.length) {
    playerOrder = [...options.forcedPlayerOrder];
  } else if (options?.randomizeOrder) {
    playerOrder = secureFisherYatesShuffle(initialPlayerOrder);
  } else if (startingPlayerUid) {
    // Deterministic test / rotation support
    const startIdx = initialPlayerOrder.indexOf(startingPlayerUid);
    const validStartIdx = startIdx >= 0 ? startIdx : 0;
    playerOrder =
      validStartIdx > 0
        ? [...initialPlayerOrder.slice(validStartIdx), ...initialPlayerOrder.slice(0, validStartIdx)]
        : initialPlayerOrder;
  } else {
    playerOrder = initialPlayerOrder;
  }

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
        soldToBankPayout: 0,
        soldToBankReacquisitionCost: 0,
        buildings: 0,
      };
    }
  }

  // Initialize players matching the exact authoritative playerOrder
  const initialCash = sanitizedRules.startingCash;
  const timerLimit = sanitizedRules.turnTimerSeconds || DEFAULT_HOST_RULES.turnTimerSeconds;

  const players: PlayerState[] = playerOrder.map((uid, index) => {
    const m = members[uid] || memberList.find((mem) => mem.uid === uid)!;
    return {
      uid: m.uid,
      displayName: m.displayName || `Player ${index + 1}`,
      photoURL: m.photoURL || null,
      cash: initialCash,
      netWorth: initialCash,
      position: 0, // START
      inJail: false,
      jailTurns: 0,
      jailFreeCards: 0,
      isBankrupt: false,
      colorToken: m.colorToken || PLAYER_COLORS[index % PLAYER_COLORS.length],
      turnTimeoutCount: 0,
      isCpu: Boolean(m.isCpu),
      playerType: m.playerType || (m.isCpu ? 'COMPUTER' : 'HUMAN'),
      roomJoinSequence: m.roomJoinSequence ?? (index + 1),
    };
  });

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
    rules: sanitizedRules,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
}
