/**
 * Indian Monopoly - Pure Functional Authoritative Game Engine
 * Evaluates state transitions deterministically with zero side effects.
 */

import { BOARD_SPACES, CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS, TRANSIT_SPACES } from '../board-config';
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

      // Passing or landing on START awards host-configured reward (default ₹2,000)
      const passReward = state.rules?.passStartReward ?? GAME_CONSTANTS.START_REWARD;
      if (newPos < oldPos && oldPos + steps >= 40) {
        player.cash += passReward;
        summary += ` — Passed START, collected ₹${passReward}!`;
        state.activeMoneyTransaction = {
          id: `start_${Date.now()}`,
          type: 'START_REWARD',
          payerName: 'Bank',
          payerUid: 'BANK',
          recipientName: player.displayName,
          recipientUid: player.uid,
          amount: passReward,
          description: `${player.displayName} collected ₹${passReward.toLocaleString('en-IN')} reward for passing START!`,
        };
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
      propState.boughtOnTurn = state.turnNumber;
      state.pendingAction = null;
      state.phase = 'MANAGEMENT';

      state.activeMoneyTransaction = {
        id: `buy_${Date.now()}`,
        type: 'BUY_PROPERTY',
        payerName: player.displayName,
        payerUid: player.uid,
        recipientName: 'Bank',
        recipientUid: 'BANK',
        amount: price,
        description: `${player.displayName} purchased ${space.name} for ₹${price.toLocaleString('en-IN')}.`,
      };

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
      const bailAmount = state.rules?.jailBail ?? GAME_CONSTANTS.JAIL_BAIL;
      if (!player || !player.inJail) {
        throw new GameEngineError('INVALID_ACTION', 'Player is not in jail');
      }
      if (player.cash < bailAmount) {
        throw new GameEngineError('INSUFFICIENT_FUNDS', `Need ₹${bailAmount} for bail`);
      }

      player.cash -= bailAmount;
      player.inJail = false;
      player.jailTurns = 0;
      state.phase = 'AWAIT_ROLL';
      state.activeMoneyTransaction = {
        id: `bail_${Date.now()}`,
        type: 'BAIL',
        payerName: player.displayName,
        payerUid: player.uid,
        recipientName: 'Court / Bank',
        recipientUid: 'BANK',
        amount: bailAmount,
        description: `${player.displayName} paid ₹${bailAmount.toLocaleString('en-IN')} bail and was released from Central Jail.`,
      };
      summary = `${player.displayName} paid ₹${bailAmount} bail and is free`;
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

      const check = canBuildOnProperty(
        spaceIdx,
        actorUid,
        state.properties,
        player.cash,
        player.position,
        state.turnNumber
      );
      if (!check.allowed) {
        throw new GameEngineError('INVALID_ACTION', check.reason || 'Cannot build here');
      }

      const space = BOARD_SPACES[spaceIdx] as PropertyDefinition;
      player.cash -= space.buildingCost;
      state.properties[spaceIdx].buildings += 1;

      const level = state.properties[spaceIdx].buildings;
      const buildingName = level === 5 ? 'Commercial Tower' : `House #${level}`;
      state.activeMoneyTransaction = {
        id: `build_${Date.now()}`,
        type: 'BUILD',
        payerName: player.displayName,
        payerUid: player.uid,
        recipientName: 'Bank',
        recipientUid: 'BANK',
        amount: space.buildingCost,
        description: `${player.displayName} constructed ${buildingName} on ${space.name} for ₹${space.buildingCost.toLocaleString('en-IN')}.`,
      };
      summary = `${player.displayName} built a ${buildingName} on ${space.name}`;
      eventPayload = { spaceIndex: spaceIdx, level };
      break;
    }

    case 'MORTGAGE': {
      const spaceIdx = Number(command.payload.spaceIndex);
      const player = state.players.find((p) => p.uid === actorUid);
      const propState = state.properties[spaceIdx];
      const space = BOARD_SPACES[spaceIdx] as PropertyDefinition;

      if (actorUid !== state.currentPlayerUid) {
        throw new GameEngineError('NOT_YOUR_TURN', 'You can only mortgage properties during your turn');
      }
      if (!propState || propState.ownerUid !== actorUid) {
        throw new GameEngineError('INVALID_ACTION', 'You do not own this property');
      }
      if (propState.isMortgaged) {
        throw new GameEngineError('INVALID_ACTION', 'Already mortgaged');
      }
      if (propState.buildings > 0) {
        throw new GameEngineError('INVALID_ACTION', 'Must sell buildings on this property before mortgaging');
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

    case 'DISMISS_CARD_POPUP': {
      state.activeCardPopup = null;
      summary = 'Acknowledged card rule.';
      break;
    }

    case 'DISMISS_MONEY_ACK': {
      state.activeMoneyTransaction = null;
      summary = 'Acknowledged money transaction.';
      break;
    }

    default:
      throw new GameEngineError('INVALID_ACTION', `Unsupported action ${command.type}`);
  }

  // Check for any player whose cash <= 0 and has no places to mortgage (Complete Bankruptcy Invariant)
  for (const p of state.players) {
    if (!p.isBankrupt && p.cash <= 0) {
      const hasMortgageable = Object.values(state.properties).some(
        (prop) => prop && prop.ownerUid === p.uid && !prop.isMortgaged
      );
      if (!hasMortgageable) {
        p.isBankrupt = true;
        p.cash = 0;
        // Liquidate deeds back to Reserve Bank
        for (const [k, prop] of Object.entries(state.properties)) {
          if (prop && prop.ownerUid === p.uid) {
            delete state.properties[Number(k)];
          }
        }
        if (state.pendingAction?.playerUid === p.uid) {
          state.pendingAction = null;
          state.phase = 'MANAGEMENT';
        }
        summary = `⚠️ ${p.displayName} is completely bankrupt with ₹0 cash and no properties to mortgage!`;
        if (state.currentPlayerUid === p.uid) {
          advanceTurn(state);
        }
      }
    }
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
  diceTotal: number,
  options?: { rentMultiplier?: number }
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
        const owner = state.players.find((p) => p.uid === propState.ownerUid);
        const isOwnerInJail = Boolean(owner?.inJail);

        // User Rule: If the player is in jail, he/she should not earn any money from other players
        let rentDue = calculateRent(spaceIndex, state.properties, diceTotal, undefined, isOwnerInJail);
        if (options?.rentMultiplier) {
          rentDue *= options.rentMultiplier;
        }

        if (rentDue > 0) {
          if (player.cash >= rentDue) {
            player.cash -= rentDue;
            if (owner) owner.cash += rentDue;
            state.phase = 'MANAGEMENT';
            state.activeMoneyTransaction = {
              id: `rent_${Date.now()}`,
              type: 'RENT',
              payerName: player.displayName,
              payerUid: player.uid,
              recipientName: owner?.displayName,
              recipientUid: owner?.uid,
              amount: rentDue,
              description: `${player.displayName} paid ₹${rentDue.toLocaleString('en-IN')} rent to ${owner?.displayName} for landing on ${space.name}.`,
            };
          } else {
            // Check if player has any unmortgaged properties to raise cash
            const hasMortgageable = Object.values(state.properties).some(
              (p) => p && p.ownerUid === player.uid && !p.isMortgaged
            );

            // Transfer all remaining cash to owner
            const paid = player.cash;
            player.cash = 0;
            if (owner) owner.cash += paid;

            if (!hasMortgageable) {
              // Completely bankrupt: zero cash and no places to mortgage
              player.isBankrupt = true;
              for (const [k, p] of Object.entries(state.properties)) {
                if (p && p.ownerUid === player.uid) {
                  delete state.properties[Number(k)];
                }
              }
              state.phase = 'MANAGEMENT';
              state.pendingAction = null;
              advanceTurn(state);
            } else {
              // Liquidation needed via mortgage
              state.phase = 'ACTION_REQUIRED';
              state.pendingAction = {
                type: 'RAISE_FUNDS_DEBT',
                playerUid: player.uid,
                amountDue: rentDue - paid,
                creditorUid: owner?.uid ?? null,
                spaceIndex,
              };
            }
          }
        } else {
          // Zero rent (e.g. owner in jail or rent is 0)
          state.phase = 'MANAGEMENT';
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
        state.activeMoneyTransaction = {
          id: `tax_${Date.now()}`,
          type: 'TAX',
          payerName: player.displayName,
          payerUid: player.uid,
          recipientName: 'Bank',
          recipientUid: 'BANK',
          amount: taxAmount,
          description: `${player.displayName} paid ₹${taxAmount.toLocaleString('en-IN')} tax for landing on ${space.name}.`,
        };
      } else {
        const hasMortgageable = Object.values(state.properties).some(
          (p) => p && p.ownerUid === player.uid && !p.isMortgaged
        );

        player.cash = 0;

        if (!hasMortgageable) {
          player.isBankrupt = true;
          for (const [k, p] of Object.entries(state.properties)) {
            if (p && p.ownerUid === player.uid) {
              delete state.properties[Number(k)];
            }
          }
          state.phase = 'MANAGEMENT';
          state.pendingAction = null;
          advanceTurn(state);
        } else {
          state.phase = 'ACTION_REQUIRED';
          state.pendingAction = {
            type: 'RAISE_FUNDS_DEBT',
            playerUid: player.uid,
            amountDue: taxAmount,
            creditorUid: null, // Bank
          };
        }
      }
      break;
    }

    case 'CARD': {
      // If a player reaches Civic Fund or Market Buzz with a total number from the dice,
      // that index rule (1..12) gets applied.
      const deck = space.deck === 'CIVIC' ? CIVIC_FUND_CARDS : MARKET_BUZZ_CARDS;
      const ruleIndex =
        diceTotal >= 1 && diceTotal <= deck.length
          ? diceTotal
          : ((state.turnNumber % deck.length) + 1);
      const card = deck[ruleIndex - 1];
      applyCardEffect(state, player, card);
      state.activeCardPopup = {
        deck: space.deck,
        card,
        ruleIndex,
        playerUid: player.uid,
      };
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
      // User Rule: If the player is in jail, he/she should not earn any money from other players
      if (player.inJail) break;
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
        // User Rule: If the player is in jail, he/she should not earn any money from other players
        if (other.uid !== player.uid && !other.isBankrupt && !other.inJail) {
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
        resolveLandingSpace(state, player, player.position, 0);
      }
      break;
    case 'MOVE_RELATIVE':
      player.position = (player.position + (card.amount ?? 0) + 40) % 40;
      resolveLandingSpace(state, player, player.position, 0);
      break;
    case 'ADVANCE_NEXT_TRANSIT': {
      const nextTransit = TRANSIT_SPACES.find((idx) => idx > player.position) ?? TRANSIT_SPACES[0];
      if (nextTransit < player.position) {
        player.cash += GAME_CONSTANTS.START_REWARD;
      }
      player.position = nextTransit;
      resolveLandingSpace(state, player, nextTransit, 0, { rentMultiplier: 2 });
      break;
    }
    case 'TRANSIT_DIVIDEND': {
      const ownedTransits = TRANSIT_SPACES.filter(
        (idx) => state.properties[idx]?.ownerUid === player.uid
      ).length;
      player.cash += ownedTransits * (card.amount ?? 400);
      break;
    }
    case 'REPAIR_TAX': {
      let totalBlocks = 0;
      let totalTowers = 0;
      for (const prop of Object.values(state.properties)) {
        if (prop.ownerUid === player.uid) {
          if (prop.buildings === 5) {
            totalTowers += 1;
          } else if (prop.buildings > 0) {
            totalBlocks += prop.buildings;
          }
        }
      }
      const cost = totalBlocks * (card.perHouse ?? 250) + totalTowers * (card.perTower ?? 750);
      player.cash = Math.max(0, player.cash - cost);
      break;
    }
    case 'DEVELOPMENT_GRANT': {
      let totalBlocks = 0;
      let totalTowers = 0;
      for (const prop of Object.values(state.properties)) {
        if (prop.ownerUid === player.uid) {
          if (prop.buildings === 5) {
            totalTowers += 1;
          } else if (prop.buildings > 0) {
            totalBlocks += prop.buildings;
          }
        }
      }
      const grant = totalBlocks * (card.perHouse ?? 100) + totalTowers * (card.perTower ?? 300);
      player.cash += grant;
      break;
    }
    case 'DEED_TAX': {
      const totalDeeds = Object.values(state.properties).filter(
        (p) => p.ownerUid === player.uid
      ).length;
      const cost = totalDeeds * (card.amount ?? 250);
      player.cash = Math.max(0, player.cash - cost);
      break;
    }
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
      state.turnTimeRemaining = state.turnTimeLimit || 30;
      return;
    }
  }
}
