export type HiddenSide = "left" | "right" | "top" | "bottom";
export type ChallengeStatus = "waiting" | "completed";

/** What the client knows about the signed-in pair. */
export interface SessionDTO {
  participant: { id: string; name: string };
  room: { id: string; code: string; createdAt: string };
  partner: { id: string; name: string } | null;
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
