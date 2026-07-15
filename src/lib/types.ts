export type HiddenSide = "left" | "right" | "top" | "bottom";
export type ChallengeStatus = "waiting" | "completed";
export type RandomStatus = "open" | "completed" | "expired";
/** A memory is one finished game — either an Other Half or a Random Challenge. */
export type MemoryKind = "challenge" | "random";

/** The signed-in person's profile. Identity is a device token — no email. */
export interface UserDTO {
  id: string;
  name: string;
  avatar: string | null;
}

/** What the client knows about the signed-in pair, inside a room. */
export interface SessionDTO {
  user: UserDTO;
  participant: { id: string; name: string };
  room: { id: string; code: string; createdAt: string };
  partner: { id: string; name: string; avatar: string | null } | null;
  /** True when the partner has been active within the presence window. */
  partnerOnline: boolean;
  /** True when the partner is online and has a track on air right now. */
  partnerOnAir: boolean;
}

export type BoothStatus = "pending" | "live" | "completed" | "cancelled";

export interface BoothFrameDTO {
  participantId: string;
  idx: number;
  url: string;
}

/** A photobooth session as one participant sees it. */
export interface BoothDTO {
  id: string;
  status: BoothStatus;
  shots: number;
  startAt: number | null;
  initiatorId: string;
  /** true when the viewer started this booth */
  mine: boolean;
  readyIds: string[];
  stripUrl: string | null;
  frames: BoothFrameDTO[];
  createdAt: string;
  completedAt: string | null;
}

export type TrackKind = "queue" | "dedication";

/** The room's shared "on air" state — what's playing and who started it. */
export interface PlayerDTO {
  track: TrackDTO;
  startedAt: string;
  startedByName: string;
  fromMe: boolean;
}

/** A song on the room radio, or a dedication with lyric + note. */
export interface TrackDTO {
  id: string;
  kind: TrackKind;
  title: string;
  artist: string | null;
  url: string;
  provider: string;
  embedUrl: string | null;
  lyric: string | null;
  noteUrl: string | null;
  fromMe: boolean;
  addedByName: string;
  createdAt: string;
}

/** Onboarding state — drives which step the client shows. */
export interface AuthStateDTO {
  authenticated: boolean;
  user: UserDTO | null;
  hasRoom: boolean;
  needsProfile: boolean;
}

/** A challenge as seen by one particular viewer. URLs are withheld
 *  until the viewer is allowed to see them (no peeking at the answer). */
