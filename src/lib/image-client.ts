import { isPhotoFill, type DrawAction, type Rect, type Stroke } from "./types";

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

/** Cover-crop an image into the hidden region's aspect ratio and return a
 *  compact JPEG data URL, ready to be painted with drawPhotoFill. */
export function photoToRegionDataUrl(img: HTMLImageElement, region: Rect): string {
  const { canvas } = downscale(img);
  const scale = Math.max(region.w / canvas.width, region.h / canvas.height);
  const cropW = region.w / scale;
  const cropH = region.h / scale;
  const cropX = (canvas.width - cropW) / 2;
  const cropY = (canvas.height - cropH) / 2;
  const out = document.createElement("canvas");
  out.width = Math.round(region.w);
  out.height = Math.round(region.h);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.82);
}

/** Decoded-image cache so replaying photo fills never re-fetches data URLs. */
const photoCache = new Map<string, HTMLImageElement>();

async function photoImage(dataUrl: string): Promise<HTMLImageElement> {
  const cached = photoCache.get(dataUrl);
  if (cached) return cached;
  const img = await loadImage(dataUrl);
  photoCache.set(dataUrl, img);
  return img;
}

/** Replay a full answer (photo fills + strokes) onto a w×h canvas context.
 *  Async because photo fills decode from data URLs; strokes alone are sync. */
export async function paintActions(
  ctx: CanvasRenderingContext2D,
  actions: DrawAction[],
  width: number,
  height: number,
  region: Rect
): Promise<void> {
  // Decode every photo up front so painting itself stays ordered and fast.
  const photos = new Map<string, HTMLImageElement>();
  for (const action of actions) {
    if (isPhotoFill(action) && !photos.has(action.dataUrl)) {
      photos.set(action.dataUrl, await photoImage(action.dataUrl));
    }
  }
  let run: Stroke[] = [];
  const flush = () => {
    if (run.length > 0) paintStrokes(ctx, run, width, height, region);
    run = [];
  };
  for (const action of actions) {
    if (isPhotoFill(action)) {
      flush();
      ctx.save();
      ctx.beginPath();
      ctx.rect(region.x, region.y, region.w, region.h);
      ctx.clip();
      ctx.drawImage(photos.get(action.dataUrl)!, region.x, region.y, region.w, region.h);
      ctx.restore();
    } else {
      run.push(action);
    }
  }
  flush();
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
