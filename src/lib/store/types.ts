import type { ChallengeStatus, HiddenSide } from "../types";

export interface RoomRecord {
  id: string;
  code: string;
  createdAt: string;
}

export interface ParticipantRecord {
  id: string;
  roomId: string;
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

export interface SessionRecord {
  participant: ParticipantRecord;
  room: RoomRecord;
  partner: ParticipantRecord | null;
}

export type JoinResult =
  | { ok: true; room: RoomRecord; participant: ParticipantRecord }
  | { ok: false; reason: "not_found" | "full" };

/**
 * Persistence boundary. Two implementations:
 *  - SupabaseStore (production: Postgres + Storage)
 *  - LocalStore   (zero-config dev: JSON file + local blobs)
 */
export interface Store {
  createRoom(name: string): Promise<{ room: RoomRecord; participant: ParticipantRecord }>;
  joinRoom(code: string, name: string): Promise<JoinResult>;
  getSessionByToken(token: string): Promise<SessionRecord | null>;
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
  saveFile(path: string, data: Uint8Array, contentType: string): Promise<void>;
  fileUrl(path: string): string;
}
