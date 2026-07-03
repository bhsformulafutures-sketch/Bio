import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { newRoomCode, newToken } from "../id";
import type {
  AlbumMemoryRecord,
  AlbumRecord,
  ChallengeRecord,
  JoinResult,
  NewChallenge,
  ParticipantRecord,
  RoomRecord,
  SessionRecord,
  Store,
} from "./types";

interface Db {
  rooms: RoomRecord[];
  participants: ParticipantRecord[];
  challenges: ChallengeRecord[];
  albums?: AlbumRecord[];
  albumMemories?: AlbumMemoryRecord[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const FILES_DIR = path.join(DATA_DIR, "files");

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

  private async readDb(): Promise<Required<Db>> {
    let db: Db;
    try {
      db = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Db;
    } catch {
      db = { rooms: [], participants: [], challenges: [] };
    }
    return {
      rooms: db.rooms ?? [],
      participants: db.participants ?? [],
      challenges: db.challenges ?? [],
      albums: db.albums ?? [],
      albumMemories: db.albumMemories ?? [],
    };
  }

  private async writeDb(db: Db): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
  }

  createRoom(name: string) {
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

  joinRoom(code: string, name: string): Promise<JoinResult> {
    return this.locked(async () => {
      const db = await this.readDb();
      const room = db.rooms.find((r) => r.code === code);
      if (!room) return { ok: false as const, reason: "not_found" as const };
      const members = db.participants.filter((p) => p.roomId === room.id);
      if (members.length >= 2) return { ok: false as const, reason: "full" as const };
      const participant: ParticipantRecord = {
        id: randomUUID(),
        roomId: room.id,
        name,
        token: newToken(),
        joinedAt: new Date().toISOString(),
      };
      db.participants.push(participant);
      await this.writeDb(db);
      return { ok: true as const, room, participant };
    });
  }

  async getSessionByToken(token: string): Promise<SessionRecord | null> {
    const db = await this.readDb();
    const participant = db.participants.find((p) => p.token === token);
    if (!participant) return null;
    const room = db.rooms.find((r) => r.id === participant.roomId);
    if (!room) return null;
    const partner =
      db.participants.find(
        (p) => p.roomId === room.id && p.id !== participant.id
      ) ?? null;
    return { participant, room, partner };
  }

  deleteRoom(roomId: string): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
      const albumIds = new Set(
        db.albums.filter((a) => a.roomId === roomId).map((a) => a.id)
      );
      db.rooms = db.rooms.filter((r) => r.id !== roomId);
      db.participants = db.participants.filter((p) => p.roomId !== roomId);
      db.challenges = db.challenges.filter((c) => c.roomId !== roomId);
      db.albums = db.albums.filter((a) => a.roomId !== roomId);
      db.albumMemories = db.albumMemories.filter((m) => !albumIds.has(m.albumId));
      await this.writeDb(db);
      await fs.rm(path.join(FILES_DIR, "rooms", roomId), {
        recursive: true,
        force: true,
      });
    });
  }

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

  /* ---- Albums ---- */

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

  deleteAlbum(id: string): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
      db.albums = db.albums.filter((a) => a.id !== id);
      db.albumMemories = db.albumMemories.filter((m) => m.albumId !== id);
      await this.writeDb(db);
    });
  }

  async listAlbumMemories(roomId: string): Promise<AlbumMemoryRecord[]> {
    const db = await this.readDb();
    const albumIds = new Set(
      db.albums.filter((a) => a.roomId === roomId).map((a) => a.id)
    );
    return db.albumMemories.filter((m) => albumIds.has(m.albumId));
  }

  addMemoryToAlbum(albumId: string, challengeId: string): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
      const exists = db.albumMemories.some(
        (m) => m.albumId === albumId && m.challengeId === challengeId
      );
      if (!exists) {
        db.albumMemories.push({
          albumId,
          challengeId,
          addedAt: new Date().toISOString(),
        });
        await this.writeDb(db);
      }
    });
  }

  removeMemoryFromAlbum(albumId: string, challengeId: string): Promise<void> {
    return this.locked(async () => {
      const db = await this.readDb();
      db.albumMemories = db.albumMemories.filter(
        (m) => !(m.albumId === albumId && m.challengeId === challengeId)
      );
      await this.writeDb(db);
    });
  }

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
