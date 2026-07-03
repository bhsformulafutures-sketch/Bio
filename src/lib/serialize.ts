import type { AlbumDTO, ChallengeDTO, SessionDTO } from "./types";
import { getStore } from "./store";
import type { AlbumRecord, ChallengeRecord, SessionRecord } from "./store/types";

/** Shape an album for the client, given the ordered ids of its memories. */
export function albumToDTO(album: AlbumRecord, memoryIds: string[]): AlbumDTO {
  return {
    id: album.id,
    name: album.name,
    createdAt: album.createdAt,
    memoryIds,
    count: memoryIds.length,
  };
}

export function sessionToDTO(session: SessionRecord): SessionDTO {
  return {
    participant: { id: session.participant.id, name: session.participant.name },
    room: {
      id: session.room.id,
      code: session.room.code,
      createdAt: session.room.createdAt,
    },
    partner: session.partner
      ? { id: session.partner.id, name: session.partner.name }
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
    originalUrl:
      done || mine ? store.fileUrl(challenge.originalPath) : null,
    drawingUrl:
      done && challenge.drawingPath
        ? store.fileUrl(challenge.drawingPath)
        : null,
    mergedUrl:
      done && challenge.mergedPath
        ? store.fileUrl(challenge.mergedPath)
        : null,
  };
}
