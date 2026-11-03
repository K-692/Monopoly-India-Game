/**
 * Indian Monopoly - Zod Validation Schemas for Callable Actions
 */

import { z } from 'zod';

export const GameActionTypeSchema = z.enum([
  'ROLL_DICE',
  'BUY_PROPERTY',
  'DECLINE_PROPERTY',
  'PLACE_BID',
  'PASS_BID',
  'PAY_BAIL',
  'TRY_DOUBLES',
  'USE_JAIL_CARD',
  'BUILD',
  'SELL_BUILDING',
  'MORTGAGE',
  'UNMORTGAGE',
  'PROPOSE_TRADE',
  'ACCEPT_TRADE',
  'REJECT_TRADE',
  'END_TURN',
]);

export const GameCommandSchema = z.object({
  commandId: z.string().min(1),
  roomId: z.string().min(1),
  gameId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
  type: GameActionTypeSchema,
  payload: z.record(z.unknown()).default({}),
});

// Specific action payload schemas
export const BuyPropertyPayloadSchema = z.object({
  spaceIndex: z.number().int().min(0).max(39),
});

export const PlaceBidPayloadSchema = z.object({
  bidAmount: z.number().int().positive(),
});

export const BuildPayloadSchema = z.object({
  spaceIndex: z.number().int().min(0).max(39),
});

export const MortgagePayloadSchema = z.object({
  spaceIndex: z.number().int().min(0).max(39),
});

export const ProposeTradePayloadSchema = z.object({
  targetPlayerUid: z.string().min(1),
  offeredCash: z.number().int().nonnegative().default(0),
  offeredProperties: z.array(z.number().int().min(0).max(39)).default([]),
  requestedCash: z.number().int().nonnegative().default(0),
  requestedProperties: z.array(z.number().int().min(0).max(39)).default([]),
});

export const CreateRoomPayloadSchema = z.object({
  maxPlayers: z.number().int().min(2).max(6).default(4),
  turnTimerSeconds: z.union([z.literal(0), z.literal(30), z.literal(45), z.literal(60)]).default(45),
  gameMode: z.enum(['STANDARD', 'TIMED']).default('STANDARD'),
});

export const JoinRoomPayloadSchema = z.object({
  inviteCode: z.string().min(4).max(10),
});

export const SendReactionPayloadSchema = z.object({
  roomId: z.string().min(1),
  emote: z.enum(['👏', '😂', '😮', '😭', '🔥', '❤️', '🤝', '🎉']),
  nonce: z.string().min(1),
});
