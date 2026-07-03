import type { AlbumDTO, ChallengeDTO, RoomSummaryDTO, SessionDTO } from "./types";

export class ApiError extends Error {
  status: number;
  challenge?: ChallengeDTO;
  constructor(message: string, status: number, challenge?: ChallengeDTO) {
    super(message);
    this.status = status;
    this.challenge = challenge;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError("You seem to be offline. Check your connection.", 0);
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* non-JSON error body */
  }
  if (!response.ok) {
    const data = body as { error?: string; challenge?: ChallengeDTO } | null;
    throw new ApiError(
      data?.error ?? "Something went wrong. Please try again.",
      response.status,
      data?.challenge
    );
  }
  return body as T;
}

export const api = {
  me: () => request<SessionDTO>("/api/me"),

  createRoom: (name: string) =>
    request<SessionDTO>("/api/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),

  joinRoom: (code: string, name: string) =>
    request<SessionDTO>("/api/room/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name }),
    }),

  listRooms: () => request<{ rooms: RoomSummaryDTO[] }>("/api/rooms"),

  switchRoom: (roomId: string) =>
    request<SessionDTO>("/api/rooms/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    }),

  deleteRoom: (roomId: string) =>
    request<{ ok: true; hasRooms: boolean }>(`/api/rooms/${roomId}`, {
      method: "DELETE",
    }),

  listChallenges: () =>
    request<{ challenges: ChallengeDTO[] }>("/api/challenges"),

  getChallenge: (id: string) =>
    request<{ challenge: ChallengeDTO }>(`/api/challenges/${id}`),

  createChallenge: (form: FormData) =>
    request<{ challenge: ChallengeDTO }>("/api/challenges", {
      method: "POST",
      body: form,
    }),

  completeChallenge: (id: string, drawing: Blob) => {
    const form = new FormData();
    form.append("drawing", drawing, "drawing.png");
    return request<{ challenge: ChallengeDTO }>(
      `/api/challenges/${id}/complete`,
      { method: "POST", body: form }
    );
  },

  saveMerged: (id: string, merged: Blob) => {
    const form = new FormData();
    form.append("merged", merged, "merged.jpg");
    return request<{ challenge?: ChallengeDTO }>(
      `/api/challenges/${id}/merged`,
      { method: "POST", body: form }
    );
  },

  /* ---- Albums ---- */

  listAlbums: () => request<{ albums: AlbumDTO[] }>("/api/albums"),

  createAlbum: (name: string) =>
    request<{ album: AlbumDTO }>("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),

  renameAlbum: (id: string, name: string) =>
    request<{ album: AlbumDTO }>(`/api/albums/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),

  deleteAlbum: (id: string) =>
    request<{ ok: true }>(`/api/albums/${id}`, { method: "DELETE" }),

  addToAlbum: (albumId: string, challengeId: string) =>
    request<{ ok: true }>(`/api/albums/${albumId}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId }),
    }),

  removeFromAlbum: (albumId: string, challengeId: string) =>
    request<{ ok: true }>(`/api/albums/${albumId}/memories`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId }),
    }),
};
