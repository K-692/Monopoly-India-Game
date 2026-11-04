/**
 * Indian Monopoly - Domain Type Definitions
 * Server-authoritative contract shared across Client and Cloud Functions.
 */

export type PropertyColorGroup =
  | 'BROWN'
  | 'LIGHTBLUE'
  | 'PINK'
  | 'ORANGE'
  | 'RED'
  | 'YELLOW'
  | 'GREEN'
  | 'DARKBLUE';

export type SpaceType =
  | 'START'
  | 'PROPERTY'
  | 'CARD'
  | 'TAX'
  | 'TRANSIT'
  | 'UTILITY'
  | 'JAIL'
  | 'REST_HOUSE'
  | 'GO_TO_JAIL';

export type CardDeckType = 'CIVIC' | 'MARKET';

export interface PropertyDefinition {
  id: string;
  spaceIndex: number;
  name: string;
  hindiName?: string;
  group: PropertyColorGroup;
  price: number;
  mortgageValue: number;
  unmortgageCost: number;
  baseRent: number;
  rentHouse1: number;
  rentHouse2: number;
  rentHouse3: number;
  rentHouse4: number;
  rentTower: number;
  buildingCost: number;
}

export interface TransitDefinition {
  id: string;
  spaceIndex: number;
  name: string;
  price: number;
  mortgageValue: number;
  unmortgageCost: number;
  baseRent: number; // 250, 500, 1000, 2000
}

export interface UtilityDefinition {
  id: string;
  spaceIndex: number;
  name: string;
  price: number;
  mortgageValue: number;
  unmortgageCost: number;
}

export interface TaxDefinition {
  id: string;
  spaceIndex: number;
  name: string;
  amount: number;
}

export interface CardSpaceDefinition {
  id: string;
  spaceIndex: number;
  deck: CardDeckType;
  name: string;
}

export interface SpecialSpaceDefinition {
  id: string;
  spaceIndex: number;
  type: 'START' | 'JAIL' | 'REST_HOUSE' | 'GO_TO_JAIL';
  name: string;
  reward?: number;
}

export type BoardSpaceDefinition =
  | ({ type: 'PROPERTY' } & PropertyDefinition)
  | ({ type: 'TRANSIT' } & TransitDefinition)
  | ({ type: 'UTILITY' } & UtilityDefinition)
  | ({ type: 'TAX' } & TaxDefinition)
  | ({ type: 'CARD' } & CardSpaceDefinition)
  | ({ type: 'START' | 'JAIL' | 'REST_HOUSE' | 'GO_TO_JAIL' } & SpecialSpaceDefinition);

export interface CardAction {
  id: string;
  deck: CardDeckType;
  title: string;
  description: string;
  actionType:
    | 'CASH_BANK'
    | 'PAY_BANK'
    | 'CASH_PLAYERS'
    | 'PAY_PLAYERS'
    | 'MOVE_TO'
    | 'MOVE_RELATIVE'
    | 'GO_TO_JAIL'
    | 'JAIL_FREE'
    | 'REPAIR_TAX';
  amount?: number;
  targetSpace?: number;
  perHouse?: number;
  perTower?: number;
}

export interface PlayerState {
  uid: string;
  displayName: string;
  photoURL: string | null;
  cash: number;
  netWorth: number;
  position: number; // [0..39]
  inJail: boolean;
  jailTurns: number;
  jailFreeCards: number;
  isBankrupt: boolean;
  colorToken: string;
  turnTimeoutCount: number;
}

export interface PropertyState {
  spaceIndex: number;
  propertyId: string;
  ownerUid: string | null;
  isMortgaged: boolean;
  buildings: number; // 0..4 = houses, 5 = tower
}

export type TurnPhase =
  | 'AWAIT_ROLL'
  | 'JAIL_DECISION'
  | 'PROPERTY_DECISION'
  | 'AUCTION'
  | 'MANAGEMENT'
  | 'TRADE_RESPONSE'
  | 'ACTION_REQUIRED'
  | 'TURN_END';

export interface AuctionState {
  spaceIndex: number;
  propertyId: string;
  highestBid: number;
  highestBidderUid: string | null;
  activeBidderUids: string[];
  currentBidderIndex: number;
  endsAt: number;
}

