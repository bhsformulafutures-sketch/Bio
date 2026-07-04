import type { ChallengeStatus, HiddenSide, MemoryKind, RandomStatus } from "../types";

export interface UserRecord {
  id: string;
  name: string;
  avatar: string | null;
  /** Opaque device token — the only credential; persisted in a cookie. */
  token: string;
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

/** A shared scrapbook album — a named collection of memories in a room. */
export interface AlbumRecord {
  id: string;
  roomId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** One memory (a challenge or a random) filed inside an album. */
export interface AlbumItemRecord {
  id: string;
  albumId: string;
  kind: MemoryKind;
  memoryId: string;
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

export type CreateRoomResult =
  | { ok: true; room: RoomRecord; participant: ParticipantRecord }
  | { ok: false; reason: "taken" };

/**
 * Persistence boundary. Two implementations:
 *  - SupabaseStore (production: Postgres + Storage)
 *  - LocalStore   (zero-config dev: JSON file + local blobs)
 */
export interface Store {
  // ── Identity ───────────────────────────────────────────────
  getUserByToken(token: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  createUser(name: string, avatar: string | null): Promise<UserRecord>;
  updateUser(id: string, patch: { name?: string; avatar?: string | null }): Promise<UserRecord>;

  // ── Rooms & membership ─────────────────────────────────────
  /** Create a room with a caller-chosen code. Fails if the code is taken. */
  createRoom(userId: string, name: string, code: string): Promise<CreateRoomResult>;
  joinRoom(code: string, userId: string, name: string): Promise<JoinResult>;
  getRoom(roomId: string): Promise<RoomRecord | null>;
  getRoomByCode(code: string): Promise<RoomRecord | null>;
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
  createAlbum(roomId: string, name: string): Promise<AlbumRecord>;
  listAlbums(roomId: string): Promise<AlbumRecord[]>;
  getAlbum(id: string): Promise<AlbumRecord | null>;
  renameAlbum(id: string, name: string): Promise<AlbumRecord>;
  deleteAlbum(id: string): Promise<void>;
  listAlbumItems(albumId: string): Promise<AlbumItemRecord[]>;
  /** Which albums (ids) in a room already contain a given memory. */
  albumIdsForMemory(roomId: string, kind: MemoryKind, memoryId: string): Promise<string[]>;
  addAlbumItem(albumId: string, kind: MemoryKind, memoryId: string): Promise<AlbumItemRecord>;
  removeAlbumItem(albumId: string, kind: MemoryKind, memoryId: string): Promise<void>;

  // ── Files ──────────────────────────────────────────────────
  saveFile(path: string, data: Uint8Array, contentType: string): Promise<void>;
  fileUrl(path: string): string;
}
