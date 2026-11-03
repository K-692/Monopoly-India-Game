/**
 * Indian Monopoly - Pure Functional Authoritative Game Engine
 * Evaluates state transitions deterministically with zero side effects.
 */

import { BOARD_SPACES, CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS } from '../board-config';
import {
  CardAction,
  GameCommand,
  GameEvent,
  GameState,
  PlayerState,
  PropertyDefinition,
  TransitDefinition,
  UtilityDefinition,
} from '../game-types';
import {
  calculateNetWorth,
  calculateRent,
  canBuildOnProperty,
  GAME_CONSTANTS,
} from '../ruleset';

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

export function applyGameCommand(
  currentState: GameState,
  command: GameCommand,
  actorUid: string,
  injectedDice?: [number, number]
): EngineResult {
  // Validate basic state preconditions
  if (currentState.status === 'COMPLETED') {
    throw new GameEngineError('GAME_ALREADY_COMPLETED', 'Game has already concluded');
  }

  if (command.expectedVersion !== currentState.version) {
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

      // Generate server dice (1-6)
      const d1 = injectedDice ? injectedDice[0] : Math.floor(Math.random() * 6) + 1;
      const d2 = injectedDice ? injectedDice[1] : Math.floor(Math.random() * 6) + 1;
      const isDouble = d1 === d2;
      const consecutiveDoubles = isDouble
        ? (state.dice?.consecutiveDoubles ?? 0) + 1
        : 0;

      state.dice = {
        first: d1,
        second: d2,
        isDouble,
        consecutiveDoubles,
        rolledAt: Date.now(),
      };

      summary = `${player.displayName} rolled ${d1} + ${d2} = ${d1 + d2}${isDouble ? ' (Doubles!)' : ''}`;
      eventPayload = { d1, d2, isDouble, consecutiveDoubles };

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

      // Passing or landing on START awards ₹2,000
      if (newPos < oldPos && oldPos + steps >= 40) {
        player.cash += GAME_CONSTANTS.START_REWARD;
        summary += ` — Passed START, collected ₹${GAME_CONSTANTS.START_REWARD}!`;
      }

      // Resolve destination space
      resolveLandingSpace(state, player, newPos, d1 + d2);
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
      if (propState.ownerUid) {
        throw new GameEngineError('INVALID_ACTION', 'Property is already owned');
      }

      const price = (space as PropertyDefinition | TransitDefinition | UtilityDefinition).price;
      if (player.cash < price) {
        throw new GameEngineError('INSUFFICIENT_FUNDS', `Need ₹${price}, have ₹${player.cash}`);
      }

      player.cash -= price;
      propState.ownerUid = player.uid;
      state.pendingAction = null;
      state.phase = 'MANAGEMENT';

      summary = `${player.displayName} bought ${space.name} for ₹${price}`;
      eventPayload = { spaceIndex: space.spaceIndex, price };
      break;
    }

    case 'DECLINE_PROPERTY': {
      if (actorUid !== state.currentPlayerUid) {
        throw new GameEngineError('NOT_YOUR_TURN', 'Only active player can decline');
      }
      const player = state.players.find((p) => p.uid === actorUid);
      state.pendingAction = null;
      state.phase = 'MANAGEMENT';
      summary = `${player?.displayName ?? 'Player'} declined to buy property`;
      break;
    }

    case 'PAY_BAIL': {
      const player = state.players.find((p) => p.uid === actorUid);
      if (!player || !player.inJail) {
        throw new GameEngineError('INVALID_ACTION', 'Player is not in jail');
      }
      if (player.cash < GAME_CONSTANTS.JAIL_BAIL) {
        throw new GameEngineError('INSUFFICIENT_FUNDS', `Need ₹${GAME_CONSTANTS.JAIL_BAIL} for bail`);
      }

      player.cash -= GAME_CONSTANTS.JAIL_BAIL;
      player.inJail = false;
      player.jailTurns = 0;
      state.phase = 'AWAIT_ROLL';
      summary = `${player.displayName} paid ₹${GAME_CONSTANTS.JAIL_BAIL} bail and is free`;
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
      state.phase = 'AWAIT_ROLL';
      summary = `${player.displayName} used a Get Out of Jail Free card!`;
      break;
    }

    case 'TRY_DOUBLES': {
      const player = state.players.find((p) => p.uid === actorUid);
      if (!player || !player.inJail) {
        throw new GameEngineError('INVALID_ACTION', 'Player is not in jail');
      }

      const d1 = injectedDice ? injectedDice[0] : Math.floor(Math.random() * 6) + 1;
      const d2 = injectedDice ? injectedDice[1] : Math.floor(Math.random() * 6) + 1;
      const isDouble = d1 === d2;

      summary = `${player.displayName} rolled ${d1} & ${d2} in jail`;

      if (isDouble) {
        player.inJail = false;
        player.jailTurns = 0;
        player.position = (10 + d1 + d2) % 40;
        summary += ' — Doubles! Released from jail!';
        resolveLandingSpace(state, player, player.position, d1 + d2);
      } else {
        player.jailTurns += 1;
        summary += ` — Not doubles (attempt ${player.jailTurns}/${GAME_CONSTANTS.MAX_JAIL_DOUBLES_ATTEMPTS})`;
        if (player.jailTurns >= GAME_CONSTANTS.MAX_JAIL_DOUBLES_ATTEMPTS) {
          // Mandatory bail
          if (player.cash >= GAME_CONSTANTS.JAIL_BAIL) {
            player.cash -= GAME_CONSTANTS.JAIL_BAIL;
            player.inJail = false;
            player.jailTurns = 0;
            player.position = (10 + d1 + d2) % 40;
            summary += ` — Max attempts reached. Paid ₹${GAME_CONSTANTS.JAIL_BAIL} bail and moved.`;
            resolveLandingSpace(state, player, player.position, d1 + d2);
          } else {
            state.phase = 'TURN_END';
          }
        } else {
          state.phase = 'TURN_END';
        }
      }
      break;
    }

    case 'BUILD': {
      const spaceIdx = Number(command.payload.spaceIndex);
      const player = state.players.find((p) => p.uid === actorUid);
      if (!player) throw new GameEngineError('INVALID_ACTION', 'Player not found');

      const check = canBuildOnProperty(spaceIdx, actorUid, state.properties, player.cash);
      if (!check.allowed) {
        throw new GameEngineError('INVALID_ACTION', check.reason || 'Cannot build here');
      }

      const space = BOARD_SPACES[spaceIdx] as PropertyDefinition;
      player.cash -= space.buildingCost;
      state.properties[spaceIdx].buildings += 1;

      const level = state.properties[spaceIdx].buildings;
      const buildingName = level === 5 ? 'Commercial Tower' : `House #${level}`;
      summary = `${player.displayName} built a ${buildingName} on ${space.name}`;
      eventPayload = { spaceIndex: spaceIdx, level };
      break;
    }

    case 'MORTGAGE': {
      const spaceIdx = Number(command.payload.spaceIndex);
      const player = state.players.find((p) => p.uid === actorUid);
      const propState = state.properties[spaceIdx];
      const space = BOARD_SPACES[spaceIdx] as PropertyDefinition;

      if (!propState || propState.ownerUid !== actorUid) {
        throw new GameEngineError('INVALID_ACTION', 'You do not own this property');
      }
      if (propState.isMortgaged) {
        throw new GameEngineError('INVALID_ACTION', 'Already mortgaged');
      }
      if (propState.buildings > 0) {
        throw new GameEngineError('INVALID_ACTION', 'Must sell all buildings in group before mortgaging');
      }

      propState.isMortgaged = true;
      if (player) {
        player.cash += space.mortgageValue;
      }
      summary = `${player?.displayName ?? 'Player'} mortgaged ${space.name} for ₹${space.mortgageValue}`;
      eventPayload = { spaceIndex: spaceIdx };
      break;
    }

    case 'UNMORTGAGE': {
      const spaceIdx = Number(command.payload.spaceIndex);
      const player = state.players.find((p) => p.uid === actorUid);
      const propState = state.properties[spaceIdx];
      const space = BOARD_SPACES[spaceIdx] as PropertyDefinition;

      if (!propState || propState.ownerUid !== actorUid || !propState.isMortgaged) {
        throw new GameEngineError('INVALID_ACTION', 'Property is not mortgaged');
      }
      if (!player || player.cash < space.unmortgageCost) {
        throw new GameEngineError('INSUFFICIENT_FUNDS', `Need ₹${space.unmortgageCost} to unmortgage`);
      }

      player.cash -= space.unmortgageCost;
      propState.isMortgaged = false;
      summary = `${player.displayName} redeemed mortgage on ${space.name} for ₹${space.unmortgageCost}`;
      eventPayload = { spaceIndex: spaceIdx };
      break;
    }

    case 'END_TURN': {
      if (actorUid !== state.currentPlayerUid) {
        throw new GameEngineError('NOT_YOUR_TURN', 'Only active player can end turn');
      }
      if (state.pendingAction) {
        throw new GameEngineError('INVALID_ACTION', 'Must resolve pending action before ending turn');
      }

      // If rolled doubles (and not sent to jail), player rolls again
      const currentActive = state.players.find((p) => p.uid === actorUid);
      if (
        state.dice?.isDouble &&
        !currentActive?.inJail &&
        (state.dice?.consecutiveDoubles ?? 0) < 3
      ) {
        state.phase = 'AWAIT_ROLL';
        summary = `${currentActive?.displayName} rolled doubles and gets another turn!`;
        break;
      }

      // Advance to next solvent player
      advanceTurn(state);
      const nextPlayer = state.players.find((p) => p.uid === state.currentPlayerUid);
      summary = `Turn completed. It is now ${nextPlayer?.displayName}'s turn.`;
      break;
    }

    default:
      throw new GameEngineError('INVALID_ACTION', `Unsupported action ${command.type}`);
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
  diceTotal: number
): void {
  const space = BOARD_SPACES[spaceIndex];
  if (!space) return;

  switch (space.type) {
    case 'PROPERTY':
    case 'TRANSIT':
    case 'UTILITY': {
      const propState = state.properties[spaceIndex];
      if (!propState.ownerUid) {
        // Unowned: player can buy or decline/auction
        state.phase = 'PROPERTY_DECISION';
        state.pendingAction = {
          type: 'BUY_OR_AUCTION',
          playerUid: player.uid,
          spaceIndex,
        };
      } else if (propState.ownerUid !== player.uid && !propState.isMortgaged) {
        // Rent owed to owner
        const rentDue = calculateRent(spaceIndex, state.properties, diceTotal);
        const owner = state.players.find((p) => p.uid === propState.ownerUid);

        if (player.cash >= rentDue) {
          player.cash -= rentDue;
          if (owner) owner.cash += rentDue;
          state.phase = 'MANAGEMENT';
        } else {
          // Insufficient funds: liquidation needed
          state.phase = 'ACTION_REQUIRED';
          state.pendingAction = {
            type: 'RAISE_FUNDS_DEBT',
            playerUid: player.uid,
            amountDue: rentDue,
            creditorUid: owner?.uid ?? null,
            spaceIndex,
          };
        }
      } else {
        // Owned by current player or mortgaged
        state.phase = 'MANAGEMENT';
      }
      break;
    }

    case 'TAX': {
      const taxAmount = space.amount;
      if (player.cash >= taxAmount) {
        player.cash -= taxAmount;
        state.phase = 'MANAGEMENT';
      } else {
        state.phase = 'ACTION_REQUIRED';
        state.pendingAction = {
          type: 'RAISE_FUNDS_DEBT',
          playerUid: player.uid,
          amountDue: taxAmount,
          creditorUid: null, // Bank
        };
      }
      break;
    }

    case 'CARD': {
      // Draw deterministic card based on turnNumber
      const deck = space.deck === 'CIVIC' ? CIVIC_FUND_CARDS : MARKET_BUZZ_CARDS;
      const card = deck[state.turnNumber % deck.length];
      applyCardEffect(state, player, card);
      state.phase = 'MANAGEMENT';
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
 * Applies drawn card consequences.
 */
function applyCardEffect(state: GameState, player: PlayerState, card: CardAction): void {
  switch (card.actionType) {
    case 'CASH_BANK':
      player.cash += card.amount ?? 0;
      break;
    case 'PAY_BANK':
      player.cash = Math.max(0, player.cash - (card.amount ?? 0));
      break;
    case 'CASH_PLAYERS': {
      const perPlayer = card.amount ?? 0;
      for (const other of state.players) {
        if (other.uid !== player.uid && !other.isBankrupt) {
          const paid = Math.min(other.cash, perPlayer);
          other.cash -= paid;
          player.cash += paid;
        }
      }
      break;
    }
    case 'PAY_PLAYERS': {
      const perPlayer = card.amount ?? 0;
      for (const other of state.players) {
        if (other.uid !== player.uid && !other.isBankrupt) {
          player.cash = Math.max(0, player.cash - perPlayer);
          other.cash += perPlayer;
        }
      }
      break;
    }
    case 'MOVE_TO':
      if (card.targetSpace !== undefined) {
        if (card.targetSpace < player.position) {
          player.cash += GAME_CONSTANTS.START_REWARD;
        }
        player.position = card.targetSpace;
      }
      break;
    case 'MOVE_RELATIVE':
      player.position = (player.position + (card.amount ?? 0) + 40) % 40;
      break;
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
    if (player && !player.isBankrupt) {
      state.currentPlayerUid = nextUid;
      state.turnNumber += 1;
      state.phase = player.inJail ? 'JAIL_DECISION' : 'AWAIT_ROLL';
      state.dice = null;
      state.pendingAction = null;
      return;
    }
  }
}
