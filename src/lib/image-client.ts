import type { Rect, Stroke } from "./types";

/** Longest edge for stored photos — plenty for phones, kind to bandwidth. */
export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.85;

/** Tone used to blank the hidden area of the "visible" image. */
const HIDDEN_FILL = "#efe9df";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the image."));
    img.src = src;
  });
}

export async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    // The image keeps its decoded bitmap; the URL itself can be revoked
    // once loading settles (callers that need img.src should re-render
    // through canvases, which all do).
  }
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed."))),
      type,
      quality
    );
  });
}

/** Downscale to MAX_DIMENSION on the longest edge; returns the canvas. */
export function downscale(img: HTMLImageElement): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
} {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

/** The image the guesser sees: original with the hidden region blanked out. */
export function makeVisibleCanvas(
  source: HTMLCanvasElement,
  hidden: Rect
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  ctx.fillStyle = HIDDEN_FILL;
  ctx.fillRect(hidden.x, hidden.y, hidden.w, hidden.h);
  return canvas;
}

/** Replay normalized strokes onto a w×h canvas context, clipped to a region. */
export function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
  clip?: Rect
): void {
  ctx.save();
  if (clip) {
    ctx.beginPath();
    ctx.rect(clip.x, clip.y, clip.w, clip.h);
    ctx.clip();
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    const size = Math.max(1, stroke.size * width);
    ctx.lineWidth = size;
    const pts = stroke.points;
    if (pts.length === 2) {
      ctx.beginPath();
      ctx.arc(pts[0] * width, pts[1] * height, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0] * width, pts[1] * height);
      for (let i = 2; i < pts.length; i += 2) {
        ctx.lineTo(pts[i] * width, pts[i + 1] * height);
      }
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

/** Deterministic merge: transparent drawing layered over the original. */
export async function compositeMerged(
  originalUrl: string,
  drawingUrl: string,
  width: number,
  height: number
): Promise<Blob> {
  const [original, drawing] = await Promise.all([
    loadImage(originalUrl),
    loadImage(drawingUrl),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(original, 0, 0, width, height);
  ctx.drawImage(drawing, 0, 0, width, height);
  return canvasToBlob(canvas, "image/jpeg", 0.9);
}
