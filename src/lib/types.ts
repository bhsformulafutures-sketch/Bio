export type HiddenSide = "left" | "right" | "top" | "bottom";
export type ChallengeStatus = "waiting" | "completed";
export type RandomStatus = "open" | "completed" | "expired";

/** The signed-in person's profile (no email leaves the server in full). */
export interface UserDTO {
  id: string;
  name: string;
  avatar: string | null;
  emailHint: string | null; // masked address, e.g. "j***@gmail.com"
}

/** What the client knows about the signed-in pair, inside a room. */
export interface SessionDTO {
  user: UserDTO;
  participant: { id: string; name: string };
  room: { id: string; code: string; createdAt: string };
  partner: { id: string; name: string; avatar: string | null } | null;
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