export interface ChallengeDTO {
  id: string;
  status: ChallengeStatus;
  hiddenSide: HiddenSide;
  hiddenRatio: number;
  width: number;
  height: number;
  createdAt: string;
  completedAt: string | null;
  creator: { id: string; name: string };
  solver: { id: string; name: string } | null;
  /** true when the viewer created this challenge */
  mine: boolean;
  visibleUrl: string;
  originalUrl: string | null;
  drawingUrl: string | null;
  mergedUrl: string | null;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Tool = "pencil" | "eraser";

/** One brush stroke, coordinates and size normalized to image dimensions
 *  so drafts survive any resize or resolution change. */
export interface Stroke {
  tool: Tool;
  color: string;
  /** brush diameter as a fraction of image width */
  size: number;
  /** flat [x0, y0, x1, y1, ...] pairs normalized to 0..1 */
  points: number[];
}

/** A photo the solver drops into the hidden region as (part of) their answer. */
export interface PhotoFill {
  kind: "photo";
  /** JPEG data URL already cover-cropped to the hidden region's aspect ratio */
  dataUrl: string;
}

/** One undoable step of an answer: a brush stroke or a photo fill.
 *  Old drafts stored bare Strokes, so `kind` is absent on strokes. */
export type DrawAction = (Stroke & { kind?: "stroke" }) | PhotoFill;

export function isPhotoFill(action: DrawAction): action is PhotoFill {
  return (action as PhotoFill).kind === "photo";
}

/** One room a browser belongs to (for the room switcher). */
export interface RoomSummaryDTO {
  id: string;
  code: string;
  createdAt: string;
  myName: string;
  partnerName: string | null;
  active: boolean;
}

/** A shared album as shown in the strip on the home screen. */
export interface AlbumSummaryDTO {
  id: string;
  name: string;
  /** How many memories are filed inside. */
  count: number;
  /** Preview image of the most-recent memory, or null when empty. */
  coverUrl: string | null;
  /** Aspect ratio of the cover (falls back to 4/3 when unknown). */
  coverWidth: number | null;
  coverHeight: number | null;
  createdAt: string;
  updatedAt: string;
}

/** One memory inside an album — carries whichever game DTO it wraps. */
export interface AlbumMemoryDTO {
  kind: MemoryKind;
  id: string;
  addedAt: string;
  challenge: ChallengeDTO | null;
  random: RandomDTO | null;
}

/** Full album view: its meta plus every memory inside, newest first. */
export interface AlbumDetailDTO extends AlbumSummaryDTO {
  memories: AlbumMemoryDTO[];
}

/** One person's photo answer to a Random Challenge. */
export interface RandomSubmissionDTO {
  participant: { id: string; name: string };
  photoUrl: string;
  width: number;
  height: number;
  caption: string | null;
  createdAt: string;
  mine: boolean;
}

/** A Random Challenge as seen by one viewer. The partner's photo is
 *  withheld until both people have answered — no peeking early. */
export interface RandomDTO {
  id: string;
  prompt: string;
  category: string;
  status: RandomStatus;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
  starter: { id: string; name: string };
  /** true once the viewer has submitted their own photo */
  mineSubmitted: boolean;
  /** true once the partner has submitted (photo may still be hidden) */
  partnerSubmitted: boolean;
  /** submissions the viewer is allowed to see (own always; partner's once both in) */
  submissions: RandomSubmissionDTO[];
}

// ── Game 4 · Where Am I ──────────────────────────────────────

export type WhereAmIStatus = "waiting" | "solved" | "revealed";

/** One typed guess in a Where Am I round's log. */
export interface WhereAmIGuessDTO {
  id: string;
  text: string;
  correct: boolean;
  /** true when the viewer typed this guess */
  mine: boolean;
  createdAt: string;
}

/** A Where Am I round as seen by one viewer. The answer and any hints the
 *  guesser hasn't earned yet are stripped server-side — no peeking. */
export interface WhereAmIRoundDTO {
  id: string;
  status: WhereAmIStatus;
  createdAt: string;
  completedAt: string | null;
  creator: { id: string; name: string };
  /** true when the viewer created this round */
  mine: boolean;
  photoUrl: string;
  width: number;
  height: number;
  /** hints the viewer may see (creator: all; guesser: one per wrong guess) */
  unlockedHints: string[];
  /** full guess log, oldest first */
  guesses: WhereAmIGuessDTO[];
  /** attempts remaining out of 4 */
  guessesLeft: number;
  /** hearts earned — null until the round finishes */
  hearts: number | null;
  /** the secret place — null until finished (creator always sees it) */
  answer: string | null;
}

// ── Game 3 · Know Me ─────────────────────────────────────────

export type KnowMeStatus = "open" | "answered" | "completed";

/** One question's pair of short answers: your truth + your guess about them. */
export interface KnowMeAnswerPair {
  truth: string;
  guess: string;
}

/**
 * A Know Me round as seen by one viewer. The partner's truths and guesses are
 * withheld until BOTH sheets are in (status ≥ "answered") — no peeking, so
 * the side-by-side reveal is a shared surprise. Ratings are each player's
 * verdicts on the PARTNER's guesses about them, which means your score is
 * awarded by your partner and vice versa.
 */
export interface KnowMeRoundDTO {
  id: string;
  status: KnowMeStatus;
  questions: string[];
  createdAt: string;
  completedAt: string | null;
  starter: { id: string; name: string };
  /** true once the viewer has submitted their own sheet */
  mineSubmitted: boolean;
  /** true once the partner has submitted (their text may still be hidden) */
  partnerSubmitted: boolean;
  /** the viewer's own truths + guesses (always visible to them) */
  myAnswers: KnowMeAnswerPair[] | null;
  /** the partner's truths + guesses — null until status is at least "answered" */
  partnerAnswers: KnowMeAnswerPair[] | null;
  /** verdicts the viewer gave on the partner's guesses about them */
  myRatings: boolean[] | null;
  /** verdicts the partner gave on the viewer's guesses about them */
  partnerRatings: boolean[] | null;
  /** nailed-its the viewer earned as a guesser — null until the partner rates */
  myScore: number | null;
  /** nailed-its the partner earned — null until the viewer rates */
  partnerScore: number | null;
}
