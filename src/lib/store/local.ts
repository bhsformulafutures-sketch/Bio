import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { newRoomCode, newToken } from "../id";
import type {
  AlbumItemRecord,
  AlbumRecord,
  ChallengeRecord,
  JoinResult,
  MemoryKind,
  NewChallenge,
  NewRandom,
  NewRandomSubmission,
  ParticipantRecord,
  RandomRecord,
  RandomSubmissionRecord,
  RoomRecord,
  Store,
  UserRecord,
  VerificationRecord,
} from "./types";

interface Db {
  users: UserRecord[];
  verifications: VerificationRecord[];
  rooms: RoomRecord[];
  participants: ParticipantRecord[];
  challenges: ChallengeRecord[];
  randoms: RandomRecord[];
  randomSubmissions: RandomSubmissionRecord[];
  albums: AlbumRecord[];
  albumItems: AlbumItemRecord[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const FILES_DIR = path.join(DATA_DIR, "files");

const EMPTY_DB: Db = {
  users: [],
  verifications: [],
  rooms: [],
  participants: [],
  challenges: [],
  randoms: [],
  randomSubmissions: [],
  albums: [],
  albumItems: [],
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

  // ── Identity & email verification ──────────────────────────

  upsertVerification(email: string, codeHash: string, expiresAt: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const now = new Date().toISOString();
      const existing = db.verifications.find((v) => v.email === email);
      if (existing) {
        existing.codeHash = codeHash;
        existing.expiresAt = expiresAt;
        existing.attempts = 0;
        existing.createdAt = now;
      } else {
        db.verifications.push({ email, codeHash, expiresAt, attempts: 0, createdAt: now });
      }
      await this.writeDb(db);
    });
  }

  async getVerification(email: string): Promise<VerificationRecord | null> {
    const db = await this.readDb();
    return db.verifications.find((v) => v.email === email) ?? null;
  }

  incrementVerificationAttempts(email: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const v = db.verifications.find((x) => x.email === email);
      if (v) {
        v.attempts += 1;
        await this.writeDb(db);
      }
    });
  }

  deleteVerification(email: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      db.verifications = db.verifications.filter((v) => v.email !== email);
      await this.writeDb(db);
    });
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const db = await this.readDb();
    return db.users.find((u) => u.email === email) ?? null;
  }

  async getUserByToken(token: string): Promise<UserRecord | null> {
    const db = await this.readDb();
    return db.users.find((u) => u.token === token) ?? null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const db = await this.readDb();
    return db.users.find((u) => u.id === id) ?? null;
  }

  createUser(email: string, name: string, avatar: string | null) {
    return this.locked(async () => {
      const db = await this.readDb();
      const existing = db.users.find((u) => u.email === email);
      if (existing) return existing;
      const user: UserRecord = {
        id: randomUUID(),
        email,
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

  createRoom(userId: string, name: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      let code = newRoomCode();
      while (db.rooms.some((r) => r.code === code)) code = newRoomCode();
      const room: RoomRecord = {
        id: randomUUID(),
        code,
        createdAt: new Date().toISOString(),
      };
      const participant: ParticipantRecord = {
        id: randomUUID(),
        roomId: room.id,
        userId,
        name,
        token: newToken(),
        joinedAt: new Date().toISOString(),
      };
      db.rooms.push(room);
      db.participants.push(participant);
      await this.writeDb(db);
      return { room, participant };
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
      const participant: ParticipantRecord = {
        id: randomUUID(),
        roomId: room.id,
        userId,
        name,
        token: newToken(),
        joinedAt: new Date().toISOString(),
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

  deleteRoom(roomId: string): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
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

  async listAlbums(roomId: string): Promise<AlbumRecord[]> {
    const db = await this.readDb();
    return db.albums
      .filter((a) => a.roomId === roomId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getAlbum(id: string): Promise<AlbumRecord | null> {
    const db = await this.readDb();
    return db.albums.find((a) => a.id === id) ?? null;
  }

  createAlbum(roomId: string, name: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const album: AlbumRecord = {
        id: randomUUID(),
        roomId,
        name,
        createdAt: new Date().toISOString(),
      };
      db.albums.push(album);
      await this.writeDb(db);
      return album;
    });
  }

  renameAlbum(id: string, name: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const album = db.albums.find((a) => a.id === id);
      if (!album) return null;
      album.name = name;
      await this.writeDb(db);
      return album;
    });
  }

  deleteAlbum(id: string) {
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

  async listAlbumItemsForRoom(roomId: string): Promise<AlbumItemRecord[]> {
    const db = await this.readDb();
    const albumIds = new Set(
      db.albums.filter((a) => a.roomId === roomId).map((a) => a.id)
    );
    return db.albumItems.filter((i) => albumIds.has(i.albumId));
  }

  addAlbumItem(albumId: string, kind: MemoryKind, itemId: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      const exists = db.albumItems.some(
        (i) => i.albumId === albumId && i.kind === kind && i.itemId === itemId
      );
      if (!exists) {
        db.albumItems.push({
          albumId,
          kind,
          itemId,
          addedAt: new Date().toISOString(),
        });
        await this.writeDb(db);
      }
    });
  }

  removeAlbumItem(albumId: string, kind: MemoryKind, itemId: string) {
    return this.locked(async () => {
      const db = await this.readDb();
      db.albumItems = db.albumItems.filter(
        (i) => !(i.albumId === albumId && i.kind === kind && i.itemId === itemId)
      );
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

  fileUrl(filePath: string): string {
    return `/api/files/${filePath}`;
  }
}

export { FILES_DIR };
