/**
 * Indian Monopoly - In-Memory Room & Session Manager
 * Provides authoritative management of player sessions, room lifecycles,
 * member readiness, and invitation codes without external databases.
 */

import crypto from 'crypto';
import { RoomMember } from '../../src/domain/game-types';
import { DEFAULT_HOST_RULES, HostCustomRules } from '../../src/domain/ruleset';
import { PlayerSession, PlayerSessionPublic, ServerRoom } from '../types/server-types';

export const PLAYER_PALETTE = [
  '#C85A32', // Terracotta
  '#1A2B4C', // Navy
  '#E5A93C', // Gold
  '#2D6A4F', // Emerald
  '#9D0208', // Crimson
  '#5C2D5A', // Purple
];

// Clean 30-character alphabet excluding ambiguous characters: 0, O, 1, I, L
const INVITE_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export class RoomManager {
  private rooms: Map<string, ServerRoom> = new Map();
  private codeToRoomId: Map<string, string> = new Map();
  private sessionsByToken: Map<string, PlayerSession> = new Map();
  private sessionsByUid: Map<string, PlayerSession> = new Map();
  private socketToUid: Map<string, string> = new Map();

  /**
   * Generates a cryptographically secure, unambiguous 6-character invitation code.
   */
  public generateUniqueInviteCode(): string {
    let attempts = 0;
    while (attempts < 500) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        const index = crypto.randomInt(0, INVITE_CODE_ALPHABET.length);
        code += INVITE_CODE_ALPHABET[index];
      }
      if (!this.codeToRoomId.has(code)) {
        return code;
      }
      attempts++;
    }
    // Fallback if alphabet space gets crowded
    return 'MP' + crypto.randomBytes(2).toString('hex').toUpperCase();
  }

  // ==========================================
  // PLAYER SESSION & IDENTITY MANAGEMENT
  // ==========================================

  /**
   * Registers a new player or claims an existing session using a cryptographically secure token.
   */
  public registerPlayer(
    displayName: string,
    avatarColor?: string,
    existingToken?: string,
    ipAddress?: string
  ): PlayerSessionPublic {
    const cleanName = (displayName || 'Player').trim().slice(0, 30);
    const chosenColor = avatarColor || PLAYER_PALETTE[0];

    // Check if valid token was provided
    if (existingToken && this.sessionsByToken.has(existingToken)) {
      const existing = this.sessionsByToken.get(existingToken)!;
      existing.displayName = cleanName;
      existing.avatarColor = chosenColor;
      existing.lastSeenAt = Date.now();
      if (ipAddress) existing.ipAddress = ipAddress;
      return {
        uid: existing.uid,
        token: existing.token,
        displayName: existing.displayName,
        avatarColor: existing.avatarColor,
      };
    }

    // Generate new unique UID and cryptographically secure token
    const uid = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const token = crypto.randomBytes(32).toString('hex');

    const session: PlayerSession = {
      uid,
      token,
      displayName: cleanName,
      avatarColor: chosenColor,
      socketId: null,
      roomId: null,
      connected: false,
      lastSeenAt: Date.now(),
      ipAddress,
    };

    this.sessionsByToken.set(token, session);
    this.sessionsByUid.set(uid, session);

    return {
      uid: session.uid,
      token: session.token,
      displayName: session.displayName,
      avatarColor: session.avatarColor,
    };
  }

  /**
   * Resumes an existing player session via reconnection token after page refresh.
   */
  public resumePlayer(token: string, displayName?: string, ipAddress?: string): PlayerSessionPublic | null {
    if (!token || !this.sessionsByToken.has(token)) {
      return null;
    }

    const session = this.sessionsByToken.get(token)!;
    if (displayName && displayName.trim()) {
      session.displayName = displayName.trim().slice(0, 30);
    }
    session.connected = true;
    session.lastSeenAt = Date.now();
    if (ipAddress) session.ipAddress = ipAddress;

    return {
      uid: session.uid,
      token: session.token,
      displayName: session.displayName,
      avatarColor: session.avatarColor,
    };
  }

  /**
   * Associates a live Socket.IO connection with an authenticated player session.
   */
  public bindSocket(socketId: string, uid: string, ipAddress?: string): PlayerSession | null {
    const session = this.sessionsByUid.get(uid);
    if (!session) return null;

    session.socketId = socketId;
    session.connected = true;
    session.lastSeenAt = Date.now();
    if (ipAddress) session.ipAddress = ipAddress;

    this.socketToUid.set(socketId, uid);
    return session;
  }

  /**
   * Disconnects a socket and records temporary absence for the grace period.
   */
  public unbindSocket(socketId: string): PlayerSession | null {
    const uid = this.socketToUid.get(socketId);
    if (!uid) return null;

    this.socketToUid.delete(socketId);
    const session = this.sessionsByUid.get(uid);
    if (session && session.socketId === socketId) {
      session.connected = false;
      session.socketId = null;
      session.lastSeenAt = Date.now();
      return session;
    }
    return null;
  }

  public getSessionByUid(uid: string): PlayerSession | null {
    return this.sessionsByUid.get(uid) || null;
  }

  public getSessionBySocketId(socketId: string): PlayerSession | null {
    const uid = this.socketToUid.get(socketId);
    return uid ? (this.sessionsByUid.get(uid) || null) : null;
  }

  // ==========================================
  // ROOM LIFECYCLE MANAGEMENT
  // ==========================================

  /**
   * Creates a private multiplayer room hosted by the caller.
   */
  public createRoom(
    hostUid: string,
    customRules?: HostCustomRules
  ): { ok: boolean; room?: ServerRoom; error?: string } {
    const hostSession = this.sessionsByUid.get(hostUid);
    if (!hostSession) {
      return { ok: false, error: 'Unauthorized: invalid host session' };
    }

    const roomId = 'room_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const inviteCode = this.generateUniqueInviteCode();

    const rules: HostCustomRules = {
      ...(customRules ?? DEFAULT_HOST_RULES),
      startingCash: 20000,
      passStartReward: 3000,
      jailBail: 500,
    };
    const maxPlayers = rules.maxPlayers ?? 4;
    const normalizedTimer: 0 | 30 | 45 | 60 =
      rules.turnTimerSeconds === 0 ? 0 :
      rules.turnTimerSeconds === 45 ? 45 :
      rules.turnTimerSeconds === 60 ? 60 : 30;
    const normalizedMode: 'STANDARD' | 'TIMED' =
      rules.gameMode === 'TIMED_45' || rules.gameMode === 'TIMED_60' ? 'TIMED' : 'STANDARD';
    const inviteCodeHash = crypto.createHash('sha256').update(inviteCode).digest('hex');

    const hostMember: RoomMember = {
      uid: hostUid,
      displayName: hostSession.displayName,
      photoURL: null,
      isReady: true, // Host is automatically marked ready
      joinedAt: Date.now(),
      colorToken: hostSession.avatarColor || PLAYER_PALETTE[0],
    };

    const room: ServerRoom = {
      roomId,
      inviteCode,
      inviteCodeHash,
      hostUid,
      status: 'LOBBY',
      maxPlayers,
      turnTimerSeconds: normalizedTimer,
      gameMode: normalizedMode,
      customRules: rules,
      members: {
        [hostUid]: hostMember,
      },
      memberUids: [hostUid],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24-hour lifetime
    };

    this.rooms.set(roomId, room);
    this.codeToRoomId.set(inviteCode, roomId);
    hostSession.roomId = roomId;

    return { ok: true, room };
  }

  /**
   * Validates and joins an existing private room using the 6-character code.
   */
  public joinRoom(
    inviteCode: string,
    playerUid: string
  ): { ok: boolean; room?: ServerRoom; error?: string } {
    const playerSession = this.sessionsByUid.get(playerUid);
    if (!playerSession) {
      return { ok: false, error: 'Unauthorized: invalid player session' };
    }

    const cleanCode = inviteCode.trim().toUpperCase();
    const roomId = this.codeToRoomId.get(cleanCode);

    if (!roomId || !this.rooms.has(roomId)) {
      return { ok: false, error: 'Room not found. Please verify the 6-character invitation code.' };
    }

    const room = this.rooms.get(roomId)!;

    // Reject joining if game has already progressed or completed
    if (room.status === 'IN_PROGRESS') {
      // Allow rejoining if the player is already an existing member of the match
      if (room.members[playerUid]) {
        playerSession.roomId = roomId;
        return { ok: true, room };
      }
      return { ok: false, error: 'Match is already in progress. New players cannot join.' };
    }

    if (room.status === 'COMPLETED') {
      return { ok: false, error: 'This room match has already concluded.' };
    }

    // Already a member in the lobby
    if (room.members[playerUid]) {
      playerSession.roomId = roomId;
      return { ok: true, room };
    }

    // Capacity check
    const currentMemberCount = Object.keys(room.members).length;
    if (currentMemberCount >= room.maxPlayers) {
      return { ok: false, error: `Room is full (Maximum ${room.maxPlayers} players reached).` };
    }

    // Pick a distinct color token not already taken
    const takenColors = new Set(Object.values(room.members).map((m) => m.colorToken));
    let assignedColor = playerSession.avatarColor;
    if (takenColors.has(assignedColor)) {
      const freeColor = PLAYER_PALETTE.find((c) => !takenColors.has(c));
      assignedColor = freeColor || PLAYER_PALETTE[currentMemberCount % PLAYER_PALETTE.length];
    }

    const newMember: RoomMember = {
      uid: playerUid,
      displayName: playerSession.displayName,
      photoURL: null,
      isReady: false,
      joinedAt: Date.now(),
      colorToken: assignedColor,
    };

    room.members[playerUid] = newMember;
    room.memberUids = Object.keys(room.members);
    room.updatedAt = Date.now();
    playerSession.roomId = roomId;

    return { ok: true, room };
  }

  /**
   * Toggles readiness status of a player in the lobby.
   */
  public setReady(
    roomId: string,
    playerUid: string,
    isReady: boolean
  ): { ok: boolean; room?: ServerRoom; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: 'Room not found' };

    if (room.status !== 'LOBBY') {
      return { ok: false, error: 'Cannot change readiness once game has started' };
    }

    const member = room.members[playerUid];
    if (!member) {
      return { ok: false, error: 'Player is not a member of this room' };
    }

    member.isReady = isReady;
    room.updatedAt = Date.now();
    return { ok: true, room };
  }

  /**
   * Removes a player from a room.
   */
  public leaveRoom(
    playerUid: string
  ): { ok: boolean; room?: ServerRoom; roomDeleted?: boolean } {
    const session = this.sessionsByUid.get(playerUid);
    if (!session || !session.roomId) return { ok: true };

    const roomId = session.roomId;
    const room = this.rooms.get(roomId);
    session.roomId = null;

    if (!room) return { ok: true };

    delete room.members[playerUid];
    room.memberUids = Object.keys(room.members);
    room.updatedAt = Date.now();

    const remainingMembers = Object.keys(room.members);

    // If room is empty, delete room immediately
    if (remainingMembers.length === 0) {
      this.rooms.delete(roomId);
      this.codeToRoomId.delete(room.inviteCode);
      return { ok: true, roomDeleted: true };
    }

    // If host left, promote the next oldest member to host
    if (room.hostUid === playerUid) {
      const nextHost = Object.values(room.members).sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (nextHost) {
        room.hostUid = nextHost.uid;
        nextHost.isReady = true; // Host is always ready
      }
    }

    return { ok: true, room };
  }

  public getRoom(roomId: string): ServerRoom | null {
    return this.rooms.get(roomId) || null;
  }

  public getRoomByCode(code: string): ServerRoom | null {
    const clean = code.trim().toUpperCase();
    const roomId = this.codeToRoomId.get(clean);
    return roomId ? (this.rooms.get(roomId) || null) : null;
  }

  public updateRoom(room: ServerRoom): void {
    room.updatedAt = Date.now();
    this.rooms.set(room.roomId, room);
  }

  /**
   * Safely clears expired rooms that have been inactive for over 24 hours.
   */
  public cleanupExpiredRooms(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (now > room.expiresAt || (Object.keys(room.members).length === 0 && now - room.updatedAt > 30 * 60 * 1000)) {
        this.rooms.delete(roomId);
        this.codeToRoomId.delete(room.inviteCode);
      }
    }
  }
}
