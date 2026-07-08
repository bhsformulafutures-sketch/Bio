import type {
  AlbumDetailDTO,
  AlbumMemoryDTO,
  AlbumSummaryDTO,
  ChallengeDTO,
  RandomDTO,
  RandomSubmissionDTO,
  SessionDTO,
  UserDTO,
  WhereAmIGuessDTO,
  WhereAmIRoundDTO,
} from "./types";
import { getStore } from "./store";
import type {
  AlbumItemRecord,
  AlbumRecord,
  ChallengeRecord,
  RandomRecord,
  RandomSubmissionRecord,
  SessionRecord,
  UserRecord,
  WhereAmIGuessRecord,
  WhereAmIRoundRecord,
} from "./store/types";
export function userToDTO(user: UserRecord): UserDTO {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
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

/** Cover image for a memory DTO — mirrors the gallery cards' preview logic. */
type Cover = { url: string; width: number | null; height: number | null };

function challengeCover(c: ChallengeDTO): Cover {
  return { url: c.mergedUrl ?? c.visibleUrl, width: c.width, height: c.height };
}
function randomCover(r: RandomDTO): Cover | null {
  const first = r.submissions[0];
  if (!first) return null;
  return { url: first.photoUrl, width: first.width, height: first.height };
}

/**
 * Compose album DTOs. The caller resolves the room's memories once and passes
 * them in as lookup maps, so listing many albums stays a single pass.
 */
export function albumSummaryToDTO(
  album: AlbumRecord,
  items: AlbumItemRecord[],
  challengeById: Map<string, ChallengeDTO>,
  randomById: Map<string, RandomDTO>
): AlbumSummaryDTO {
  // Items arrive newest-first; the cover is the newest one that still resolves.
  let cover: Cover | null = null;
  let count = 0;
  for (const item of items) {
    const resolved =
      item.kind === "challenge"
        ? challengeById.get(item.memoryId)
          ? challengeCover(challengeById.get(item.memoryId)!)
          : null
        : randomById.get(item.memoryId)
          ? randomCover(randomById.get(item.memoryId)!)
          : null;
    if (item.kind === "challenge" ? challengeById.has(item.memoryId) : randomById.has(item.memoryId)) {
      count++;
      if (!cover && resolved) cover = resolved;
    }
  }
  return {
    id: album.id,
    name: album.name,
    count,
    coverUrl: cover?.url ?? null,
    coverWidth: cover?.width ?? null,
    coverHeight: cover?.height ?? null,
    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
  };
}

/**
 * Resolve every finished memory in the viewer's room into lookup maps keyed by
 * id — completed challenges and settled randoms only (those are what can be
 * filed into an album). Album composition builds on these.
 */
export async function loadRoomMemoryMaps(
  session: SessionRecord
): Promise<{ challengeById: Map<string, ChallengeDTO>; randomById: Map<string, RandomDTO> }> {
  const store = getStore();
  const [challenges, randoms] = await Promise.all([
    store.listChallenges(session.room.id),
    store.listRandoms(session.room.id),
  ]);
  const challengeById = new Map<string, ChallengeDTO>();
  for (const c of challenges) {
    if (c.status === "completed") challengeById.set(c.id, challengeToDTO(c, session));
  }
  const randomById = new Map<string, RandomDTO>();
  await Promise.all(
    randoms
      .filter((r) => r.status !== "open")
      .map(async (r) => {
        const subs = await store.listRandomSubmissions(r.id);
        randomById.set(r.id, randomToDTO(r, subs, session));
      })
  );
  return { challengeById, randomById };
}

export function albumDetailToDTO(
  album: AlbumRecord,
  items: AlbumItemRecord[],
  challengeById: Map<string, ChallengeDTO>,
  randomById: Map<string, RandomDTO>
): AlbumDetailDTO {
  const summary = albumSummaryToDTO(album, items, challengeById, randomById);
  const memories: AlbumMemoryDTO[] = [];
  for (const item of items) {
    if (item.kind === "challenge") {
      const challenge = challengeById.get(item.memoryId);
      if (challenge)
        memories.push({ kind: "challenge", id: item.memoryId, addedAt: item.addedAt, challenge, random: null });
    } else {
      const random = randomById.get(item.memoryId);
      if (random)
        memories.push({ kind: "random", id: item.memoryId, addedAt: item.addedAt, challenge: null, random });
    }
  }
  return { ...summary, memories };
}

// ── Game 4 · Where Am I ──────────────────────────────────────

/** Total attempts a guesser gets before the answer is revealed. */
export const WHEREAMI_MAX_GUESSES = 4;

/**
 * Shape a Where Am I round for one viewer. The creator sees everything —
 * answer, all three hints, the live guess log. The guesser only ever
 * receives what they've earned: one hint per wrong guess, and the answer
 * strictly after the round has finished. No peeking via the network tab.
 */
export function whereAmIToDTO(
  round: WhereAmIRoundRecord,
  guesses: WhereAmIGuessRecord[],
  session: SessionRecord
): WhereAmIRoundDTO {
  const store = getStore();
  const mine = round.creatorId === session.participant.id;
  const finished = round.status !== "waiting";
  const wrongCount = guesses.filter((g) => !g.correct).length;

  const creator =
    round.creatorId === session.participant.id
      ? { id: round.creatorId, name: session.participant.name }
      : session.partner && round.creatorId === session.partner.id
        ? { id: round.creatorId, name: session.partner.name }
        : { id: round.creatorId, name: "Partner" };

  const guessLog: WhereAmIGuessDTO[] = guesses.map((g) => ({
    id: g.id,
    text: g.text,
    correct: g.correct,
    mine: g.participantId === session.participant.id,
    createdAt: g.createdAt,
  }));

  // Hints: creator sees all; once the round ends everything is on the table;
  // mid-round the guesser gets exactly one per wrong guess.
  const unlockedHints =
    mine || finished
      ? round.hints
      : round.hints.slice(0, Math.min(wrongCount, round.hints.length));

  // Hearts: 4 minus the wrong guesses it took — never below 1 when solved,
  // a flat 0 when the guesser ran out of tries.
  const hearts =
    round.status === "solved"
      ? Math.max(1, WHEREAMI_MAX_GUESSES - wrongCount)
      : round.status === "revealed"
        ? 0
        : null;

  return {
    id: round.id,
    status: round.status,
    createdAt: round.createdAt,
    completedAt: round.completedAt,
    creator,
    mine,
    photoUrl: store.fileUrl(round.photoPath),
    width: round.width,
    height: round.height,
    unlockedHints,
    guesses: guessLog,
    guessesLeft: Math.max(0, WHEREAMI_MAX_GUESSES - guesses.length),
    hearts,
    answer: mine || finished ? round.answer : null,
  };
}
