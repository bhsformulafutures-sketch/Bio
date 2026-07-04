import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { newToken } from "../id";
import type { MemoryKind } from "../types";
import type {
  AlbumItemRecord,
  AlbumRecord,
  ChallengeRecord,
  CreateRoomResult,
  JoinResult,
  NewChallenge,
  NewRandom,
  NewRandomSubmission,
  ParticipantRecord,
  RandomRecord,
  RandomSubmissionRecord,
  RoomRecord,
  Store,
  UserRecord,
} from "./types";

const BUCKET = "photos";

/* Supabase rows are snake_case; the app speaks camelCase. */

interface UserRow {
  id: string;
  name: string;
  avatar: string | null;
  token: string;
  created_at: string;
}
interface RoomRow {
  id: string;
  code: string;
  created_at: string;
}
interface ParticipantRow {
  id: string;
  room_id: string;
  user_id: string | null;
  name: string;
  token: string;
  joined_at: string;
}
interface ChallengeRow {
  id: string;
  room_id: string;
  creator_id: string;
  solver_id: string | null;
  status: "waiting" | "completed";
  hidden_side: ChallengeRecord["hiddenSide"];
  hidden_ratio: number;
  width: number;
  height: number;
  original_path: string;
  visible_path: string;
  drawing_path: string | null;
  merged_path: string | null;
  created_at: string;
  completed_at: string | null;
}
interface RandomRow {
  id: string;
  room_id: string;
  starter_id: string;
  prompt: string;
  category: string;
  status: "open" | "completed" | "expired";
  expires_at: string;
  created_at: string;
  completed_at: string | null;
}
interface RandomSubmissionRow {
  id: string;
  random_id: string;
  participant_id: string;
  photo_path: string;
  width: number;
  height: number;
  caption: string | null;
  created_at: string;
}

interface AlbumRow {
  id: string;
  room_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}
interface AlbumItemRow {
  id: string;
  album_id: string;
  kind: MemoryKind;
  memory_id: string;
  added_at: string;
}

const mapAlbum = (a: AlbumRow): AlbumRecord => ({
  id: a.id,
  roomId: a.room_id,
  name: a.name,
  createdAt: a.created_at,
  updatedAt: a.updated_at,
});

const mapAlbumItem = (i: AlbumItemRow): AlbumItemRecord => ({
  id: i.id,
  albumId: i.album_id,
  kind: i.kind,
  memoryId: i.memory_id,
  addedAt: i.added_at,
});

const mapUser = (u: UserRow): UserRecord => ({
  id: u.id,
  name: u.name,
  avatar: u.avatar,
  token: u.token,
  createdAt: u.created_at,
});

const mapRoom = (r: RoomRow): RoomRecord => ({
  id: r.id,
  code: r.code,
  createdAt: r.created_at,
});

const mapParticipant = (p: ParticipantRow): ParticipantRecord => ({
  id: p.id,
  roomId: p.room_id,
  userId: p.user_id,
  name: p.name,
  token: p.token,
  joinedAt: p.joined_at,
});

const mapChallenge = (c: ChallengeRow): ChallengeRecord => ({
  id: c.id,
  roomId: c.room_id,
  creatorId: c.creator_id,
  solverId: c.solver_id,
  status: c.status,
  hiddenSide: c.hidden_side,
  hiddenRatio: c.hidden_ratio,
  width: c.width,
  height: c.height,
  originalPath: c.original_path,
  visiblePath: c.visible_path,
  drawingPath: c.drawing_path,
  mergedPath: c.merged_path,
  createdAt: c.created_at,
  completedAt: c.completed_at,
});

const mapRandom = (r: RandomRow): RandomRecord => ({
  id: r.id,
  roomId: r.room_id,
  starterId: r.starter_id,
  prompt: r.prompt,
  category: r.category,
  status: r.status,
  expiresAt: r.expires_at,
  createdAt: r.created_at,
  completedAt: r.completed_at,
});

const mapSubmission = (s: RandomSubmissionRow): RandomSubmissionRecord => ({
  id: s.id,
  randomId: s.random_id,
  participantId: s.participant_id,
  photoPath: s.photo_path,
  width: s.width,
  height: s.height,
  caption: s.caption,
  createdAt: s.created_at,
});

