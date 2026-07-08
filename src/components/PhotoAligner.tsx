"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import type { ChallengeDTO, Rect } from "@/lib/types";
import { fileToImage, loadImage } from "@/lib/image-client";
import { Button } from "./ui";
import { toast } from "./Toast";
import { useAmbientGate } from "@/lib/ambient";

/** Matches the tone used to blank the hidden region in image-client.ts. */
const HIDDEN_FILL = "#efe9df";

type Mode = "camera" | "adjust" | "nocam";

interface Transform {
  /** photo center, in image-frame coordinates (challenge width/height) */
  cx: number;
  cy: number;
  /** photo px → frame px */
  scale: number;
  /** degrees */
  rotate: number;
}

interface PhotoAlignerProps {
  challenge: ChallengeDTO;
  rect: Rect;
  onDone: (dataUrl: string) => void;
  onClose: () => void;
}

/**
 * The retake-killer. Matching a photo to the visible half used to be blind
 * guesswork; this sheet shows a translucent ghost of the partner's visible
 * half over a live camera feed so you can line the scene up BEFORE you
 * shoot, then lets you nudge any photo (camera or gallery) into place with
 * drag / pinch-zoom / rotate against the same ghost.
 */
export function PhotoAligner({ challenge, rect, onDone, onClose }: PhotoAlignerProps) {
  const { width: W, height: H } = challenge;
  useAmbientGate(true);

  const [mode, setMode] = useState<Mode>("camera");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ghostUrl, setGhostUrl] = useState<string | null>(null);
  const [ghostOpacity, setGhostOpacity] = useState(0.5);
  const [cameraReady, setCameraReady] = useState(false);

  /** The photo being placed (camera capture or gallery pick). */
  const [photo, setPhoto] = useState<{ img: HTMLImageElement; fromCamera: boolean } | null>(null);
  const [t, setT] = useState<Transform>({ cx: 0, cy: 0, scale: 1, rotate: 0 });
  const [photoOpacity, setPhotoOpacity] = useState(0.7);
  const initialT = useRef<Transform>(t);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const mirrored = facing === "user";

  /* The ghost: the visible half with the hidden region punched out to full
     transparency, so it never hazes the exact area being composed. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const img = await loadImage(challenge.visibleUrl);
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, W, H);
        ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
        if (!cancelled) setGhostUrl(canvas.toDataURL("image/png"));
      } catch {
        /* ghost is a nicety — alignment still works without it */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [challenge.visibleUrl, W, H, rect.x, rect.y, rect.w, rect.h]);

  /* ---- camera lifecycle ---- */

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (mode !== "camera") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMode("nocam");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch {
        if (!cancelled) setMode("nocam");
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [mode, facing, stopStream]);

  useEffect(() => stopStream, [stopStream]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* ---- entering adjust mode ---- */

  const beginAdjust = (img: HTMLImageElement, fromCamera: boolean) => {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const start: Transform = fromCamera
      ? { cx: W / 2, cy: H / 2, scale: 1, rotate: 0 }
      : {
          cx: rect.x + rect.w / 2,
          cy: rect.y + rect.h / 2,
          scale: Math.max(rect.w / iw, rect.h / ih),
          rotate: 0,
        };
    initialT.current = start;
    setT(start);
    setPhoto({ img, fromCamera });
    setPhotoOpacity(0.7);
    setMode("adjust");
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    if (mirrored) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    // Same cover mapping the preview shows, so what you framed is what lands.
    const scale = Math.max(W / vw, H / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
    stopStream();
    try {
      const img = await loadImage(canvas.toDataURL("image/jpeg", 0.92));
      beginAdjust(img, true);
    } catch {
      toast("Couldn't grab that frame — try again.", "error");
      setMode("camera");
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("That doesn't look like an image.", "error");
      return;
    }
    try {
      const img = await fileToImage(file);
      stopStream();
      beginAdjust(img, false);
    } catch {
      toast("Couldn't read that image — try another one.", "error");
    }
  };

  /* ---- gestures (adjust mode) ---- */

  const frameScale = () => {
    const el = frameRef.current;
    return el ? el.getBoundingClientRect().width / W : 1;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode !== "adjust") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = new Map(pointers.current);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const k = frameScale();
    const pts = [...pointers.current.entries()];

    if (pts.length === 1) {
      const [id, now] = pts[0];
      const before = prev.get(id)!;
      setT((cur) => ({
        ...cur,
        cx: cur.cx + (now.x - before.x) / k,
        cy: cur.cy + (now.y - before.y) / k,
      }));
      return;
    }

    if (pts.length >= 2) {
      const [[idA, a1], [idB, b1]] = pts;
      const a0 = prev.get(idA)!;
      const b0 = prev.get(idB)!;
      const dist0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
      const dist1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
      if (dist0 < 1) return;
      const f = dist1 / dist0;
      const dTheta =
        Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
      const c0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
      const c1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
      const frame = frameRef.current!.getBoundingClientRect();

      setT((cur) => {
        const pc = { x: frame.left + cur.cx * k, y: frame.top + cur.cy * k };
        const rel = { x: pc.x - c0.x, y: pc.y - c0.y };
        const cos = Math.cos(dTheta);
        const sin = Math.sin(dTheta);
        const rotated = {
          x: (rel.x * cos - rel.y * sin) * f,
          y: (rel.x * sin + rel.y * cos) * f,
        };
        const next = { x: c1.x + rotated.x, y: c1.y + rotated.y };
        return {
          cx: (next.x - frame.left) / k,
          cy: (next.y - frame.top) / k,
          scale: clampScale(cur.scale * f),
          rotate: cur.rotate + (dTheta * 180) / Math.PI,
        };
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (mode !== "adjust") return;
    const f = Math.exp(-e.deltaY * 0.0012);
    setT((cur) => ({ ...cur, scale: clampScale(cur.scale * f) }));
  };

  const clampScale = (s: number) =>
    Math.min(Math.max(s, initialT.current.scale * 0.15), initialT.current.scale * 12);

  /* ---- export ---- */

  const place = async () => {
    if (!photo) return;
    const out = document.createElement("canvas");
    out.width = Math.round(rect.w);
    out.height = Math.round(rect.h);
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = HIDDEN_FILL;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.translate(t.cx - rect.x, t.cy - rect.y);
    ctx.rotate((t.rotate * Math.PI) / 180);
    ctx.scale(t.scale, t.scale);
    ctx.drawImage(photo.img, -photo.img.naturalWidth / 2, -photo.img.naturalHeight / 2);
    try {
      onDone(out.toDataURL("image/jpeg", 0.82));
    } catch {
      toast("Couldn't save the photo — try again.", "error");
    }
  };

  /* ---- layout helpers ---- */

  const hintStyle = useMemo(
    () => ({
      left: `${(rect.x / W) * 100}%`,
      top: `${(rect.y / H) * 100}%`,
      width: `${(rect.w / W) * 100}%`,
      height: `${(rect.h / H) * 100}%`,
    }),
    [rect, W, H]
  );

  // Portaled to <body>: ancestors with CSS transforms (page transitions)
  // would otherwise turn `fixed` into container-relative positioning.
  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-ink/90 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* header */}
      <div className="flex items-center justify-between px-4 pb-2 pt-4 text-white">
        <p className="font-display text-lg font-bold">
          {mode === "adjust" ? "Line it up" : "Match the missing half"}
        </p>
        <button
          aria-label="Close"
          onClick={onClose}
          className="flex size-10 items-center justify-center rounded-full bg-white/10 text-xl
            transition-transform active:scale-90"
        >
          ✕
        </button>
      </div>

      {/* the frame */}
      <div className="flex flex-1 items-center justify-center overflow-hidden px-4">
        <div
          ref={frameRef}
          className="relative w-full max-w-2xl touch-none select-none overflow-hidden rounded-2xl bg-black shadow-lift"
          style={{ aspectRatio: `${W} / ${H}`, maxHeight: "62dvh" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {mode === "camera" && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover"
                style={mirrored ? { transform: "scaleX(-1)" } : undefined}
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                  Waking up the camera…
                </div>
              )}
            </>
          )}

          {mode === "nocam" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="text-3xl">📷</span>
              <p className="max-w-xs text-sm text-white/85">
                No camera here — pick a photo instead and line it up against the ghost of their half.
              </p>
            </div>
          )}

          {mode === "adjust" && photo && (
            <>
              {/* the partner's visible half — the anchor you align against */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={challenge.visibleUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
              {/* their photo, free-floating while being placed */}
              <PhotoLayer photo={photo.img} t={t} W={W} H={H} opacity={photoOpacity} />
            </>
          )}

          {/* ghost of the visible half over the live camera */}
          {mode === "camera" && ghostUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ghostUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ opacity: ghostOpacity }}
            />
          )}

          {/* hidden-region outline — where the shot will land */}
          {mode !== "nocam" && (
            <div className="pointer-events-none absolute" style={hintStyle}>
              <div className="absolute inset-0 border-2 border-dashed border-white/70" />
              <span className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-semibold text-white">
                {mode === "camera" ? "your half lands here" : "kept area"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* controls */}
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-6 pt-3">
        {mode === "camera" && (
          <>
            <label className="flex items-center gap-3 text-xs font-semibold text-white/85">
              Ghost
              <input
                type="range"
                min={0.15}
                max={0.85}
                step={0.01}
                value={ghostOpacity}
                onChange={(e) => setGhostOpacity(Number(e.target.value))}
                className="h-8 flex-1 accent-white"
                aria-label="Ghost overlay opacity"
              />
            </label>
            <div className="flex items-center justify-center gap-6">
              <button
                aria-label="Choose from gallery"
                onClick={() => fileInputRef.current?.click()}
                className="flex size-12 items-center justify-center rounded-full bg-white/12 text-xl
                  text-white transition-transform active:scale-90"
              >
                🖼️
              </button>
              <button
                aria-label="Take photo"
                onClick={capture}
                disabled={!cameraReady}
                className="size-18 rounded-full border-4 border-white/90 bg-white/25 p-1.5
                  transition-transform active:scale-90 disabled:opacity-40"
              >
                <span className="block h-full w-full rounded-full bg-white" />
              </button>
              <button
                aria-label="Flip camera"
                onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                className="flex size-12 items-center justify-center rounded-full bg-white/12 text-xl
                  text-white transition-transform active:scale-90"
              >
                🔄
              </button>
            </div>
          </>
        )}

        {mode === "nocam" && (
          <Button size="lg" onClick={() => fileInputRef.current?.click()}>
            Choose a photo
          </Button>
        )}

        {mode === "adjust" && photo && (
          <>
            <p className="text-center text-xs text-white/70">
              Drag to move · pinch to zoom & rotate — line your photo up with their half
            </p>
            <label className="flex items-center gap-3 text-xs font-semibold text-white/85">
              See-through
              <input
                type="range"
                min={0.3}
                max={1}
                step={0.01}
                value={photoOpacity}
                onChange={(e) => setPhotoOpacity(Number(e.target.value))}
                className="h-8 flex-1 accent-white"
                aria-label="Photo opacity while aligning"
              />
            </label>
            <label className="flex items-center gap-3 text-xs font-semibold text-white/85">
              Tilt
              <input
                type="range"
                min={-45}
                max={45}
                step={0.5}
                value={t.rotate > 180 ? t.rotate - 360 : t.rotate}
                onChange={(e) => setT((cur) => ({ ...cur, rotate: Number(e.target.value) }))}
                className="h-8 flex-1 accent-white"
                aria-label="Rotate photo"
              />
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => {
                  if (photo.fromCamera) {
                    setPhoto(null);
                    setMode("camera");
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
              >
                {photo.fromCamera ? "Retake" : "Swap photo"}
              </Button>
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => setT(initialT.current)}
              >
                Reset
              </Button>
              <Button size="lg" className="flex-1" onClick={place}>
                Place photo 💘
              </Button>
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>
    </motion.div>,
    document.body
  );
}

/** Their photo rendered with the live transform, sized in frame units so the
 *  same numbers drive both this preview and the final canvas export. */
function PhotoLayer({
  photo,
  t,
  W,
  H,
  opacity,
}: {
  photo: HTMLImageElement;
  t: Transform;
  W: number;
  H: number;
  opacity: number;
}) {
  // Percent-based so the layer tracks the responsive frame without JS resize
  // handling: left/width are % of frame width, top is % of frame height.
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 h-full w-full"
      style={{ opacity }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt=""
        draggable={false}
        className="absolute max-w-none origin-center"
        style={{
          left: `${(t.cx / W) * 100}%`,
          top: `${(t.cy / H) * 100}%`,
          width: `${((photo.naturalWidth * t.scale) / W) * 100}%`,
          transform: `translate(-50%, -50%) rotate(${t.rotate}deg)`,
        }}
      />
    </div>
  );
}
