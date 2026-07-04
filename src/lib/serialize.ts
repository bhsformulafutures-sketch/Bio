import type {
  AlbumDTO,
  ChallengeDTO,
  RandomDTO,
  RandomSubmissionDTO,
  SessionDTO,
  UserDTO,
} from "./types";
import { getStore } from "./store";
import type {
  AlbumItemRecord,
  AlbumRecord,
  ChallengeRecord,
  MemoryKind,
  RandomRecord,
  RandomSubmissionRecord,
  SessionRecord,
  UserRecord,
} from "./store/types";
import { emailHint } from "./auth/email";

/** Stable key for a memory across the two game types. */
export function memoryKey(kind: MemoryKind, id: string): string {
  return `${kind}:${id}`;
}

export function userToDTO(user: UserRecord): UserDTO {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    emailHint: emailHint(user.email),
  };
}

/**
 * Shape the session for the client. Async because it resolves the partner's
 * avatar (which lives on their user account, not their room membership).
 */
export async function sessionToDTO(session: SessionRecord): Promise<SessionDTO> {
  let partnerAvatar: string | null = null;
  if (session.partner?.userId) {
    const partnerUser = await getStore().getUserById(session.partner.userId);
    partnerAvatar = partnerUser?.avatar ?? null;
  }
  return {
    user: userToDTO(session.user),
    participant: { id: session.participant.id, name: session.participant.name },
    room: {
      id: session.room.id,
      code: session.room.code,
      createdAt: session.room.createdAt,
    },
    partner: session.partner
      ? { id: session.partner.id, name: session.partner.name, avatar: partnerAvatar }
      : null,
  };
}

/**
 * Shape a challenge for one viewer. While the challenge is still waiting,
 * the original photo URL is only exposed to its creator — the guesser
 * must not be able to peek at the answer.
 */
export function challengeToDTO(
  challenge: ChallengeRecord,
  session: SessionRecord
): ChallengeDTO {
  const store = getStore();
  const mine = challenge.creatorId === session.participant.id;
  const done = challenge.status === "completed";
  const nameOf = (id: string | null) => {
    if (!id) return null;
    if (id === session.participant.id)
      return { id, name: session.participant.name };
    if (session.partner && id === session.partner.id)
      return { id, name: session.partner.name };
    return { id, name: "Partner" };
  };

  return {
    id: challenge.id,
    status: challenge.status,
    hiddenSide: challenge.hiddenSide,
    hiddenRatio: challenge.hiddenRatio,
    width: challenge.width,
    height: challenge.height,
    createdAt: challenge.createdAt,
    completedAt: challenge.completedAt,
    creator: nameOf(challenge.creatorId)!,
    solver: nameOf(challenge.solverId),
    mine,
    visibleUrl: store.fileUrl(challenge.visiblePath),
    originalUrl: done || mine ? store.fileUrl(challenge.originalPath) : null,
    drawingUrl:
      done && challenge.drawingPath ? store.fileUrl(challenge.drawingPath) : null,
    mergedUrl:
      done && challenge.mergedPath ? store.fileUrl(challenge.mergedPath) : null,
  };
}

/**
 * Shape a Random Challenge for one viewer. The partner's photo stays hidden
 * until both people have answered (or the clock runs out) — same no-peeking
 * principle as Other Half, so the reveal is a shared surprise.
 */
export function randomToDTO(
  random: RandomRecord,
  submissions: RandomSubmissionRecord[],
  session: SessionRecord
): RandomDTO {
  const store = getStore();
  const nameOf = (participantId: string): { id: string; name: string } => {
    if (participantId === session.participant.id)
      return { id: participantId, name: session.participant.name };
    if (session.partner && participantId === session.partner.id)
      return { id: participantId, name: session.partner.name };
    return { id: participantId, name: "Partner" };
  };

  const mineSubmitted = submissions.some(
    (s) => s.participantId === session.participant.id
  );
  const partnerSubmitted = submissions.some(
    (s) => session.partner != null && s.participantId === session.partner.id
  );
  const bothIn = submissions.length >= 2;
  const revealPartner = random.status !== "open" || bothIn;

  const visible: RandomSubmissionDTO[] = submissions
    .filter((s) => {
      const mine = s.participantId === session.participant.id;
      return mine || revealPartner;
    })
    .map((s) => ({
      participant: nameOf(s.participantId),
      photoUrl: store.fileUrl(s.photoPath),
      width: s.width,
      height: s.height,
      caption: s.caption,
      createdAt: s.createdAt,
      mine: s.participantId === session.participant.id,
    }));

  return {
    id: random.id,
    prompt: random.prompt,
    category: random.category,
    status: random.status,
    expiresAt: random.expiresAt,
    createdAt: random.createdAt,
    completedAt: random.completedAt,
    starter: nameOf(random.starterId),
    mineSubmitted,
    partnerSubmitted,
    submissions: visible,
  };
}

/**
 * Compose the album cards for a room: name, memory count, and an auto cover
 * (the most-recently-added memory that resolves to an image). Loads the room's
 * memories once and only fetches submissions for the covers it actually needs.
 */
export async function albumsToDTO(roomId: string): Promise<AlbumDTO[]> {
  const store = getStore();
  const [albums, items, challenges, randoms] = await Promise.all([
    store.listAlbums(roomId),
    store.listAlbumItemsForRoom(roomId),
    store.listChallenges(roomId),
    store.listRandoms(roomId),
  ]);

  const challengeById = new Map(challenges.map((c) => [c.id, c]));
  const randomById = new Map(randoms.map((r) => [r.id, r]));

  // Group memberships by album, newest first.
  const byAlbum = new Map<string, AlbumItemRecord[]>();
  for (const it of items) {
    const list = byAlbum.get(it.albumId) ?? [];
    list.push(it);
    byAlbum.set(it.albumId, list);
  }
  for (const list of byAlbum.values()) {
    list.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }

  const coverFor = async (list: AlbumItemRecord[]): Promise<string | null> => {
    for (const it of list) {
      if (it.kind === "challenge") {
        const c = challengeById.get(it.itemId);
        if (c && c.status === "completed") {
          return store.fileUrl(c.mergedPath ?? c.visiblePath);
        }
      } else {
        const r = randomById.get(it.itemId);
        if (r) {
          const subs = await store.listRandomSubmissions(r.id);
          if (subs[0]) return store.fileUrl(subs[0].photoPath);
        }
      }
    }
    return null;
  };

  return Promise.all(
    albums.map(async (album): Promise<AlbumDTO> => {
      const list = byAlbum.get(album.id) ?? [];
      return {
        id: album.id,
        name: album.name,
        count: list.length,
        coverUrl: await coverFor(list),
        createdAt: album.createdAt,
        itemKeys: list.map((it) => memoryKey(it.kind, it.itemId)),
      };
    })
  );
}

/** Validate & normalise an album name (used by create/rename). */
export function normalizeAlbumName(raw: unknown): string {
  return String(raw ?? "").trim().slice(0, 40);
}

export function albumRecordToDTO(
  album: AlbumRecord,
  items: AlbumItemRecord[],
  coverUrl: string | null
): AlbumDTO {
  return {
    id: album.id,
    name: album.name,
    count: items.length,
    coverUrl,
    createdAt: album.createdAt,
    itemKeys: items.map((it) => memoryKey(it.kind, it.itemId)),
  };
}