export interface TradeOffer {
  id: string;
  initiatorUid: string;
  recipientUid: string;
  offeredCash: number;
  offeredProperties: number[]; // spaceIndices
  requestedCash: number;
  requestedProperties: number[]; // spaceIndices
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  createdAt: number;
}

export interface PendingAction {
  type:
    | 'BUY_OR_AUCTION'
    | 'PAY_RENT'
    | 'PAY_TAX'
    | 'CARD_EFFECT'
    | 'JAIL_CHOICE'
    | 'RAISE_FUNDS_DEBT';
  playerUid: string;
  spaceIndex?: number;
  amountDue?: number;
  creditorUid?: string | null; // null = Bank
  card?: CardAction;
  expiresAt?: number;
}

export interface DiceState {
  first: number;
  second: number;
  isDouble: boolean;
  consecutiveDoubles: number;
  rolledAt: number;
}

export interface GameState {
  roomId: string;
  gameId: string;
  rulesetVersion: string;
  version: number;
  status: 'IN_PROGRESS' | 'ACTION_REQUIRED' | 'COMPLETED';
  playerOrder: string[];
  currentPlayerUid: string;
  turnNumber: number;
  phase: TurnPhase;
  players: PlayerState[];
  properties: Record<number, PropertyState>;
  pendingAction: PendingAction | null;
  dice: DiceState | null;
  auction: AuctionState | null;
  activeTrade: TradeOffer | null;
  winnerUid: string | null;
  turnTimeRemaining: number;
  turnTimeLimit: number;
  rules?: {
    startingCash: number;
    passStartReward: number;
    turnTimerSeconds: number;
    maxPlayers: number;
    jailBail: number;
    doubleRentMonopoly: boolean;
    allowAuctions: boolean;
    gameMode: string;
  };
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export type GameActionType =
  | 'ROLL_DICE'
  | 'BUY_PROPERTY'
  | 'DECLINE_PROPERTY'
  | 'PLACE_BID'
  | 'PASS_BID'
  | 'PAY_BAIL'
  | 'TRY_DOUBLES'
  | 'USE_JAIL_CARD'
  | 'BUILD'
  | 'SELL_BUILDING'
  | 'MORTGAGE'
  | 'UNMORTGAGE'
  | 'PROPOSE_TRADE'
  | 'ACCEPT_TRADE'
  | 'REJECT_TRADE'
  | 'END_TURN';

export interface GameCommand {
  commandId: string;
  roomId: string;
  gameId: string;
  expectedVersion: number;
  type: GameActionType;
  payload: Record<string, unknown>;
}

export interface GameEvent {
  sequence: number;
  commandId: string;
  actorUid: string;
  type: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: number;
  versionAfter: number;
}

export interface GameArchive {
  archiveId: string;
  gameId: string;
  roomId: string;
  rulesetVersion: string;
  playerSnapshots: {
    uid: string;
    displayName: string;
    photoURL: string | null;
    finalCash: number;
    netWorth: number;
    rank: number;
    propertiesCount: number;
  }[];
  winnerUid: string;
  winnerName: string;
  startedAt: number;
  completedAt: number;
  durationSeconds: number;
  totalTurns: number;
  participantUids: string[];
  retentionUntil: number;
}

export interface RoomMember {
  uid: string;
  displayName: string;
  photoURL: string | null;
  isReady: boolean;
  joinedAt: number;
  colorToken: string;
}

export interface RoomState {
  roomId: string;
  inviteCode: string;
  inviteCodeHash: string;
  hostUid: string;
  status: 'LOBBY' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
  maxPlayers: number;
  turnTimerSeconds: 0 | 30 | 45 | 60;
  gameMode: 'STANDARD' | 'TIMED';
  customRules?: {
    startingCash: number;
    passStartReward: number;
    turnTimerSeconds: number;
    maxPlayers: number;
    jailBail: number;
    doubleRentMonopoly: boolean;
    allowAuctions: boolean;
    gameMode: string;
  };
  members: Record<string, RoomMember>;
  memberUids: string[];
  gameId?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface EmoteReaction {
  id: string;
  roomId: string;
  senderUid: string;
  senderName: string;
  emote: string; // e.g. "👏", "😂", "🔥", "❤️"
  timestamp: number;
}
