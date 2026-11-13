/**
 * Indian Monopoly - Room & Session Manager with Durable Persistence
 * Provides authoritative management of player sessions, room lifecycles,
 * member readiness, and invitation codes with backing persistence.
 */

import crypto from 'crypto';
import { RoomMember } from '../../src/domain/game-types';
import {
  DEFAULT_HOST_RULES,
  HostCustomRules,
  isValidStartingCash,
  PASS_START_REWARD_OPTIONS,
} from '../../src/domain/ruleset';
import { hashToken } from '../persistence';
import { MemoryStore } from '../persistence/memory-store';
import { PersistenceStore } from '../persistence/types';
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
  private store: PersistenceStore;
  private rooms: Map<string, ServerRoom> = new Map();
  private codeToRoomId: Map<string, string> = new Map();
  private sessionsByToken: Map<string, PlayerSession> = new Map();
  private sessionsByTokenHash: Map<string, PlayerSession> = new Map();
  private sessionsByUid: Map<string, PlayerSession> = new Map();
  private socketToUid: Map<string, string> = new Map();

  constructor(store?: PersistenceStore) {
    this.store = store || new MemoryStore();
  }

  public getStore(): PersistenceStore {
    return this.store;
  }

  /**
   * Loads persisted active rooms and player sessions on server startup.
   */
  public async loadActiveState(): Promise<void> {
    try {
      const activeRooms = await this.store.listActiveRooms();
      for (const room of activeRooms) {
        this.rooms.set(room.roomId, room);
        this.codeToRoomId.set(room.inviteCode.toUpperCase(), room.roomId);
      }
      console.log(`[RoomManager] Recovered ${activeRooms.length} active room(s) from persistence store.`);
    } catch (err) {
      console.warn('[RoomManager] Failed to load active state from store:', err);
    }
  }

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
    if (existingToken) {
      const existing =
        this.sessionsByToken.get(existingToken) ||
        this.sessionsByTokenHash.get(hashToken(existingToken));

      if (existing) {
        existing.displayName = cleanName;
        existing.avatarColor = chosenColor;
        existing.lastSeenAt = Date.now();
        if (ipAddress) existing.ipAddress = ipAddress;
        this.store.saveSession(existing).catch((err) => {
          console.warn('[RoomManager] Failed to persist updated session:', err);
        });
        return {
          uid: existing.uid,
          token: existing.token,
          displayName: existing.displayName,
          avatarColor: existing.avatarColor,
        };
      }
    }

    // Generate new unique UID and cryptographically secure token
    const uid = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

    const session: PlayerSession = {
      uid,
      token,
      tokenHash,
      displayName: cleanName,
      avatarColor: chosenColor,
      socketId: null,
      roomId: null,
      connected: false,
      lastSeenAt: Date.now(),
      ipAddress,
      sessionGeneration: 1,
    };

    this.sessionsByToken.set(token, session);
    this.sessionsByTokenHash.set(tokenHash, session);
    this.sessionsByUid.set(uid, session);

    this.store.saveSession(session).catch((err) => {
      console.warn('[RoomManager] Failed to persist new session:', err);
    });

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
    if (!token) return null;

    const tokenHash = hashToken(token);
    const session = this.sessionsByToken.get(token) || this.sessionsByTokenHash.get(tokenHash);

    if (!session) {
      return null;
    }

    if (displayName && displayName.trim()) {
      session.displayName = displayName.trim().slice(0, 30);
    }
    session.connected = true;
    session.lastSeenAt = Date.now();
    if (ipAddress) session.ipAddress = ipAddress;

    this.store.saveSession(session).catch((err) => {
      console.warn('[RoomManager] Failed to persist resumed session:', err);
    });

    return {
      uid: session.uid,
      token: session.token,
      displayName: session.displayName,
      avatarColor: session.avatarColor,
    };
  }

  /**
   * Associates a live Socket.IO connection with an authenticated player session.
   * Manages single active session policy with generation fencing.
   */
  public bindSocket(
    socketId: string,
    uid: string,
    ipAddress?: string
  ): { session: PlayerSession | null; previousSocketId: string | null } {
    const session = this.sessionsByUid.get(uid);
    if (!session) return { session: null, previousSocketId: null };

    const previousSocketId = session.socketId && session.socketId !== socketId ? session.socketId : null;

    if (previousSocketId) {
      this.socketToUid.delete(previousSocketId);
    }

    session.sessionGeneration = (session.sessionGeneration || 1) + 1;
    session.socketId = socketId;
    session.connected = true;
    session.lastSeenAt = Date.now();
    if (ipAddress) session.ipAddress = ipAddress;

    this.socketToUid.set(socketId, uid);

    this.store.saveSession(session).catch((err) => {
      console.warn('[RoomManager] Failed to persist bound socket:', err);
    });

    return { session, previousSocketId };
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
      this.store.saveSession(session).catch((err) => {
        console.warn('[RoomManager] Failed to persist unbound socket:', err);
      });
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
   * Creates a private multiplayer room hosted by the caller, optionally with computer players.
   */
  public async createRoom(
    hostUid: string,
    customRules?: HostCustomRules,
    cpuPlayers?: Array<{ name: string }>
  ): Promise<{ ok: boolean; room?: ServerRoom; error?: string }> {
    const hostSession = this.sessionsByUid.get(hostUid);
    if (!hostSession) {
      return { ok: false, error: 'Unauthorized: invalid host session' };
    }

    const roomId = 'room_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const inviteCode = this.generateUniqueInviteCode();

    // Configurable Starting Cash Slider: ₹5,000 to ₹50,000 in increments of ₹5,000 (default ₹20,000)
    const startingCash = isValidStartingCash(customRules?.startingCash)
      ? customRules.startingCash
      : DEFAULT_HOST_RULES.startingCash;

    // Pass START reward: configurable by host with options of ₹1,000, ₹2,000, or ₹3,000 (default ₹3,000)
    const passStartReward = (PASS_START_REWARD_OPTIONS as readonly number[]).includes(customRules?.passStartReward ?? 0)
      ? customRules!.passStartReward
      : DEFAULT_HOST_RULES.passStartReward;

    // Standard fixed statutory values
    const jailBail = 500;

    // Maximum room capacity is fixed at 6 total player slots
    const maxPlayers = 6;
    const rules: HostCustomRules = {
      ...(customRules ?? DEFAULT_HOST_RULES),
      maxPlayers: 6,
      startingCash,
      passStartReward,
      jailBail,
    };
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
      isReady: false,
      joinedAt: Date.now(),
      colorToken: hostSession.avatarColor || PLAYER_PALETTE[0],
      isCpu: false,
      playerType: 'HUMAN',
      roomJoinSequence: 1,
    };

    // Validate computer players configuration if provided
    const configuredCpuMembers: RoomMember[] = [];
    const cpuConfigs: { name: string }[] = [];

    if (cpuPlayers && Array.isArray(cpuPlayers) && cpuPlayers.length > 0) {
      if (cpuPlayers.length + 1 > maxPlayers) {
        return {
          ok: false,
          error: `Room capacity exceeded. Maximum 6 total players allowed per room (attempted ${cpuPlayers.length + 1}).`,
        };
      }

      const hostNameLower = hostSession.displayName.trim().toLowerCase();
      const seenNames = new Set<string>([hostNameLower]);
      const takenColors = new Set<string>([hostMember.colorToken]);

      for (let i = 0; i < cpuPlayers.length; i++) {
        const rawName = (cpuPlayers[i]?.name ?? `CPU${i + 1}`).trim();
        if (!rawName) {
          return { ok: false, error: 'Computer player name cannot be empty.' };
        }
        if (rawName.length < 2 || rawName.length > 20) {
          return {
            ok: false,
            error: `Computer player name "${rawName}" must be between 2 and 20 characters.`,
          };
        }
        if (!/^[a-zA-Z0-9 _-]+$/.test(rawName)) {
          return {
            ok: false,
            error: `Computer player name "${rawName}" contains invalid characters. Use letters, numbers, spaces, underscores, or hyphens.`,
          };
        }

        const nameLower = rawName.toLowerCase();
        if (seenNames.has(nameLower)) {
          return {
            ok: false,
            error: `Duplicate player name "${rawName}". Player names within the same room must be unique.`,
          };
        }
        seenNames.add(nameLower);

        // Pick distinct color
        const freeColor = PLAYER_PALETTE.find((c) => !takenColors.has(c));
        const assignedColor = freeColor || PLAYER_PALETTE[(i + 1) % PLAYER_PALETTE.length];
        takenColors.add(assignedColor);

        const cpuUid = 'cpu_' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
        const cpuMember: RoomMember = {
          uid: cpuUid,
          displayName: rawName,
          photoURL: null,
          isReady: true,
          joinedAt: Date.now() + i + 1,
          colorToken: assignedColor,
          isCpu: true,
          playerType: 'COMPUTER',
          roomJoinSequence: 2 + i,
        };

        configuredCpuMembers.push(cpuMember);
        cpuConfigs.push({ name: rawName });
      }
    }

    const membersRecord: Record<string, RoomMember> = {
      [hostUid]: hostMember,
    };
    const memberUids = [hostUid];

    for (const cpu of configuredCpuMembers) {
      membersRecord[cpu.uid] = cpu;
      memberUids.push(cpu.uid);
    }

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
      members: membersRecord,
      memberUids,
      cpuPlayers: cpuConfigs.length > 0 ? cpuConfigs : undefined,
      nextJoinSequence: 2 + configuredCpuMembers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };

    // Authoritative persistence: Await database commit before registering in-memory state and acknowledging success
    try {
      await this.store.createRoom(room);
      await this.store.saveSession(hostSession);
    } catch (err) {
      console.error('[RoomManager] Failed to persist new room to store:', err);
      return { ok: false, error: 'Failed to create room: database persistence failure' };
    }

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
        this.store.saveSession(playerSession).catch(() => {});
        return { ok: true, room };
      }
      return { ok: false, error: 'Match is already in progress. New players cannot join.' };
    }

    if (room.status === 'COMPLETED' || room.status === 'ARCHIVED') {
      return { ok: false, error: 'This room match has already concluded.' };
    }

    // Already a member in the lobby
    if (room.members[playerUid]) {
      playerSession.roomId = roomId;
      this.store.saveSession(playerSession).catch(() => {});
      return { ok: true, room };
    }

    // Duplicate name validation across human and computer players
    const joiningNameLower = playerSession.displayName.trim().toLowerCase();
    const hasNameCollision = Object.values(room.members).some(
      (m) => m.displayName.trim().toLowerCase() === joiningNameLower
    );
    if (hasNameCollision) {
      return {
        ok: false,
        error: `A player named "${playerSession.displayName}" is already in this room. Please choose a unique name.`,
      };
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

    const nextSeq =
      room.nextJoinSequence ||
      Math.max(0, ...Object.values(room.members).map((m) => m.roomJoinSequence || 0)) + 1;
    room.nextJoinSequence = nextSeq + 1;

    const newMember: RoomMember = {
      uid: playerUid,
      displayName: playerSession.displayName,
      photoURL: null,
      isReady: false,
      joinedAt: Date.now(),
      colorToken: assignedColor,
      isCpu: false,
      playerType: 'HUMAN',
      roomJoinSequence: nextSeq,
    };

    room.members[playerUid] = newMember;
    room.memberUids = Object.keys(room.members);
    room.updatedAt = Date.now();
    playerSession.roomId = roomId;

    this.store.updateRoom(room).catch(() => {});
    this.store.saveSession(playerSession).catch(() => {});

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

    if (member.isCpu || member.playerType === 'COMPUTER') {
      return { ok: false, error: 'Computer players are automatically ready.' };
    }

    member.isReady = isReady;
    room.updatedAt = Date.now();
    this.store.updateRoom(room).catch(() => {});
    return { ok: true, room };
  }

  /**
   * Adds an autonomous computer player (CPU) to an open slot in the room.
   */
  public addCpu(
    roomId: string,
    callerUid: string,
    name?: string
  ): { ok: boolean; room?: ServerRoom; cpuMember?: RoomMember; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: 'Room not found' };

    if (room.status !== 'LOBBY') {
      return { ok: false, error: 'Cannot add computer players once game has started.' };
    }

    if (room.hostUid !== callerUid) {
      return { ok: false, error: 'Only the room host can add computer players.' };
    }

    const currentCount = Object.keys(room.members).length;
    if (currentCount >= 6) {
      return { ok: false, error: 'Room is full. Maximum 6 players reached.' };
    }

    const existingNames = new Set(
      Object.values(room.members).map((m) => m.displayName.trim().toLowerCase())
    );

    let finalName = '';
    if (name && name.trim()) {
      const rawName = name.trim();
      if (rawName.length < 2 || rawName.length > 20) {
        return {
          ok: false,
          error: `Computer player name "${rawName}" must be between 2 and 20 characters.`,
        };
      }
      if (!/^[a-zA-Z0-9 _-]+$/.test(rawName)) {
        return {
          ok: false,
          error: `Computer player name "${rawName}" contains invalid characters. Use letters, numbers, spaces, underscores, or hyphens.`,
        };
      }
      if (existingNames.has(rawName.toLowerCase())) {
        return {
          ok: false,
          error: `A player named "${rawName}" already exists in this room. Please choose a unique name.`,
        };
      }
      finalName = rawName;
    } else {
      for (let i = 1; i <= 6; i++) {
        const candidate = `CPU${i}`;
        const altCandidate = `CPU ${i}`;
        if (!existingNames.has(candidate.toLowerCase()) && !existingNames.has(altCandidate.toLowerCase())) {
          finalName = candidate;
          break;
        }
      }
      if (!finalName) {
        finalName = `CPU${currentCount + 1}`;
      }
    }

    // Pick distinct color token
    const takenColors = new Set(Object.values(room.members).map((m) => m.colorToken));
    const freeColor = PLAYER_PALETTE.find((c) => !takenColors.has(c));
    const assignedColor = freeColor || PLAYER_PALETTE[currentCount % PLAYER_PALETTE.length];

    const nextSeq =
      room.nextJoinSequence ||
      Math.max(0, ...Object.values(room.members).map((m) => m.roomJoinSequence || 0)) + 1;
    room.nextJoinSequence = nextSeq + 1;

    const cpuUid = 'cpu_' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const cpuMember: RoomMember = {
      uid: cpuUid,
      displayName: finalName,
      photoURL: null,
      isReady: true,
      joinedAt: Date.now(),
      colorToken: assignedColor,
      isCpu: true,
      playerType: 'COMPUTER',
      roomJoinSequence: nextSeq,
    };

    room.members[cpuUid] = cpuMember;
    room.memberUids = Object.keys(room.members);
    room.cpuPlayers = Object.values(room.members)
      .filter((m) => m.isCpu || m.playerType === 'COMPUTER')
      .map((m) => ({ name: m.displayName }));
    room.updatedAt = Date.now();

    this.store.updateRoom(room).catch(() => {});

    return { ok: true, room, cpuMember };
  }

  /**
   * Removes an autonomous computer player (CPU) from the room before the match starts.
   */
  public removeCpu(
    roomId: string,
    callerUid: string,
    cpuUid: string
  ): { ok: boolean; room?: ServerRoom; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: 'Room not found' };

    if (room.status !== 'LOBBY') {
      return { ok: false, error: 'Cannot manage computer players once game has started.' };
    }

    if (room.hostUid !== callerUid) {
      return { ok: false, error: 'Only the room host can remove computer players.' };
    }

    const member = room.members[cpuUid];
    if (!member) {
      return { ok: false, error: 'Computer player not found in this room.' };
    }

    if (!member.isCpu && member.playerType !== 'COMPUTER') {
      return { ok: false, error: 'Cannot remove human players.' };
    }

    delete room.members[cpuUid];
    room.memberUids = Object.keys(room.members);
    const remainingCpus = Object.values(room.members)
      .filter((m) => m.isCpu || m.playerType === 'COMPUTER')
      .map((m) => ({ name: m.displayName }));
    room.cpuPlayers = remainingCpus.length > 0 ? remainingCpus : undefined;
    room.updatedAt = Date.now();

    this.store.updateRoom(room).catch(() => {});

    return { ok: true, room };
  }

  /**
   * Renames an autonomous computer player (CPU) in the lobby.
   */
  public renameCpu(
    roomId: string,
    callerUid: string,
    cpuUid: string,
    newName: string
  ): { ok: boolean; room?: ServerRoom; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: 'Room not found' };

    if (room.status !== 'LOBBY') {
      return { ok: false, error: 'Cannot manage computer players once game has started.' };
    }

    if (room.hostUid !== callerUid) {
      return { ok: false, error: 'Only the room host can rename computer players.' };
    }

    const member = room.members[cpuUid];
    if (!member) {
      return { ok: false, error: 'Computer player not found in this room.' };
    }

    if (!member.isCpu && member.playerType !== 'COMPUTER') {
      return { ok: false, error: 'Cannot rename human players.' };
    }

    const trimmed = (newName || '').trim();
    if (!trimmed) {
      return { ok: false, error: 'Computer player name cannot be empty.' };
    }

    if (trimmed.length < 2 || trimmed.length > 20) {
      return {
        ok: false,
        error: `Computer player name "${trimmed}" must be between 2 and 20 characters.`,
      };
    }

    if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
      return {
        ok: false,
        error: `Computer player name "${trimmed}" contains invalid characters. Use letters, numbers, spaces, underscores, or hyphens.`,
      };
    }

    const targetLower = trimmed.toLowerCase();
    const hasCollision = Object.values(room.members).some(
      (m) => m.uid !== cpuUid && m.displayName.trim().toLowerCase() === targetLower
    );

    if (hasCollision) {
      return {
        ok: false,
        error: `A player named "${trimmed}" already exists in this room. Please choose a unique name.`,
      };
    }

    member.displayName = trimmed;
    room.cpuPlayers = Object.values(room.members)
      .filter((m) => m.isCpu || m.playerType === 'COMPUTER')
      .map((m) => ({ name: m.displayName }));
    room.updatedAt = Date.now();

    this.store.updateRoom(room).catch(() => {});

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
    this.store.saveSession(session).catch(() => {});

    if (!room) return { ok: true };

    delete room.members[playerUid];
    room.memberUids = Object.keys(room.members);
    room.updatedAt = Date.now();

    const remainingMembers = Object.keys(room.members);

    // If room is empty, delete room immediately
    if (remainingMembers.length === 0) {
      this.rooms.delete(roomId);
      this.codeToRoomId.delete(room.inviteCode);
      this.store.deleteRoom(roomId).catch(() => {});
      return { ok: true, roomDeleted: true };
    }

    // If host left, promote the next oldest member to host
    if (room.hostUid === playerUid) {
      const nextHost = Object.values(room.members).sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (nextHost) {
        room.hostUid = nextHost.uid;
      }
    }

    this.store.updateRoom(room).catch(() => {});

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
    this.store.updateRoom(room).catch(() => {});
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
        this.store.deleteRoom(roomId).catch(() => {});
      }
    }
  }
}
