/**
 * Indian Monopoly - Firebase Cloud Functions
 * Server-authoritative domain boundary with frictionless room access.
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { z } from 'zod';
import * as crypto from 'crypto';

admin.initializeApp();
const db = admin.firestore();

// -------------------------------------------------------------
// Validation Schemas
// -------------------------------------------------------------

const CreateRoomSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().min(1).max(30),
  customRules: z.object({
    startingCash: z.number().int().positive().default(15000),
    passStartReward: z.number().int().positive().default(2000),
    turnTimerSeconds: z.number().int().positive().default(30),
    maxPlayers: z.number().int().min(2).max(6).default(4),
    jailBail: z.number().int().positive().default(500),
    doubleRentMonopoly: z.boolean().default(true),
    allowAuctions: z.boolean().default(true),
    gameMode: z.string().default('STANDARD'),
  }).optional(),
});

const JoinRoomSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().min(1).max(30),
  inviteCode: z.string().min(4).max(10),
});

const SetReadySchema = z.object({
  roomId: z.string().min(1),
  uid: z.string().min(1),
  isReady: z.boolean(),
});

const StartGameSchema = z.object({
  roomId: z.string().min(1),
  uid: z.string().min(1),
});

const SubmitActionSchema = z.object({
  commandId: z.string().min(1),
  roomId: z.string().min(1),
  gameId: z.string().min(1),
  actorUid: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
  type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

const SendReactionSchema = z.object({
  roomId: z.string().min(1),
  senderUid: z.string().min(1),
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
  const parsed = CreateRoomSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const { uid, displayName, customRules } = parsed.data;
  const roomId = 'room_' + crypto.randomUUID();
  const inviteCode = generateCode();
  const inviteCodeHash = crypto.createHash('sha256').update(inviteCode).digest('hex');

  const now = admin.firestore.FieldValue.serverTimestamp();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const roomRef = db.collection('rooms').doc(roomId);

  await roomRef.set({
    roomId,
    inviteCode,
    inviteCodeHash,
    hostUid: uid,
    status: 'LOBBY',
    maxPlayers: customRules?.maxPlayers ?? 4,
    turnTimerSeconds: customRules?.turnTimerSeconds ?? 30,
    gameMode: customRules?.gameMode ?? 'STANDARD',
    customRules: customRules ?? null,
    memberUids: [uid],
    createdAt: now,
    updatedAt: now,
    expiresAt,
  });

  await roomRef.collection('members').doc(uid).set({
    uid,
    displayName,
    photoURL: null,
    isReady: true,
    joinedAt: now,
    colorToken: '#C85A32',
  });

  return { ok: true, roomId, inviteCode };
});

// -------------------------------------------------------------
// 2. Join Room Callable
// -------------------------------------------------------------
export const joinRoom = onCall({ region: 'asia-south1' }, async (request) => {
  const parsed = JoinRoomSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const { uid, displayName, inviteCode } = parsed.data;
  const cleanCode = inviteCode.trim().toUpperCase();
  const codeHash = crypto.createHash('sha256').update(cleanCode).digest('hex');

  const querySnap = await db
    .collection('rooms')
    .where('inviteCodeHash', '==', codeHash)
    .where('status', '==', 'LOBBY')
    .limit(1)
    .get();

  if (querySnap.empty) {
    throw new HttpsError('not-found', 'Room not found or game already in progress.');
  }

  const roomDoc = querySnap.docs[0];
  const room = roomDoc.data();

  if (room.memberUids.length >= room.maxPlayers && !room.memberUids.includes(uid)) {
    throw new HttpsError('resource-exhausted', 'Room is currently full.');
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const roomRef = roomDoc.ref;

  await db.runTransaction(async (transaction) => {
    transaction.update(roomRef, {
      memberUids: admin.firestore.FieldValue.arrayUnion(uid),
      updatedAt: now,
    });

    const memberRef = roomRef.collection('members').doc(uid);
    transaction.set(
      memberRef,
      {
        uid,
        displayName,
        photoURL: null,
        isReady: false,
        joinedAt: now,
        colorToken: '#1A2B4C',
      },
      { merge: true }
    );
  });

  return { ok: true, roomId: room.roomId };
});

// -------------------------------------------------------------
// 3. Set Ready Callable
// -------------------------------------------------------------
export const setReady = onCall({ region: 'asia-south1' }, async (request) => {
  const parsed = SetReadySchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const { roomId, uid, isReady } = parsed.data;
  const memberRef = db.collection('rooms').doc(roomId).collection('members').doc(uid);
  const snap = await memberRef.get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'Not a member of this room.');
  }

  await memberRef.update({
    isReady,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, isReady };
});

// -------------------------------------------------------------
// 4. Start Game Callable
// -------------------------------------------------------------
export const startGame = onCall({ region: 'asia-south1' }, async (request) => {
  const parsed = StartGameSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const { roomId, uid } = parsed.data;
  const roomRef = db.collection('rooms').doc(roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) {
    throw new HttpsError('not-found', 'Room does not exist.');
  }

  const room = roomSnap.data()!;
  if (room.hostUid !== uid) {
    throw new HttpsError('permission-denied', 'Only the room host can start the game.');
  }

  const membersSnap = await roomRef.collection('members').get();
  if (membersSnap.size < 2) {
    throw new HttpsError('failed-precondition', 'Requires at least 2 players to start.');
  }

  const allReady = membersSnap.docs.every((d) => d.data().isReady === true);
  if (!allReady) {
    throw new HttpsError('failed-precondition', 'All players must be ready.');
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
  const parsed = SubmitActionSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const { commandId, gameId, actorUid, expectedVersion, type, payload } = parsed.data;
  const gameRef = db.collection('games').doc(gameId);

  return await db.runTransaction(async (transaction) => {
    const gameSnap = await transaction.get(gameRef);
    if (!gameSnap.exists) {
      throw new HttpsError('not-found', 'Game does not exist.');
    }

    const game = gameSnap.data()!;
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

    let d1 = 1;
    let d2 = 1;
    let isDouble = false;
    if (type === 'ROLL_DICE') {
      d1 = crypto.randomInt(1, 7);
      d2 = crypto.randomInt(1, 7);
      isDouble = d1 === d2;
    }

    transaction.update(gameRef, {
      version: nextVersion,
      dice: type === 'ROLL_DICE' ? { first: d1, second: d2, isDouble } : game.dice || null,
      turnTimeRemaining: game.turnTimeLimit ?? 30,
      updatedAt: now,
    });

    const eventRef = gameRef.collection('events').doc('evt_' + nextVersion);
    transaction.set(eventRef, {
      sequence: nextVersion,
      commandId,
      actorUid,
      type,
      payload,
      createdAt: now,
      versionAfter: nextVersion,
    });

    transaction.set(receiptRef, {
      commandId,
      gameId,
      actorUid,
      createdAt: now,
    });

    return { ok: true, version: nextVersion };
  });
});

// -------------------------------------------------------------
// 6. Send Reaction Callable
// -------------------------------------------------------------
export const sendReaction = onCall({ region: 'asia-south1' }, async (request) => {
  const parsed = SendReactionSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const { roomId, senderUid, senderName, emote, nonce } = parsed.data;
  const reactionRef = db.collection('rooms').doc(roomId).collection('reactions').doc(nonce);

  await reactionRef.set({
    senderUid,
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
