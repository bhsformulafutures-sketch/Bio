import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { newToken } from "../id";
import type { MemoryKind } from "../types";
import type {
  AlbumItemRecord,
  AlbumRecord,
  BoothFrameRecord,
  BoothRecord,
  ChallengeRecord,
  CreateRoomResult,
  JoinResult,
  KnowMeAnswerRecord,
  KnowMeRoundRecord,
  NewChallenge,
  NewKnowMeRound,
  NewRandom,
  NewRandomSubmission,
  NewTrack,
  PlayerStateRecord,
  NewWhereAmIGuess,
  NewWhereAmIRound,
  ParticipantRecord,
  PushSubscriptionRecord,
  RandomRecord,
  RandomSubmissionRecord,
  RoomRecord,
  Store,
  TrackRecord,
  UserRecord,
  WhereAmIGuessRecord,
  WhereAmIRoundRecord,
} from "./types";
import type { WhereAmIStatus } from "../types";
import type { KnowMeStatus } from "../types";

interface Db {
  users: UserRecord[];
  rooms: RoomRecord[];
  participants: ParticipantRecord[];
  challenges: ChallengeRecord[];
  randoms: RandomRecord[];
  randomSubmissions: RandomSubmissionRecord[];
  albums: AlbumRecord[];
  albumItems: AlbumItemRecord[];
  pushSubscriptions: PushSubscriptionRecord[];
  // ── Game 4 · Where Am I
  whereamiRounds: WhereAmIRoundRecord[];
  whereamiGuesses: WhereAmIGuessRecord[];
  // ── Game 3 · Know Me ───────────────────────────────────────
  knowmeRounds: KnowMeRoundRecord[];
  knowmeAnswers: KnowMeAnswerRecord[];
  // ── Photobooth & radio ─────────────────────────────────────
  booths: BoothRecord[];
  boothFrames: BoothFrameRecord[];
  tracks: TrackRecord[];
  playerStates: PlayerStateRecord[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const FILES_DIR = path.join(DATA_DIR, "files");

const EMPTY_DB: Db = {
  users: [],
  rooms: [],
  participants: [],
  challenges: [],
  randoms: [],
  randomSubmissions: [],
  albums: [],
  albumItems: [],
  pushSubscriptions: [],
  // ── Game 4 · Where Am I
  whereamiRounds: [],
  whereamiGuesses: [],
  // ── Game 3 · Know Me ───────────────────────────────────────
  knowmeRounds: [],
  knowmeAnswers: [],
  // ── Photobooth & radio ─────────────────────────────────────
  booths: [],
  boothFrames: [],
  tracks: [],
  playerStates: [],
};

/**
 * Zero-configuration store for local development and demos.
 * Everything lives under .data/ (gitignored). Not used when
 * SUPABASE_URL is configured.
 */
export class LocalStore implements Store {
  private queue: Promise<unknown> = Promise.resolve();

  /** Serialize all read-modify-write cycles to keep the JSON file consistent. */
  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => {});
    return next;
  }

  private async readDb(): Promise<Db> {
    try {
      const parsed = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Partial<Db>;
      return { ...EMPTY_DB, ...parsed };
    } catch {
      return { ...EMPTY_DB };
    }
  }

