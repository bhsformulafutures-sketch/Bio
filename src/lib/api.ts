import type {
  AuthStateDTO,
  ChallengeDTO,
  RandomDTO,
  RoomSummaryDTO,
  SessionDTO,
  UserDTO,
} from "./types";

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

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  me: () => request<SessionDTO>("/api/me"),

  // ── Auth & profile ─────────────────────────────────────────
  authState: () => request<AuthStateDTO>("/api/auth/state"),

  requestCode: (phone: string) =>
    request<{ ok: true; devCode?: string }>("/api/auth/request-code", json({ phone })),

  verifyCode: (phone: string, code: string) =>
    request<AuthStateDTO>("/api/auth/verify", json({ phone, code })),

  getAvatars: () => request<{ avatars: string[] }>("/api/profile"),

  saveProfile: (name: string, avatar: string | null) =>
    request<{ user: UserDTO }>("/api/profile", json({ name, avatar })),

  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),

  // ── Rooms ──────────────────────────────────────────────────
  createRoom: () => request<SessionDTO>("/api/room", { method: "POST" }),

  joinRoom: (code: string) =>
    request<SessionDTO>("/api/room/join", json({ code })),

  listRooms: () => request<{ rooms: RoomSummaryDTO[] }>("/api/rooms"),

  switchRoom: (roomId: string) =>
    request<SessionDTO>("/api/rooms/active", json({ roomId })),

  deleteRoom: (roomId: string) =>
    request<{ ok: true; hasRooms: boolean }>(`/api/rooms/${roomId}`, {
      method: "DELETE",
    }),

  // ── Game 1 · Other Half ────────────────────────────────────
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

  // ── Game 2 · Random Challenge ──────────────────────────────
  listRandoms: () => request<{ randoms: RandomDTO[] }>("/api/randoms"),

  startRandom: () => request<{ random: RandomDTO }>("/api/randoms", { method: "POST" }),

  getRandom: (id: string) => request<{ random: RandomDTO }>(`/api/randoms/${id}`),

  submitRandom: (id: string, photo: Blob, width: number, height: number, caption: string) => {
    const form = new FormData();
    form.append("photo", photo, "photo.jpg");
    form.append("width", String(width));
    form.append("height", String(height));
    form.append("caption", caption);
    return request<{ random: RandomDTO }>(`/api/randoms/${id}/submit`, {
      method: "POST",
      body: form,
    });
  },
};
