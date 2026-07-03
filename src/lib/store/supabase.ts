import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

const BUCKET = "photos";

/* Supabase rows are snake_case; the app speaks camelCase. */

interface RoomRow {
  id: string;
  code: string;
  created_at: string;
}
interface ParticipantRow {
  id: string;
  room_id: string;
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

interface AlbumRow {
  id: string;
  room_id: string;
  name: string;
  created_at: string;
}
interface AlbumMemoryRow {
  album_id: string;
  challenge_id: string;
  added_at: string;
}

const mapAlbum = (a: AlbumRow): AlbumRecord => ({
  id: a.id,
  roomId: a.room_id,
  name: a.name,
  createdAt: a.created_at,
});

const mapAlbumMemory = (m: AlbumMemoryRow): AlbumMemoryRecord => ({
  albumId: m.album_id,
  challengeId: m.challenge_id,
  addedAt: m.added_at,
});

const mapRoom = (r: RoomRow): RoomRecord => ({
  id: r.id,
  code: r.code,
  createdAt: r.created_at,
});

const mapParticipant = (p: ParticipantRow): ParticipantRecord => ({
  id: p.id,
  roomId: p.room_id,
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

export class SupabaseStore implements Store {
  private client: SupabaseClient;
  private baseUrl: string;

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
    this.baseUrl = url.replace(/\/$/, "");
  }

  async createRoom(name: string) {
    // Retry a couple of times on the (very unlikely) code collision.
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newRoomCode();
      const { data: room, error } = await this.client
        .from("rooms")
        .insert({ code })
        .select()
        .single<RoomRow>();
      if (error) {
        if (error.code === "23505") continue; // unique violation → new code
        throw new Error(error.message);
      }
      const participant = await this.insertParticipant(room.id, name);
      return { room: mapRoom(room), participant };
    }
    throw new Error("Could not allocate a room code");
  }

  private async insertParticipant(roomId: string, name: string) {
    const { data, error } = await this.client
      .from("participants")
      .insert({ room_id: roomId, name, token: newToken() })
      .select()
      .single<ParticipantRow>();
    if (error) throw new Error(error.message);
    return mapParticipant(data);
  }

  async joinRoom(code: string, name: string): Promise<JoinResult> {
    const { data: room, error } = await this.client
      .from("rooms")
      .select()
      .eq("code", code)
      .maybeSingle<RoomRow>();
    if (error) throw new Error(error.message);
    if (!room) return { ok: false, reason: "not_found" };

    const { count, error: countError } = await this.client
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) >= 2) return { ok: false, reason: "full" };

    const participant = await this.insertParticipant(room.id, name);
    return { ok: true, room: mapRoom(room), participant };
  }

  async getSessionByToken(token: string): Promise<SessionRecord | null> {
    const { data: p, error } = await this.client
      .from("participants")
      .select()
      .eq("token", token)
      .maybeSingle<ParticipantRow>();
    if (error) throw new Error(error.message);
    if (!p) return null;

    const [{ data: room }, { data: others }] = await Promise.all([
      this.client.from("rooms").select().eq("id", p.room_id).single<RoomRow>(),
      this.client
        .from("participants")
        .select()
        .eq("room_id", p.room_id)
        .neq("id", p.id),
    ]);
    if (!room) return null;
    const partner = (others as ParticipantRow[] | null)?.[0];
    return {
      participant: mapParticipant(p),
      room: mapRoom(room),
      partner: partner ? mapParticipant(partner) : null,
    };
  }

  async deleteRoom(roomId: string): Promise<void> {
    // Storage first: list each challenge folder under the room and remove
    // its files. Supabase Storage lists one folder level at a time.
    const prefix = `rooms/${roomId}`;
    const { data: folders } = await this.client.storage.from(BUCKET).list(prefix);
    const paths: string[] = [];
    for (const folder of folders ?? []) {
      const { data: files } = await this.client.storage
        .from(BUCKET)
        .list(`${prefix}/${folder.name}`);
      for (const file of files ?? []) {
        paths.push(`${prefix}/${folder.name}/${file.name}`);
      }
    }
    for (let i = 0; i < paths.length; i += 100) {
      await this.client.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    }

    // Rows: participants and challenges cascade from the room.
    const { error } = await this.client.from("rooms").delete().eq("id", roomId);
    if (error) throw new Error(error.message);
  }

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
    // The status filter makes this a compare-and-swap: a second submission
    // matches zero rows instead of overwriting the first.
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

  /* ---- Albums ---- */

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
      .order("created_at", { ascending: false });
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

  async renameAlbum(id: string, name: string): Promise<AlbumRecord | null> {
    const { data, error } = await this.client
      .from("albums")
      .update({ name })
      .eq("id", id)
      .select()
      .maybeSingle<AlbumRow>();
    if (error) throw new Error(error.message);
    return data ? mapAlbum(data) : null;
  }

  async deleteAlbum(id: string): Promise<void> {
    // album_memories rows cascade from the album.
    const { error } = await this.client.from("albums").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listAlbumMemories(roomId: string): Promise<AlbumMemoryRecord[]> {
    const { data: albums, error: albumErr } = await this.client
      .from("albums")
      .select("id")
      .eq("room_id", roomId);
    if (albumErr) throw new Error(albumErr.message);
    const ids = (albums as { id: string }[]).map((a) => a.id);
    if (ids.length === 0) return [];
    const { data, error } = await this.client
      .from("album_memories")
      .select()
      .in("album_id", ids);
    if (error) throw new Error(error.message);
    return (data as AlbumMemoryRow[]).map(mapAlbumMemory);
  }

  async addMemoryToAlbum(albumId: string, challengeId: string): Promise<void> {
    const { error } = await this.client
      .from("album_memories")
      .upsert(
        { album_id: albumId, challenge_id: challengeId },
        { onConflict: "album_id,challenge_id", ignoreDuplicates: true }
      );
    if (error) throw new Error(error.message);
  }

  async removeMemoryFromAlbum(
    albumId: string,
    challengeId: string
  ): Promise<void> {
    const { error } = await this.client
      .from("album_memories")
      .delete()
      .eq("album_id", albumId)
      .eq("challenge_id", challengeId);
    if (error) throw new Error(error.message);
  }

  async saveFile(
    path: string,
    data: Uint8Array,
    contentType: string
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(BUCKET)
      .upload(path, data, { contentType, upsert: true });
    if (error) throw new Error(error.message);
  }

  fileUrl(path: string): string {
    return `${this.baseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
  }
}