export class SupabaseStore implements Store {
  private client: SupabaseClient;
  private baseUrl: string;

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
    this.baseUrl = url.replace(/\/$/, "");
  }

  // ── Identity ───────────────────────────────────────────────

  async getUserByToken(token: string): Promise<UserRecord | null> {
    const { data, error } = await this.client
      .from("users")
      .select()
      .eq("token", token)
      .maybeSingle<UserRow>();
    if (error) throw new Error(error.message);
    return data ? mapUser(data) : null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const { data, error } = await this.client
      .from("users")
      .select()
      .eq("id", id)
      .maybeSingle<UserRow>();
    if (error) throw new Error(error.message);
    return data ? mapUser(data) : null;
  }

  async createUser(name: string, avatar: string | null): Promise<UserRecord> {
    const { data, error } = await this.client
      .from("users")
      .insert({ name, avatar, token: newToken() })
      .select()
      .single<UserRow>();
    if (error) throw new Error(error.message);
    return mapUser(data);
  }

  async updateUser(id: string, patch: { name?: string; avatar?: string | null }): Promise<UserRecord> {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.avatar !== undefined) update.avatar = patch.avatar;
    const { data, error } = await this.client
      .from("users")
      .update(update)
      .eq("id", id)
      .select()
      .single<UserRow>();
    if (error) throw new Error(error.message);
    if (patch.name !== undefined) {
      // Keep the person's name in sync across their memberships.
      await this.client.from("participants").update({ name: patch.name }).eq("user_id", id);
    }
    return mapUser(data);
  }

  // ── Rooms & membership ─────────────────────────────────────

  async createRoom(userId: string, name: string, code: string): Promise<CreateRoomResult> {
    const { data: room, error } = await this.client
      .from("rooms")
      .insert({ code })
      .select()
      .single<RoomRow>();
    if (error) {
      if (error.code === "23505") return { ok: false, reason: "taken" }; // code already used
      throw new Error(error.message);
    }
    const participant = await this.insertParticipant(room.id, userId, name);
    return { ok: true, room: mapRoom(room), participant };
  }

  private async insertParticipant(roomId: string, userId: string, name: string) {
    const { data, error } = await this.client
      .from("participants")
      .insert({ room_id: roomId, user_id: userId, name, token: newToken() })
      .select()
      .single<ParticipantRow>();
    if (error) throw new Error(error.message);
    return mapParticipant(data);
  }

  async joinRoom(code: string, userId: string, name: string): Promise<JoinResult> {
    const { data: room, error } = await this.client
      .from("rooms")
      .select()
      .eq("code", code)
      .maybeSingle<RoomRow>();
    if (error) throw new Error(error.message);
    if (!room) return { ok: false, reason: "not_found" };

    const { data: members, error: membersError } = await this.client
      .from("participants")
      .select()
      .eq("room_id", room.id);
    if (membersError) throw new Error(membersError.message);
    const rows = (members as ParticipantRow[]) ?? [];
    if (rows.some((p) => p.user_id === userId)) {
      return { ok: false, reason: "already_in" };
    }
    if (rows.length >= 2) return { ok: false, reason: "full" };

    const participant = await this.insertParticipant(room.id, userId, name);
    return { ok: true, room: mapRoom(room), participant };
  }

  async getRoom(roomId: string): Promise<RoomRecord | null> {
    const { data, error } = await this.client
      .from("rooms")
      .select()
      .eq("id", roomId)
      .maybeSingle<RoomRow>();
    if (error) throw new Error(error.message);
    return data ? mapRoom(data) : null;
  }

  async getRoomByCode(code: string): Promise<RoomRecord | null> {
    const { data, error } = await this.client
      .from("rooms")
      .select()
      .eq("code", code)
      .maybeSingle<RoomRow>();
    if (error) throw new Error(error.message);
    return data ? mapRoom(data) : null;
  }

  async getMembership(userId: string, roomId: string): Promise<ParticipantRecord | null> {
    const { data, error } = await this.client
      .from("participants")
      .select()
      .eq("user_id", userId)
      .eq("room_id", roomId)
      .maybeSingle<ParticipantRow>();
    if (error) throw new Error(error.message);
    return data ? mapParticipant(data) : null;
  }

  async listMemberships(userId: string): Promise<ParticipantRecord[]> {
    const { data, error } = await this.client
      .from("participants")
      .select()
      .eq("user_id", userId)
      .order("joined_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as ParticipantRow[]).map(mapParticipant);
  }

  async getRoomParticipants(roomId: string): Promise<ParticipantRecord[]> {
    const { data, error } = await this.client
      .from("participants")
      .select()
      .eq("room_id", roomId);
    if (error) throw new Error(error.message);
    return (data as ParticipantRow[]).map(mapParticipant);
  }

  async deleteRoom(roomId: string): Promise<void> {
    // Storage first: remove every file under the room's folder tree.
    await this.removeFolder(`rooms/${roomId}`);

    // Rows: participants, challenges, randoms and submissions cascade.
    const { error } = await this.client.from("rooms").delete().eq("id", roomId);
    if (error) throw new Error(error.message);
  }

  /** Recursively collect and remove every object under a storage prefix. */
  private async removeFolder(prefix: string): Promise<void> {
    const { data: entries } = await this.client.storage.from(BUCKET).list(prefix);
    const files: string[] = [];
    for (const entry of entries ?? []) {
      const child = `${prefix}/${entry.name}`;
      // Folders have no id; recurse. Files have an id and are removed directly.
      if (entry.id === null || entry.id === undefined) {
        await this.removeFolder(child);
      } else {
        files.push(child);
      }
    }
    for (let i = 0; i < files.length; i += 100) {
      await this.client.storage.from(BUCKET).remove(files.slice(i, i + 100));
    }
  }

  // ── Game 1 · Other Half ────────────────────────────────────

  async createChallenge(data: NewChallenge): Promise<ChallengeRecord> {
    const { data: row, error } = await this.client
      .from("challenges")
      .insert({
        id: data.id,
        room_id: data.roomId,
        creator_id: data.creatorId,
        hidden_side: data.hiddenSide,
        hidden_ratio: data.hiddenRatio,
        width: data.width,
        height: data.height,
        original_path: data.originalPath,
        visible_path: data.visiblePath,
      })
      .select()
      .single<ChallengeRow>();
    if (error) throw new Error(error.message);
    return mapChallenge(row);
  }

  async listChallenges(roomId: string): Promise<ChallengeRecord[]> {
    const { data, error } = await this.client
      .from("challenges")
      .select()
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as ChallengeRow[]).map(mapChallenge);
  }

  async getChallenge(id: string): Promise<ChallengeRecord | null> {
    const { data, error } = await this.client
      .from("challenges")
      .select()
      .eq("id", id)
      .maybeSingle<ChallengeRow>();
    if (error) throw new Error(error.message);
    return data ? mapChallenge(data) : null;
  }

  async completeChallenge(id: string, solverId: string, drawingPath: string) {
    const { data, error } = await this.client
      .from("challenges")
      .update({
        status: "completed",
        solver_id: solverId,
        drawing_path: drawingPath,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "waiting")
      .select()
      .maybeSingle<ChallengeRow>();
    if (error) throw new Error(error.message);
    if (data) return mapChallenge(data);
    const existing = await this.getChallenge(id);
    return existing ? ("conflict" as const) : null;
  }

  async setMergedPath(id: string, mergedPath: string): Promise<void> {
    const { error } = await this.client
      .from("challenges")
      .update({ merged_path: mergedPath })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  // ── Game 2 · Random Challenge ──────────────────────────────

  async createRandom(data: NewRandom): Promise<RandomRecord> {
    const { data: row, error } = await this.client
      .from("randoms")
      .insert({
        id: data.id,
        room_id: data.roomId,
        starter_id: data.starterId,
        prompt: data.prompt,
        category: data.category,
        expires_at: data.expiresAt,
      })
      .select()
      .single<RandomRow>();
    if (error) throw new Error(error.message);
    return mapRandom(row);
  }

  async listRandoms(roomId: string): Promise<RandomRecord[]> {
    const { data, error } = await this.client
      .from("randoms")
      .select()
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as RandomRow[]).map(mapRandom);
  }

  async getRandom(id: string): Promise<RandomRecord | null> {
    const { data, error } = await this.client
      .from("randoms")
      .select()
      .eq("id", id)
      .maybeSingle<RandomRow>();
    if (error) throw new Error(error.message);
    return data ? mapRandom(data) : null;
  }

  async addRandomSubmission(data: NewRandomSubmission): Promise<RandomSubmissionRecord> {
    const { data: row, error } = await this.client
      .from("random_submissions")
      .upsert(
        {
          random_id: data.randomId,
          participant_id: data.participantId,
          photo_path: data.photoPath,
          width: data.width,
          height: data.height,
          caption: data.caption,
        },
        { onConflict: "random_id,participant_id" }
      )
      .select()
      .single<RandomSubmissionRow>();
    if (error) throw new Error(error.message);
    return mapSubmission(row);
  }

  async listRandomSubmissions(randomId: string): Promise<RandomSubmissionRecord[]> {
    const { data, error } = await this.client
      .from("random_submissions")
      .select()
      .eq("random_id", randomId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as RandomSubmissionRow[]).map(mapSubmission);
  }

  async markRandomCompleted(id: string): Promise<void> {
    const { error } = await this.client
      .from("randoms")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "open");
    if (error) throw new Error(error.message);
  }

  async markRandomExpired(id: string): Promise<void> {
    const { error } = await this.client
      .from("randoms")
      .update({ status: "expired" })
      .eq("id", id)
      .eq("status", "open");
    if (error) throw new Error(error.message);
  }

  // ── Albums ─────────────────────────────────────────────────

  async createAlbum(roomId: string, name: string): Promise<AlbumRecord> {
    const { data, error } = await this.client
      .from("albums")
      .insert({ room_id: roomId, name })
      .select()
      .single<AlbumRow>();
    if (error) throw new Error(error.message);
    return mapAlbum(data);
  }

  async listAlbums(roomId: string): Promise<AlbumRecord[]> {
    const { data, error } = await this.client
      .from("albums")
      .select()
      .eq("room_id", roomId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as AlbumRow[]).map(mapAlbum);
  }

  async getAlbum(id: string): Promise<AlbumRecord | null> {
    const { data, error } = await this.client
      .from("albums")
      .select()
      .eq("id", id)
      .maybeSingle<AlbumRow>();
    if (error) throw new Error(error.message);
    return data ? mapAlbum(data) : null;
  }

  async renameAlbum(id: string, name: string): Promise<AlbumRecord> {
    const { data, error } = await this.client
      .from("albums")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single<AlbumRow>();
    if (error) throw new Error(error.message);
    return mapAlbum(data);
  }

  async deleteAlbum(id: string): Promise<void> {
    // album_items cascade via FK.
    const { error } = await this.client.from("albums").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listAlbumItems(albumId: string): Promise<AlbumItemRecord[]> {
    const { data, error } = await this.client
      .from("album_items")
      .select()
      .eq("album_id", albumId)
      .order("added_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as AlbumItemRow[]).map(mapAlbumItem);
  }

  async albumIdsForMemory(
    roomId: string,
    kind: MemoryKind,
    memoryId: string
  ): Promise<string[]> {
    const { data, error } = await this.client
      .from("album_items")
      .select("album_id, albums!inner(room_id)")
      .eq("kind", kind)
      .eq("memory_id", memoryId)
      .eq("albums.room_id", roomId);
    if (error) throw new Error(error.message);
    return ((data as { album_id: string }[]) ?? []).map((r) => r.album_id);
  }

  async addAlbumItem(
    albumId: string,
    kind: MemoryKind,
    memoryId: string
  ): Promise<AlbumItemRecord> {
    const { data, error } = await this.client
      .from("album_items")
      .upsert(
        { album_id: albumId, kind, memory_id: memoryId },
        { onConflict: "album_id,kind,memory_id" }
      )
      .select()
      .single<AlbumItemRow>();
    if (error) throw new Error(error.message);
    await this.touchAlbum(albumId);
    return mapAlbumItem(data);
  }

  async removeAlbumItem(
    albumId: string,
    kind: MemoryKind,
    memoryId: string
  ): Promise<void> {
    const { error } = await this.client
      .from("album_items")
      .delete()
      .eq("album_id", albumId)
      .eq("kind", kind)
      .eq("memory_id", memoryId);
    if (error) throw new Error(error.message);
    await this.touchAlbum(albumId);
  }

  private async touchAlbum(albumId: string): Promise<void> {
    await this.client
      .from("albums")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", albumId);
  }

  // ── Files ──────────────────────────────────────────────────

  async saveFile(path: string, data: Uint8Array, contentType: string): Promise<void> {
    const { error } = await this.client.storage
      .from(BUCKET)
      .upload(path, data, { contentType, upsert: true });
    if (error) throw new Error(error.message);
  }

  fileUrl(path: string): string {
    return `${this.baseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
  }
}
