/**
 * Indian Monopoly - Firebase Cloud Functions
 * Server-authoritative domain boundary with frictionless room access.
 * All mutations verified against request.auth.uid.
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { z } from 'zod';
import * as crypto from 'crypto';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// -------------------------------------------------------------
// Validation Schemas
// -------------------------------------------------------------

const CreateRoomSchema = z.object({
  displayName: z.string().min(1).max(30),
  colorToken: z.string().optional(),
  customRules: z
    .object({
      startingCash: z.number().int().positive().default(15000),
      passStartReward: z.number().int().positive().default(2000),
      turnTimerSeconds: z.number().int().positive().default(30),
      maxPlayers: z.number().int().min(2).max(6).default(4),
      jailBail: z.number().int().positive().default(500),
      doubleRentMonopoly: z.boolean().default(true),
      allowAuctions: z.boolean().default(true),
      gameMode: z.string().default('STANDARD'),
    })
    .optional(),
});

const JoinRoomSchema = z.object({
  displayName: z.string().min(1).max(30),
  inviteCode: z.string().min(4).max(10),
  colorToken: z.string().optional(),
});

const SetReadySchema = z.object({
  roomId: z.string().min(1),
  isReady: z.boolean(),
});

const StartGameSchema = z.object({
  roomId: z.string().min(1),
});

const SubmitActionSchema = z.object({
  commandId: z.string().min(1),
  roomId: z.string().min(1),
  gameId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
  type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

const SendReactionSchema = z.object({
  roomId: z.string().min(1),
  senderName: z.string().min(1),
  emote: z.string().min(1).max(8),
  nonce: z.string().min(1),
});

function generateCode(): string {
  const chars = '2345679ACDEFGHJKMNPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return out;
}

// -------------------------------------------------------------
// 1. Create Room Callable
// -------------------------------------------------------------
export const createRoom = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to create a room.');
  }

  const parsed = CreateRoomSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const callerUid = request.auth.uid;
  const { displayName, colorToken, customRules } = parsed.data;
  const roomId = 'room_' + crypto.randomUUID();
  const inviteCode = generateCode();
  const inviteCodeHash = crypto.createHash('sha256').update(inviteCode.toUpperCase()).digest('hex');

  const now = admin.firestore.FieldValue.serverTimestamp();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);

  const batch = db.batch();
  const roomRef = db.collection('rooms').doc(roomId);
  const hostMemberRef = roomRef.collection('members').doc(callerUid);

  batch.set(roomRef, {
    roomId,
    inviteCode,
    inviteCodeHash,
    hostUid: callerUid,
    status: 'LOBBY',
    maxPlayers: customRules?.maxPlayers ?? 4,
    turnTimerSeconds: customRules?.turnTimerSeconds ?? 30,
    gameMode: customRules?.gameMode ?? 'STANDARD',
    customRules: customRules ?? {
      startingCash: 15000,
      passStartReward: 2000,
      turnTimerSeconds: 30,
      maxPlayers: 4,
      jailBail: 500,
      doubleRentMonopoly: true,
      allowAuctions: true,
      gameMode: 'STANDARD',
    },
    memberUids: [callerUid],
    createdAt: now,
    updatedAt: now,
    expiresAt,
  });

  batch.set(hostMemberRef, {
    uid: callerUid,
    displayName,
    photoURL: null,
    isReady: true,
    joinedAt: now,
    colorToken: colorToken || '#C85A32',
  });

  await batch.commit();

  return { ok: true, roomId, inviteCode };
});

// -------------------------------------------------------------
// 2. Join Room Callable (Atomic & Concurrency-Safe)
// -------------------------------------------------------------
export const joinRoom = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to join a room.');
  }

  const parsed = JoinRoomSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const callerUid = request.auth.uid;
  const { displayName, inviteCode, colorToken } = parsed.data;
  const cleanCode = inviteCode.trim().toUpperCase();
  const codeHash = crypto.createHash('sha256').update(cleanCode).digest('hex');

  const querySnap = await db
    .collection('rooms')
    .where('inviteCodeHash', '==', codeHash)
    .limit(1)
    .get();

  if (querySnap.empty) {
    throw new HttpsError('not-found', 'Invalid invitation code. No room found.');
  }

  const roomDoc = querySnap.docs[0];
  const roomRef = roomDoc.ref;

  await db.runTransaction(async (transaction) => {
    const currentSnap = await transaction.get(roomRef);
    if (!currentSnap.exists) {
      throw new HttpsError('not-found', 'Room no longer exists.');
    }

    const room = currentSnap.data()!;

    // Expiration check
    if (room.expiresAt) {
      const expiresMs =
        typeof room.expiresAt.toMillis === 'function'
          ? room.expiresAt.toMillis()
          : new Date(room.expiresAt).getTime();
      if (Date.now() > expiresMs) {
        throw new HttpsError('failed-precondition', 'This room invitation has expired.');
      }
    }

    // Status check
    if (room.status !== 'LOBBY') {
      throw new HttpsError('failed-precondition', 'Game has already started in this room.');
    }

    const memberUids: string[] = room.memberUids || [];
    const maxPlayers: number = room.maxPlayers || 4;

    // Capacity check
    if (!memberUids.includes(callerUid)) {
      if (memberUids.length >= maxPlayers) {
        throw new HttpsError('resource-exhausted', `Room is full (maximum ${maxPlayers} players).`);
      }
      transaction.update(roomRef, {
        memberUids: admin.firestore.FieldValue.arrayUnion(callerUid),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      transaction.update(roomRef, {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const memberRef = roomRef.collection('members').doc(callerUid);
    const memberSnap = await transaction.get(memberRef);

    if (!memberSnap.exists) {
      const defaultColors = ['#C85A32', '#1A2B4C', '#E5A93C', '#2D6A4F', '#9D0208', '#5C2D5A'];
      const assignedColor = colorToken || defaultColors[memberUids.length % defaultColors.length];

      transaction.set(memberRef, {
        uid: callerUid,
        displayName,
        photoURL: null,
        isReady: false,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        colorToken: assignedColor,
      });
    } else {
      transaction.update(memberRef, {
        displayName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  return { ok: true, roomId: roomDoc.id };
});

// -------------------------------------------------------------
// 3. Set Ready Callable
// -------------------------------------------------------------
export const setReady = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const parsed = SetReadySchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const callerUid = request.auth.uid;
  const { roomId, isReady } = parsed.data;

  const roomRef = db.collection('rooms').doc(roomId);
  const memberRef = roomRef.collection('members').doc(callerUid);

  const [roomSnap, memberSnap] = await Promise.all([roomRef.get(), memberRef.get()]);

  if (!roomSnap.exists) {
    throw new HttpsError('not-found', 'Room not found.');
  }
  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'You are not a member of this room.');
  }

  const room = roomSnap.data()!;
  if (room.status !== 'LOBBY') {
    throw new HttpsError('failed-precondition', 'Cannot toggle ready status after game has started.');
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  await memberRef.update({
    isReady,
    updatedAt: now,
  });

  await roomRef.update({
    updatedAt: now,
  });

  return { ok: true, isReady };
});

// -------------------------------------------------------------
// 4. Start Game Callable
// -------------------------------------------------------------
export const startGame = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to start the game.');
  }

  const parsed = StartGameSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const callerUid = request.auth.uid;
  const { roomId } = parsed.data;

  const roomRef = db.collection('rooms').doc(roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) {
    throw new HttpsError('not-found', 'Room does not exist.');
  }

  const room = roomSnap.data()!;
  if (room.hostUid !== callerUid) {
    throw new HttpsError('permission-denied', 'Only the room host can start the game.');
  }

  if (room.status !== 'LOBBY') {
    throw new HttpsError('failed-precondition', 'Game has already started.');
  }

  const membersSnap = await roomRef.collection('members').get();
  if (membersSnap.size < 2) {
    throw new HttpsError('failed-precondition', 'Requires at least 2 players to start a match.');
  }

  const allReady = membersSnap.docs.every((d) => d.data().isReady === true);
  if (!allReady) {
    throw new HttpsError('failed-precondition', 'All players must be ready before starting.');
  }

  const gameId = 'game_' + roomId.replace('room_', '');
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (transaction) => {
    transaction.update(roomRef, {
      status: 'IN_PROGRESS',
      gameId,
      updatedAt: now,
    });

    const gameRef = db.collection('games').doc(gameId);
    transaction.set(gameRef, {
      gameId,
      roomId,
      rulesetVersion: '1.0.0',
      version: 1,
      status: 'IN_PROGRESS',
      playerOrder: room.memberUids,
      currentPlayerUid: room.memberUids[0],
      turnNumber: 1,
      phase: 'AWAIT_ROLL',
      turnTimeLimit: room.customRules?.turnTimerSeconds ?? 30,
      turnTimeRemaining: room.customRules?.turnTimerSeconds ?? 30,
      customRules: room.customRules ?? null,
      startedAt: now,
      updatedAt: now,
      completedAt: null,
    });
  });

  return { ok: true, gameId };
});

// -------------------------------------------------------------
// 5. Submit Game Action Callable
// -------------------------------------------------------------
export const submitGameAction = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const parsed = SubmitActionSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const callerUid = request.auth.uid;
  const { commandId, gameId, expectedVersion, type, payload } = parsed.data;
  const gameRef = db.collection('games').doc(gameId);

  return await db.runTransaction(async (transaction) => {
    const gameSnap = await transaction.get(gameRef);
    if (!gameSnap.exists) {
      throw new HttpsError('not-found', 'Game does not exist.');
    }

    const game = gameSnap.data()!;
    if (!game.playerOrder.includes(callerUid)) {
      throw new HttpsError('permission-denied', 'You are not a participant in this game.');
    }

    // Enforce turn ownership for primary game actions
    if (['ROLL_DICE', 'BUY_PROPERTY', 'DECLINE_PROPERTY', 'END_TURN', 'PAY_BAIL', 'TRY_DOUBLES'].includes(type)) {
      if (game.currentPlayerUid !== callerUid) {
        throw new HttpsError('failed-precondition', 'It is not your turn.');
      }
    }

    if (game.version !== expectedVersion) {
      throw new HttpsError('aborted', `Version conflict. Expected ${expectedVersion}, found ${game.version}`);
    }

    const receiptRef = db.collection('commandReceipts').doc(commandId);
    const receiptSnap = await transaction.get(receiptRef);
    if (receiptSnap.exists) {
      return { ok: true, idempotent: true };
    }

    const nextVersion = game.version + 1;
    const now = admin.firestore.FieldValue.serverTimestamp();

    let dice = game.dice || null;
    if (type === 'ROLL_DICE') {
      const d1 = crypto.randomInt(1, 7);
      const d2 = crypto.randomInt(1, 7);
      dice = { first: d1, second: d2, isDouble: d1 === d2 };
    }

    transaction.update(gameRef, {
      version: nextVersion,
      dice,
      turnTimeRemaining: game.turnTimeLimit ?? 30,
      updatedAt: now,
    });

    const eventRef = gameRef.collection('events').doc('evt_' + nextVersion);
    transaction.set(eventRef, {
      sequence: nextVersion,
      commandId,
      actorUid: callerUid,
      type,
      payload,
      createdAt: now,
      versionAfter: nextVersion,
    });

    transaction.set(receiptRef, {
      commandId,
      gameId,
      actorUid: callerUid,
      createdAt: now,
    });

    return { ok: true, version: nextVersion, dice };
  });
});

// -------------------------------------------------------------
// 6. Send Reaction Callable
// -------------------------------------------------------------
export const sendReaction = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const parsed = SendReactionSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const callerUid = request.auth.uid;
  const { roomId, senderName, emote, nonce } = parsed.data;

  // Confirm membership in the room
  const memberSnap = await db.collection('rooms').doc(roomId).collection('members').doc(callerUid).get();
  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'Only room members can send reactions.');
  }

  const reactionRef = db.collection('rooms').doc(roomId).collection('reactions').doc(nonce);
  await reactionRef.set({
    senderUid: callerUid,
    senderName,
    emote,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

// -------------------------------------------------------------
// 7. Scheduled Cleanup Function
// -------------------------------------------------------------
export const cleanupExpiredLobbies = onSchedule('every 12 hours', async () => {
  const now = admin.firestore.Timestamp.now();
  const expiredRooms = await db
    .collection('rooms')
    .where('expiresAt', '<=', now)
    .limit(100)
    .get();

  const batch = db.batch();
  expiredRooms.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
});
