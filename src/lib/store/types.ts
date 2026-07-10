import type {
  ChallengeStatus,
  HiddenSide,
  KnowMeStatus,
  MemoryKind,
  RandomStatus,
  WhereAmIStatus,
} from "../types";

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
  /** Updated on every /api/me poll — powers "partner is online" presence. */
  lastSeenAt: string | null;
}

export type BoothStatus = "pending" | "live" | "completed" | "cancelled";

/** A live two-camera photobooth session shared by both partners. */
export interface BoothRecord {
  id: string;
  roomId: string;
  initiatorId: string;
  status: BoothStatus;
  shots: number;
  /** Participant ids that have opened the booth with a camera ready. */
  readyIds: string[];
  /** Server epoch-ms anchor both devices count down from (null until live). */
  startAt: number | null;
  stripPath: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** One captured frame — each participant contributes `shots` of them. */
export interface BoothFrameRecord {
  id: string;
  boothId: string;
  participantId: string;
  idx: number;
  path: string;
  createdAt: string;
}

export type TrackKind = "queue" | "dedication";

/** A song on the room record player, or a personal dedication. */
export interface TrackRecord {
  id: string;
  roomId: string;
  addedById: string;
  kind: TrackKind;
  title: string;
  artist: string | null;
  url: string;
  provider: string;
  embedUrl: string | null;
  lyric: string | null;
  notePath: string | null;
  createdAt: string;
}

export interface NewTrack {
  id: string;
  roomId: string;
  addedById: string;
  kind: TrackKind;
  title: string;
  artist: string | null;
  url: string;
  provider: string;
  embedUrl: string | null;
  lyric: string | null;
  notePath: string | null;
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

/** One browser's Web Push subscription, owned by a room participant. */
export interface PushSubscriptionRecord {
  id: string;
  participantId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
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

// ── Game 4 · Where Am I ──────────────────────────────────────

/** One round: a photo of a secret place plus its answer and 3 hints. */
export interface WhereAmIRoundRecord {
  id: string;
  roomId: string;
  creatorId: string;
  status: WhereAmIStatus;
  photoPath: string;
  width: number;
  height: number;
  answer: string;
  hints: string[];
  createdAt: string;
  completedAt: string | null;
}

/** One typed guess at a round's secret place. */
export interface WhereAmIGuessRecord {
  id: string;
  roundId: string;
  participantId: string;
  text: string;
  correct: boolean;
  createdAt: string;
}

export interface NewWhereAmIRound {
  /** Generated up front so storage paths and the record share one id. */
  id: string;
  roomId: string;
  creatorId: string;
  photoPath: string;
  width: number;
  height: number;
  answer: string;
  hints: string[];
}

export interface NewWhereAmIGuess {
  roundId: string;
  participantId: string;
  text: string;
  correct: boolean;
}

// ── Game 3 · Know Me ─────────────────────────────────────────

/** One Know Me round: five questions both partners answer, then rate. */
export interface KnowMeRoundRecord {
  id: string;
  roomId: string;
  starterId: string;
  questions: string[];
  status: KnowMeStatus;
  createdAt: string;
  completedAt: string | null;
}

/** One partner's sheet for a round: per-question truth + guess, plus their
 *  verdicts (`ratings`) on the PARTNER's guesses about them. */
export interface KnowMeAnswerRecord {
  id: string;
  roundId: string;
  participantId: string;
  answers: { truth: string; guess: string }[];
  ratings: boolean[] | null;
  createdAt: string;
}

export interface NewKnowMeRound {
  id: string;
  roomId: string;
  starterId: string;
  questions: string[];
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
  /** Record that a participant is currently active (presence heartbeat). */
  touch(participantId: string): Promise<void>;
  /** Permanently removes the room, its participants, challenges and files. */
  deleteRoom(roomId: string): Promise<void>;

  // ── Instant photobooth ─────────────────────────────────────
  createBooth(roomId: string, initiatorId: string, shots: number): Promise<BoothRecord>;
  getBooth(id: string): Promise<BoothRecord | null>;
  getActiveBooth(roomId: string): Promise<BoothRecord | null>;
  listBooths(roomId: string): Promise<BoothRecord[]>;
  readyBooth(
    boothId: string,
    participantId: string,
    requiredIds: string[],
    startDelayMs: number
  ): Promise<BoothRecord | null>;
  addBoothFrame(
    boothId: string,
    participantId: string,
    idx: number,
    path: string
  ): Promise<void>;
  listBoothFrames(boothId: string): Promise<BoothFrameRecord[]>;
  setBoothStrip(boothId: string, stripPath: string): Promise<void>;
  cancelBooth(boothId: string): Promise<void>;

  // ── Record player ──────────────────────────────────────────
  createTrack(data: NewTrack): Promise<TrackRecord>;
  listTracks(roomId: string): Promise<TrackRecord[]>;
  deleteTrack(id: string): Promise<void>;

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

  // ── Push subscriptions ─────────────────────────────────────
  savePushSubscription(
    participantId: string,
    sub: { endpoint: string; p256dh: string; auth: string }
  ): Promise<void>;
  listPushSubscriptions(participantId: string): Promise<PushSubscriptionRecord[]>;
  deletePushSubscription(endpoint: string): Promise<void>;

  // ── Files ──────────────────────────────────────────────────
  saveFile(path: string, data: Uint8Array, contentType: string): Promise<void>;
  fileUrl(path: string): string;

  // ── Game 4 · Where Am I ────────────────────────────────────
  createWhereAmIRound(data: NewWhereAmIRound): Promise<WhereAmIRoundRecord>;
  listWhereAmIRounds(roomId: string): Promise<WhereAmIRoundRecord[]>;
  getWhereAmIRound(id: string): Promise<WhereAmIRoundRecord | null>;
  addWhereAmIGuess(data: NewWhereAmIGuess): Promise<WhereAmIGuessRecord>;
  listWhereAmIGuesses(roundId: string): Promise<WhereAmIGuessRecord[]>;
  setWhereAmIStatus(
    id: string,
    status: WhereAmIStatus,
    completedAt?: string
  ): Promise<void>;

  // ── Game 3 · Know Me ───────────────────────────────────────
  createKnowMeRound(data: NewKnowMeRound): Promise<KnowMeRoundRecord>;
  listKnowMeRounds(roomId: string): Promise<KnowMeRoundRecord[]>;
  getKnowMeRound(id: string): Promise<KnowMeRoundRecord | null>;
  upsertKnowMeAnswer(data: {
    roundId: string;
    participantId: string;
    answers: { truth: string; guess: string }[];
  }): Promise<KnowMeAnswerRecord>;
  listKnowMeAnswers(roundId: string): Promise<KnowMeAnswerRecord[]>;
  saveKnowMeRatings(
    roundId: string,
    participantId: string,
    ratings: boolean[]
  ): Promise<void>;
  setKnowMeStatus(id: string, status: KnowMeStatus, completedAt?: string): Promise<void>;
}
