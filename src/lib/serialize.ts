import type {
  ChallengeDTO,
  RandomDTO,
  RandomSubmissionDTO,
  SessionDTO,
  UserDTO,
} from "./types";
import { getStore } from "./store";
import type {
  ChallengeRecord,
  RandomRecord,
  RandomSubmissionRecord,
  SessionRecord,
  UserRecord,
} from "./store/types";
import { emailHint } from "./auth/email";

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
