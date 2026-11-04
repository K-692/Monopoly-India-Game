/**
 * Indian Monopoly - Zod Validation Schemas
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
  'DISMISS_CARD_POPUP',
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

export const CreateRoomPayloadSchema = z.object({
  maxPlayers: z.number().int().min(2).max(6).default(4),
  turnTimerSeconds: z.number().int().positive().default(30),
  gameMode: z.enum(['STANDARD', 'TIMED_45', 'TIMED_60']).default('STANDARD'),
  customRules: z.record(z.unknown()).optional(),
});

export const JoinRoomPayloadSchema = z.object({
  inviteCode: z.string().min(4).max(10),
  displayName: z.string().min(1).max(30),
});

export const SendReactionPayloadSchema = z.object({
  roomId: z.string().min(1),
  emote: z.enum(['👏', '😂', '😮', '😭', '🔥', '❤️', '🤝', '🎉']),
  nonce: z.string().min(1),
});
