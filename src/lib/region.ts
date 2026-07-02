import type { HiddenSide, Rect } from "./types";

export const SIDES: HiddenSide[] = ["left", "right", "top", "bottom"];

/** Resolve the hidden area of a W×H image into a pixel rectangle. */
export function hiddenRect(
  side: HiddenSide,
  ratio: number,
  width: number,
  height: number
): Rect {
  switch (side) {
    case "left":
      return { x: 0, y: 0, w: Math.round(width * ratio), h: height };
    case "right": {
      const w = Math.round(width * ratio);
      return { x: width - w, y: 0, w, h: height };
    }
    case "top":
      return { x: 0, y: 0, w: width, h: Math.round(height * ratio) };
    case "bottom": {
      const h = Math.round(height * ratio);
      return { x: 0, y: height - h, w: width, h };
    }
  }
}

/** Random side with a ratio that keeps the puzzle fair but interesting. */
export function rollRandomRegion(): { side: HiddenSide; ratio: number } {
  const side = SIDES[Math.floor(Math.random() * SIDES.length)];
  const ratio = 0.38 + Math.random() * 0.12; // 38% – 50%
  return { side, ratio: Math.round(ratio * 100) / 100 };
}