  private async writeDb(db: Db): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
  }

  // ── Identity ───────────────────────────────────────────────

  async getUserByToken(token: string): Promise<UserRecord | null> {
    const db = await this.readDb();
    return db.users.find((u) => u.token === token) ?? null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const db = await this.readDb();
    return db.users.find((u) => u.id === id) ?? null;
  }

  createUser(name: string, avatar: string | null) {
    return this.locked(async () => {
      const db = await this.readDb();
      const user: UserRecord = {
        id: randomUUID(),
        name,
        avatar,
        token: newToken(),
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      await this.writeDb(db);
      return user;
    });
  }

  updateUser(id: string, patch: { name?: string; avatar?: string | null }) {
    return this.locked(async () => {
      const db = await this.readDb();
      const user = db.users.find((u) => u.id === id);
      if (!user) throw new Error("User not found");
      if (patch.name !== undefined) user.name = patch.name;
      if (patch.avatar !== undefined) user.avatar = patch.avatar;
      // Keep the person's name in sync across their room memberships.
      for (const p of db.participants) {
        if (p.userId === id && patch.name !== undefined) p.name = patch.name;
      }
      await this.writeDb(db);
      return user;
    });
  }

  // ── Rooms & membership ─────────────────────────────────────

  createRoom(userId: string, name: string, code: string): Promise<CreateRoomResult> {
    return this.locked(async () => {
      const db = await this.readDb();
      if (db.rooms.some((r) => r.code === code)) {
        return { ok: false as const, reason: "taken" as const };
      }
      const room: RoomRecord = {
        id: randomUUID(),
        code,
        createdAt: new Date().toISOString(),
      };
      const nowIso = new Date().toISOString();
      const participant: ParticipantRecord = {
        id: randomUUID(),
        roomId: room.id,
        userId,
        name,
        token: newToken(),
        joinedAt: nowIso,
        lastSeenAt: nowIso,
      };
      db.rooms.push(room);
      db.participants.push(participant);
      await this.writeDb(db);
      return { ok: true as const, room, participant };
    });
  }

  joinRoom(code: string, userId: string, name: string): Promise<JoinResult> {
    return this.locked(async () => {
      const db = await this.readDb();
      const room = db.rooms.find((r) => r.code === code);
      if (!room) return { ok: false as const, reason: "not_found" as const };
      const members = db.participants.filter((p) => p.roomId === room.id);
      if (members.some((p) => p.userId === userId)) {
        return { ok: false as const, reason: "already_in" as const };
      }
      if (members.length >= 2) return { ok: false as const, reason: "full" as const };
      const nowIso = new Date().toISOString();
      const participant: ParticipantRecord = {
        id: randomUUID(),
        roomId: room.id,
        userId,
        name,
        token: newToken(),
        joinedAt: nowIso,
        lastSeenAt: nowIso,
      };
      db.participants.push(participant);
      await this.writeDb(db);
      return { ok: true as const, room, participant };
    });
  }

  async getRoom(roomId: string): Promise<RoomRecord | null> {
    const db = await this.readDb();
    return db.rooms.find((r) => r.id === roomId) ?? null;
  }

  async getRoomByCode(code: string): Promise<RoomRecord | null> {
    const db = await this.readDb();
    return db.rooms.find((r) => r.code === code) ?? null;
  }

  async getMembership(userId: string, roomId: string): Promise<ParticipantRecord | null> {
    const db = await this.readDb();
    return (
      db.participants.find((p) => p.userId === userId && p.roomId === roomId) ?? null
    );
  }

  async listMemberships(userId: string): Promise<ParticipantRecord[]> {
    const db = await this.readDb();
    return db.participants
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
  }

  async getRoomParticipants(roomId: string): Promise<ParticipantRecord[]> {
    const db = await this.readDb();
    return db.participants.filter((p) => p.roomId === roomId);
  }

  touch(participantId: string): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
      const p = db.participants.find((x) => x.id === participantId);
      if (p) {
        p.lastSeenAt = new Date().toISOString();
        await this.writeDb(db);
      }
    });
  }

  deleteRoom(roomId: string): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
      const removedParticipants = db.participants
        .filter((p) => p.roomId === roomId)
        .map((p) => p.id);
      db.pushSubscriptions = db.pushSubscriptions.filter(
        (s) => !removedParticipants.includes(s.participantId)
      );
      db.rooms = db.rooms.filter((r) => r.id !== roomId);
      db.participants = db.participants.filter((p) => p.roomId !== roomId);
      db.challenges = db.challenges.filter((c) => c.roomId !== roomId);
      const removedRandoms = db.randoms.filter((r) => r.roomId === roomId).map((r) => r.id);
      db.randoms = db.randoms.filter((r) => r.roomId !== roomId);
      db.randomSubmissions = db.randomSubmissions.filter(
        (s) => !removedRandoms.includes(s.randomId)
      );
      const removedAlbums = db.albums.filter((a) => a.roomId === roomId).map((a) => a.id);
      db.albums = db.albums.filter((a) => a.roomId !== roomId);
      db.albumItems = db.albumItems.filter((i) => !removedAlbums.includes(i.albumId));
      // ── Game 4 · Where Am I
      const removedRounds = db.whereamiRounds
        .filter((r) => r.roomId === roomId)
        .map((r) => r.id);
      db.whereamiRounds = db.whereamiRounds.filter((r) => r.roomId !== roomId);
      db.whereamiGuesses = db.whereamiGuesses.filter(
        (g) => !removedRounds.includes(g.roundId)
      );
      // ── Game 3 · Know Me ───────────────────────────────────
      const removedKnowMe = db.knowmeRounds
        .filter((r) => r.roomId === roomId)
        .map((r) => r.id);
      db.knowmeRounds = db.knowmeRounds.filter((r) => r.roomId !== roomId);
      db.knowmeAnswers = db.knowmeAnswers.filter(
        (a) => !removedKnowMe.includes(a.roundId)
      );
      // ── Photobooth & radio ─────────────────────────────────
      const removedBooths = db.booths.filter((b) => b.roomId === roomId).map((b) => b.id);
      db.booths = db.booths.filter((b) => b.roomId !== roomId);
      db.boothFrames = db.boothFrames.filter((f) => !removedBooths.includes(f.boothId));
      db.tracks = db.tracks.filter((t) => t.roomId !== roomId);
      db.playerStates = db.playerStates.filter((p) => p.roomId !== roomId);
      await this.writeDb(db);
      await fs.rm(path.join(FILES_DIR, "rooms", roomId), {
        recursive: true,
        force: true,
      });
    });
  }

  // ── Game 1 · Other Half ────────────────────────────────────

  createChallenge(data: NewChallenge) {
    return this.locked(async () => {
      const db = await this.readDb();
      const challenge: ChallengeRecord = {
        ...data,
        solverId: null,
        status: "waiting",
        drawingPath: null,
        mergedPath: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      db.challenges.push(challenge);
      await this.writeDb(db);
      return challenge;
    });
  }

  async listChallenges(roomId: string): Promise<ChallengeRecord[]> {
    const db = await this.readDb();
    return db.challenges
      .filter((c) => c.roomId === roomId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getChallenge(id: string): Promise<ChallengeRecord | null> {
    const db = await this.readDb();
    return db.challenges.find((c) => c.id === id) ?? null;
  }

  completeChallenge(id: string, solverId: string, drawingPath: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const challenge = db.challenges.find((c) => c.id === id);
      if (!challenge) return null;
      if (challenge.status !== "waiting") return "conflict" as const;
      challenge.status = "completed";
      challenge.solverId = solverId;
      challenge.drawingPath = drawingPath;
      challenge.completedAt = new Date().toISOString();
      await this.writeDb(db);
      return challenge;
    });
  }

  setMergedPath(id: string, mergedPath: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const challenge = db.challenges.find((c) => c.id === id);
      if (challenge) {
        challenge.mergedPath = mergedPath;
        await this.writeDb(db);
      }
    });
  }

  // ── Game 2 · Random Challenge ──────────────────────────────

  createRandom(data: NewRandom) {
    return this.locked(async () => {
      const db = await this.readDb();
      const random: RandomRecord = {
        ...data,
        status: "open",
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      db.randoms.push(random);
      await this.writeDb(db);
      return random;
    });
  }

  async listRandoms(roomId: string): Promise<RandomRecord[]> {
    const db = await this.readDb();
    return db.randoms
      .filter((r) => r.roomId === roomId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getRandom(id: string): Promise<RandomRecord | null> {
    const db = await this.readDb();
    return db.randoms.find((r) => r.id === id) ?? null;
  }

  addRandomSubmission(data: NewRandomSubmission) {
    return this.locked(async () => {
      const db = await this.readDb();
      const existing = db.randomSubmissions.find(
        (s) => s.randomId === data.randomId && s.participantId === data.participantId
      );
      if (existing) {
        existing.photoPath = data.photoPath;
        existing.width = data.width;
        existing.height = data.height;
        existing.caption = data.caption;
        await this.writeDb(db);
        return existing;
      }
      const submission: RandomSubmissionRecord = {
        id: randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
      };
      db.randomSubmissions.push(submission);
      await this.writeDb(db);
      return submission;
    });
  }

  async listRandomSubmissions(randomId: string): Promise<RandomSubmissionRecord[]> {
    const db = await this.readDb();
    return db.randomSubmissions
      .filter((s) => s.randomId === randomId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  markRandomCompleted(id: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const random = db.randoms.find((r) => r.id === id);
      if (random && random.status === "open") {
        random.status = "completed";
        random.completedAt = new Date().toISOString();
        await this.writeDb(db);
      }
    });
  }

  markRandomExpired(id: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const random = db.randoms.find((r) => r.id === id);
      if (random && random.status === "open") {
        random.status = "expired";
        await this.writeDb(db);
      }
    });
  }

  // ── Albums ─────────────────────────────────────────────────

  createAlbum(roomId: string, name: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const now = new Date().toISOString();
      const album: AlbumRecord = {
        id: randomUUID(),
        roomId,
        name,
        createdAt: now,
        updatedAt: now,
      };
      db.albums.push(album);
      await this.writeDb(db);
      return album;
    });
  }

  async listAlbums(roomId: string): Promise<AlbumRecord[]> {
    const db = await this.readDb();
    return db.albums
      .filter((a) => a.roomId === roomId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getAlbum(id: string): Promise<AlbumRecord | null> {
    const db = await this.readDb();
    return db.albums.find((a) => a.id === id) ?? null;
  }

  renameAlbum(id: string, name: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const album = db.albums.find((a) => a.id === id);
      if (!album) throw new Error("Album not found");
      album.name = name;
      album.updatedAt = new Date().toISOString();
      await this.writeDb(db);
      return album;
    });
  }

  deleteAlbum(id: string): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
      db.albums = db.albums.filter((a) => a.id !== id);
      db.albumItems = db.albumItems.filter((i) => i.albumId !== id);
      await this.writeDb(db);
    });
  }

  async listAlbumItems(albumId: string): Promise<AlbumItemRecord[]> {
    const db = await this.readDb();
    return db.albumItems
      .filter((i) => i.albumId === albumId)
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }

  async albumIdsForMemory(
    roomId: string,
    kind: MemoryKind,
    memoryId: string
  ): Promise<string[]> {
    const db = await this.readDb();
    const roomAlbumIds = new Set(
      db.albums.filter((a) => a.roomId === roomId).map((a) => a.id)
    );
    return db.albumItems
      .filter(
        (i) =>
          roomAlbumIds.has(i.albumId) && i.kind === kind && i.memoryId === memoryId
      )
      .map((i) => i.albumId);
  }

  addAlbumItem(albumId: string, kind: MemoryKind, memoryId: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const existing = db.albumItems.find(
        (i) => i.albumId === albumId && i.kind === kind && i.memoryId === memoryId
      );
      if (existing) return existing;
      const item: AlbumItemRecord = {
        id: randomUUID(),
        albumId,
        kind,
        memoryId,
        addedAt: new Date().toISOString(),
      };
      db.albumItems.push(item);
      const album = db.albums.find((a) => a.id === albumId);
      if (album) album.updatedAt = item.addedAt;
      await this.writeDb(db);
      return item;
    });
  }

  removeAlbumItem(albumId: string, kind: MemoryKind, memoryId: string): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
      db.albumItems = db.albumItems.filter(
        (i) => !(i.albumId === albumId && i.kind === kind && i.memoryId === memoryId)
      );
      const album = db.albums.find((a) => a.id === albumId);
      if (album) album.updatedAt = new Date().toISOString();
      await this.writeDb(db);
    });
  }

  // ── Push subscriptions ─────────────────────────────────────

  savePushSubscription(
    participantId: string,
    sub: { endpoint: string; p256dh: string; auth: string }
  ): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
      const existing = db.pushSubscriptions.find((s) => s.endpoint === sub.endpoint);
      if (existing) {
        existing.participantId = participantId;
        existing.p256dh = sub.p256dh;
        existing.auth = sub.auth;
      } else {
        db.pushSubscriptions.push({
          id: randomUUID(),
          participantId,
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          createdAt: new Date().toISOString(),
        });
      }
      await this.writeDb(db);
    });
  }

  async listPushSubscriptions(participantId: string): Promise<PushSubscriptionRecord[]> {
    const db = await this.readDb();
    return db.pushSubscriptions.filter((s) => s.participantId === participantId);
  }

  deletePushSubscription(endpoint: string): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
      db.pushSubscriptions = db.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
      await this.writeDb(db);
    });
  }

  // ── Instant photobooth ─────────────────────────────────────

  createBooth(roomId: string, initiatorId: string, shots: number) {
    return this.locked(async () => {
      const db = await this.readDb();
      for (const b of db.booths) {
        if (b.roomId === roomId && (b.status === "pending" || b.status === "live")) {
          b.status = "cancelled";
        }
      }
      const booth: BoothRecord = {
        id: randomUUID(),
        roomId,
        initiatorId,
        status: "pending",
        shots,
        readyIds: [initiatorId],
        startAt: null,
        stripPath: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      db.booths.push(booth);
      await this.writeDb(db);
      return booth;
    });
  }

  async getBooth(id: string): Promise<BoothRecord | null> {
    const db = await this.readDb();
    return db.booths.find((b) => b.id === id) ?? null;
  }

  async getActiveBooth(roomId: string): Promise<BoothRecord | null> {
    const db = await this.readDb();
    return (
      db.booths
        .filter(
          (b) =>
            b.roomId === roomId && (b.status === "pending" || b.status === "live")
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }

  async listBooths(roomId: string): Promise<BoothRecord[]> {
    const db = await this.readDb();
    return db.booths
      .filter((b) => b.roomId === roomId && b.status === "completed")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  readyBooth(
    boothId: string,
    participantId: string,
    requiredIds: string[],
    startDelayMs: number
  ) {
    return this.locked(async () => {
      const db = await this.readDb();
      const booth = db.booths.find((b) => b.id === boothId);
      if (!booth) return null;
      if (!booth.readyIds.includes(participantId)) booth.readyIds.push(participantId);
      const everyoneReady = requiredIds.every((id) => booth.readyIds.includes(id));
      if (everyoneReady && booth.startAt === null && booth.status === "pending") {
        booth.startAt = Date.now() + startDelayMs;
        booth.status = "live";
      }
      await this.writeDb(db);
      return booth;
    });
  }

  addBoothFrame(boothId: string, participantId: string, idx: number, filePath: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const existing = db.boothFrames.find(
        (f) => f.boothId === boothId && f.participantId === participantId && f.idx === idx
      );
      if (existing) {
        existing.path = filePath;
      } else {
        db.boothFrames.push({
          id: randomUUID(),
          boothId,
          participantId,
          idx,
          path: filePath,
          createdAt: new Date().toISOString(),
        });
      }
      await this.writeDb(db);
    });
  }

  async listBoothFrames(boothId: string): Promise<BoothFrameRecord[]> {
    const db = await this.readDb();
    return db.boothFrames
      .filter((f) => f.boothId === boothId)
      .sort((a, b) => a.idx - b.idx);
  }

  setBoothStrip(boothId: string, stripPath: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const booth = db.booths.find((b) => b.id === boothId);
      if (booth && booth.status !== "completed") {
        booth.stripPath = stripPath;
        booth.status = "completed";
        booth.completedAt = new Date().toISOString();
        await this.writeDb(db);
      }
    });
  }

  cancelBooth(boothId: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const booth = db.booths.find((b) => b.id === boothId);
      if (booth && (booth.status === "pending" || booth.status === "live")) {
        booth.status = "cancelled";
        await this.writeDb(db);
      }
    });
  }

  // ── Record player ──────────────────────────────────────────

  createTrack(data: NewTrack) {
    return this.locked(async () => {
      const db = await this.readDb();
      const track: TrackRecord = { ...data, createdAt: new Date().toISOString() };
      db.tracks.push(track);
      await this.writeDb(db);
      return track;
    });
  }

  async listTracks(roomId: string): Promise<TrackRecord[]> {
    const db = await this.readDb();
    return db.tracks
      .filter((t) => t.roomId === roomId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTrack(id: string): Promise<TrackRecord | null> {
    const db = await this.readDb();
    return db.tracks.find((t) => t.id === id) ?? null;
  }

  deleteTrack(id: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      db.tracks = db.tracks.filter((t) => t.id !== id);
      // A deleted track can't stay on air.
      db.playerStates = db.playerStates.filter((p) => p.trackId !== id);
      await this.writeDb(db);
    });
  }

  async getPlayerState(roomId: string): Promise<PlayerStateRecord | null> {
    const db = await this.readDb();
    return db.playerStates.find((p) => p.roomId === roomId) ?? null;
  }

  setPlayerState(roomId: string, trackId: string, participantId: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const state: PlayerStateRecord = {
        roomId,
        trackId,
        startedById: participantId,
        startedAt: new Date().toISOString(),
      };
      db.playerStates = db.playerStates.filter((p) => p.roomId !== roomId);
      db.playerStates.push(state);
      await this.writeDb(db);
      return state;
    });
  }

  clearPlayerState(roomId: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      db.playerStates = db.playerStates.filter((p) => p.roomId !== roomId);
      await this.writeDb(db);
    });
  }

  // ── Files ──────────────────────────────────────────────────

  async saveFile(filePath: string, data: Uint8Array): Promise<void> {
    const full = path.join(FILES_DIR, filePath);
    if (!full.startsWith(FILES_DIR)) throw new Error("Invalid path");
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async deleteFile(filePath: string): Promise<void> {
    const full = path.join(FILES_DIR, filePath);
    if (!full.startsWith(FILES_DIR)) throw new Error("Invalid path");
    await fs.rm(full, { force: true });
  }

  fileUrl(filePath: string): string {
    return `/api/files/${filePath}`;

  }

  // ── Game 3 · Know Me ───────────────────────────────────────

  createKnowMeRound(data: NewKnowMeRound) {
    return this.locked(async () => {
      const db = await this.readDb();
      const round: KnowMeRoundRecord = {
        ...data,
        status: "open",
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      db.knowmeRounds.push(round);
      await this.writeDb(db);
      return round;
    });
  }

  async listKnowMeRounds(roomId: string): Promise<KnowMeRoundRecord[]> {
    const db = await this.readDb();
    return db.knowmeRounds
      .filter((r) => r.roomId === roomId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getKnowMeRound(id: string): Promise<KnowMeRoundRecord | null> {
    const db = await this.readDb();
    return db.knowmeRounds.find((r) => r.id === id) ?? null;
  }

  upsertKnowMeAnswer(data: {
    roundId: string;
    participantId: string;
    answers: { truth: string; guess: string }[];
  }) {
    return this.locked(async () => {
      const db = await this.readDb();
      const existing = db.knowmeAnswers.find(
        (a) => a.roundId === data.roundId && a.participantId === data.participantId
      );
      if (existing) {
        existing.answers = data.answers;
        await this.writeDb(db);
        return existing;
      }
      const answer: KnowMeAnswerRecord = {
        id: randomUUID(),
        roundId: data.roundId,
        participantId: data.participantId,
        answers: data.answers,
        ratings: null,
        createdAt: new Date().toISOString(),
      };
      db.knowmeAnswers.push(answer);
      await this.writeDb(db);
      return answer;
    });
  }

  async listKnowMeAnswers(roundId: string): Promise<KnowMeAnswerRecord[]> {
    const db = await this.readDb();
    return db.knowmeAnswers
      .filter((a) => a.roundId === roundId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  saveKnowMeRatings(
    roundId: string,
    participantId: string,
    ratings: boolean[]
  ): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
      const answer = db.knowmeAnswers.find(
        (a) => a.roundId === roundId && a.participantId === participantId
      );
      if (!answer) throw new Error("Answer sheet not found");
      answer.ratings = ratings;
      await this.writeDb(db);
    });
  }

  setKnowMeStatus(id: string, status: KnowMeStatus, completedAt?: string): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
      const round = db.knowmeRounds.find((r) => r.id === id);
      if (round) {
        round.status = status;
        if (completedAt !== undefined) round.completedAt = completedAt;
        await this.writeDb(db);
      }
    });
  }

  // ── Game 4 · Where Am I ────────────────────────────────────

  createWhereAmIRound(data: NewWhereAmIRound) {
    return this.locked(async () => {
      const db = await this.readDb();
      const round: WhereAmIRoundRecord = {
        ...data,
        status: "waiting",
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      db.whereamiRounds.push(round);
      await this.writeDb(db);
      return round;
    });
  }

  async listWhereAmIRounds(roomId: string): Promise<WhereAmIRoundRecord[]> {
    const db = await this.readDb();
    return db.whereamiRounds
      .filter((r) => r.roomId === roomId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getWhereAmIRound(id: string): Promise<WhereAmIRoundRecord | null> {
    const db = await this.readDb();
    return db.whereamiRounds.find((r) => r.id === id) ?? null;
  }

  addWhereAmIGuess(data: NewWhereAmIGuess) {
    return this.locked(async () => {
      const db = await this.readDb();
      const guess: WhereAmIGuessRecord = {
        id: randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
      };
      db.whereamiGuesses.push(guess);
      await this.writeDb(db);
      return guess;
    });
  }

  async listWhereAmIGuesses(roundId: string): Promise<WhereAmIGuessRecord[]> {
    const db = await this.readDb();
    return db.whereamiGuesses
      .filter((g) => g.roundId === roundId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  setWhereAmIStatus(id: string, status: WhereAmIStatus, completedAt?: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const round = db.whereamiRounds.find((r) => r.id === id);
      if (round) {
        round.status = status;
        if (completedAt !== undefined) round.completedAt = completedAt;
        await this.writeDb(db);
      }
    });
  }
}

export { FILES_DIR };
