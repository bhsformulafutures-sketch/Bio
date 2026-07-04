import type { ChallengeStatus, HiddenSide, RandomStatus } from "../types";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  token: string;
  createdAt: string;
}

export interface VerificationRecord {
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  createdAt: string;
}

export interface RoomRecord {
  id: string;
  code: string;
  createdAt: string;
}

export interface ParticipantRecord {
  id: string;
  roomId: string;
  userId: string | null;
  name: string;
  token: string;
  joinedAt: string;
}

export interface ChallengeRecord {
  id: string;
  roomId: string;
  creatorId: string;
  solverId: string | null;
  status: ChallengeStatus;
  hiddenSide: HiddenSide;
  hiddenRatio: number;
  width: number;
  height: number;
  originalPath: string;
  visiblePath: string;
  drawingPath: string | null;
  mergedPath: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface NewChallenge {
  /** Generated up front so storage paths and the record share one id. */
  id: string;
  roomId: string;
  creatorId: string;
  hiddenSide: HiddenSide;
  hiddenRatio: number;
  width: number;
  height: number;
  originalPath: string;
  visiblePath: string;
}

export interface RandomRecord {
  id: string;
  roomId: string;
  starterId: string;
  prompt: string;
  category: string;
  status: RandomStatus;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
}

export interface RandomSubmissionRecord {
  id: string;
  randomId: string;
  participantId: string;
  photoPath: string;
  width: number;
  height: number;
  caption: string | null;
  createdAt: string;
}

export interface NewRandom {
  id: string;
  roomId: string;
  starterId: string;
  prompt: string;
  category: string;
  expiresAt: string;
}

export interface NewRandomSubmission {
  randomId: string;
  participantId: string;
  photoPath: string;
  width: number;
  height: number;
  caption: string | null;
}

/** A completed moment can be either kind of game. */
export type MemoryKind = "challenge" | "random";

export interface AlbumRecord {
  id: string;
  roomId: string;
  name: string;
  createdAt: string;
}

/** One memory's membership in one album. */
export interface AlbumItemRecord {
  albumId: string;
  kind: MemoryKind;
  itemId: string;
  addedAt: string;
}

/** Everything the app knows about the signed-in person and, if they're in
 *  one, the active room and their partner. */
export interface SessionRecord {
  user: UserRecord;
  participant: ParticipantRecord;
  room: RoomRecord;
  partner: ParticipantRecord | null;
}

export type JoinResult =
  | { ok: true; room: RoomRecord; participant: ParticipantRecord }
  | { ok: false; reason: "not_found" | "full" | "already_in" };

/**
 * Persistence boundary. Two implementations:
 *  - SupabaseStore (production: Postgres + Storage)
 *  - LocalStore   (zero-config dev: JSON file + local blobs)
 */
export interface Store {
  // ── Identity & email verification ──────────────────────────
  upsertVerification(email: string, codeHash: string, expiresAt: string): Promise<void>;
  getVerification(email: string): Promise<VerificationRecord | null>;
  incrementVerificationAttempts(email: string): Promise<void>;
  deleteVerification(email: string): Promise<void>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserByToken(token: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  createUser(email: string, name: string, avatar: string | null): Promise<UserRecord>;
  updateUser(id: string, patch: { name?: string; avatar?: string | null }): Promise<UserRecord>;

  // ── Rooms & membership ─────────────────────────────────────
  createRoom(userId: string, name: string): Promise<{ room: RoomRecord; participant: ParticipantRecord }>;
  joinRoom(code: string, userId: string, name: string): Promise<JoinResult>;
  getRoom(roomId: string): Promise<RoomRecord | null>;
  getMembership(userId: string, roomId: string): Promise<ParticipantRecord | null>;
  listMemberships(userId: string): Promise<ParticipantRecord[]>;
  getRoomParticipants(roomId: string): Promise<ParticipantRecord[]>;
  /** Permanently removes the room, its participants, challenges and files. */
  deleteRoom(roomId: string): Promise<void>;

  // ── Game 1 · Other Half ────────────────────────────────────
  createChallenge(data: NewChallenge): Promise<ChallengeRecord>;
  listChallenges(roomId: string): Promise<ChallengeRecord[]>;
  getChallenge(id: string): Promise<ChallengeRecord | null>;
  /** Atomically flips waiting → completed; returns "conflict" if already done. */
  completeChallenge(
    id: string,
    solverId: string,
    drawingPath: string
  ): Promise<ChallengeRecord | "conflict" | null>;
  setMergedPath(id: string, mergedPath: string): Promise<void>;

  // ── Game 2 · Random Challenge ──────────────────────────────
  createRandom(data: NewRandom): Promise<RandomRecord>;
  listRandoms(roomId: string): Promise<RandomRecord[]>;
  getRandom(id: string): Promise<RandomRecord | null>;
  addRandomSubmission(data: NewRandomSubmission): Promise<RandomSubmissionRecord>;
  listRandomSubmissions(randomId: string): Promise<RandomSubmissionRecord[]>;
  markRandomCompleted(id: string): Promise<void>;
  markRandomExpired(id: string): Promise<void>;

  // ── Albums ─────────────────────────────────────────────────
  listAlbums(roomId: string): Promise<AlbumRecord[]>;
  getAlbum(id: string): Promise<AlbumRecord | null>;
  createAlbum(roomId: string, name: string): Promise<AlbumRecord>;
  renameAlbum(id: string, name: string): Promise<AlbumRecord | null>;
  deleteAlbum(id: string): Promise<void>;
  listAlbumItems(albumId: string): Promise<AlbumItemRecord[]>;
  /** Every album-membership row in a room, for computing covers & badges. */
  listAlbumItemsForRoom(roomId: string): Promise<AlbumItemRecord[]>;
  addAlbumItem(albumId: string, kind: MemoryKind, itemId: string): Promise<void>;
  removeAlbumItem(albumId: string, kind: MemoryKind, itemId: string): Promise<void>;

  // ── Files ──────────────────────────────────────────────────
  saveFile(path: string, data: Uint8Array, contentType: string): Promise<void>;
  fileUrl(path: string): string;
}
