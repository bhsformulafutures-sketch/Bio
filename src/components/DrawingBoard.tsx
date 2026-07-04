"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChallengeDTO, DrawAction, Stroke, Tool } from "@/lib/types";
import { hiddenRect } from "@/lib/region";
import {
  canvasToBlob,
  fileToImage,
  paintActions,
  photoToRegionDataUrl,
} from "@/lib/image-client";
import { Button, Card } from "./ui";
import { toast } from "./Toast";
import { pauseAmbient, resumeAmbient } from "@/lib/ambient";

const COLORS = [
  "#221c15", "#ffffff", "#e5484d", "#f76b15", "#ffc53d",
  "#46a758", "#0090ff", "#8e4ec6", "#e93d82", "#ad7f58",
];

/** Brush size as a fraction of image width (slider range). */
const SIZE_MIN = 0.004;
const SIZE_MAX = 0.06;
const SIZE_DEFAULT = 0.014;
const MAX_HISTORY = 60;

interface DrawingBoardProps {
  challenge: ChallengeDTO;
  submitting: boolean;
  /** Called with the transparent drawing layer (blob + data URL). */
  onFinish: (drawing: Blob, drawingDataUrl: string) => void;
}

function draftKey(id: string) {
  return `oh-draft-${id}`;
}

export function DrawingBoard({ challenge, submitting, onFinish }: DrawingBoardProps) {
  const { width, height } = challenge;
  const rect = useMemo(
    () => hiddenRect(challenge.hiddenSide, challenge.hiddenRatio, width, height),
    [challenge.hiddenSide, challenge.hiddenRatio, width, height]
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<DrawAction[][]>([[]]);
  const indexRef = useRef(0);
  const replaySeqRef = useRef(0);
  const liveStrokeRef = useRef<Stroke | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZE_DEFAULT);
  // Mirrors of the history refs, so buttons re-render.
  const [historyState, setHistoryState] = useState({ index: 0, length: 1 });
  const [armed, setArmed] = useState(false);

  const actions = () => historyRef.current[indexRef.current];
  const hasInk = historyState.index > 0 || actions().length > 0;

  const replay = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const seq = ++replaySeqRef.current;
    const snapshot = actions();
    const ctx = canvas.getContext("2d")!;
    // Photo decoding is async; only the newest replay may touch the canvas.
    const buffer = document.createElement("canvas");
    buffer.width = width;
    buffer.height = height;
    await paintActions(buffer.getContext("2d")!, snapshot, width, height, rect);
    if (seq !== replaySeqRef.current) return;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(buffer, 0, 0);
  }, [width, height, rect]);

  /* Restore an interrupted draft on mount. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(challenge.id));
      if (raw) {
        const saved = JSON.parse(raw) as DrawAction[];
        if (Array.isArray(saved) && saved.length > 0) {
          historyRef.current = [[], saved];
          indexRef.current = 1;
          setHistoryState({ index: 1, length: 2 });
        }
      }
    } catch {
      /* corrupt draft — start fresh */
    }
    replay();
  }, [challenge.id, replay]);

  const persistDraft = useCallback(() => {
    try {
      localStorage.setItem(draftKey(challenge.id), JSON.stringify(actions()));
    } catch {
      /* storage full or blocked — drawing still works */
    }
  }, [challenge.id]);

  const commit = useCallback(
    (next: DrawAction[]) => {
      const history = historyRef.current.slice(0, indexRef.current + 1);
      history.push(next);
      if (history.length > MAX_HISTORY) history.shift();
      historyRef.current = history;
      indexRef.current = history.length - 1;
      setHistoryState({ index: indexRef.current, length: history.length });
      persistDraft();
    },
    [persistDraft]
  );

  /* ---- pointer handling ---- */

  const toImagePoint = (e: React.PointerEvent) => {
    const bounds = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - bounds.left) / bounds.width) * width,
      y: ((e.clientY - bounds.top) / bounds.height) * height,
    };
  };

  const inHiddenRegion = (p: { x: number; y: number }) =>
    p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;

  const drawSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = canvasRef.current!.getContext("2d")!;
    const stroke = liveStrokeRef.current!;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, stroke.size * width);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (submitting) return;
    const p = toImagePoint(e);
    if (!inHiddenRegion(p)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pauseAmbient();
    liveStrokeRef.current = {
      tool,
      color,
      size: tool === "eraser" ? size * 1.8 : size,
      points: [p.x / width, p.y / height],
    };
    lastPointRef.current = p;
    // A dot for taps.
    drawSegment(p, p);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const stroke = liveStrokeRef.current;
    if (!stroke) return;
    const p = toImagePoint(e);
    const last = lastPointRef.current!;
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
    drawSegment(last, p);
    stroke.points.push(p.x / width, p.y / height);
    lastPointRef.current = p;
  };

  const onPointerUp = () => {
    const stroke = liveStrokeRef.current;
    if (!stroke) return;
    resumeAmbient();
    liveStrokeRef.current = null;
    lastPointRef.current = null;
    commit([...actions(), stroke]);
  };

  /* ---- photo answers ---- */

  const addPhoto = async (file: File | undefined) => {
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("That doesn't look like an image.", "error");
      return;
    }
    try {
      const img = await fileToImage(file);
      const dataUrl = photoToRegionDataUrl(img, rect);
      commit([...actions(), { kind: "photo", dataUrl }]);
      replay();
      toast("Photo placed — draw on top or finish!");
    } catch {
      toast("Couldn't read that image — try another one.", "error");
    }
  };

  /* ---- history actions ---- */

  const undo = () => {
    if (indexRef.current === 0) return;
    indexRef.current -= 1;
    setHistoryState((s) => ({ ...s, index: indexRef.current }));
    persistDraft();
    replay();
  };

  const redo = () => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current += 1;
    setHistoryState((s) => ({ ...s, index: indexRef.current }));
    persistDraft();
    replay();
  };

  const clearAll = () => {
    if (actions().length === 0) return;
    commit([]);
    replay();
  };

  const finish = async () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3500);
      return;
    }
    setArmed(false);
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext("2d")!;
    await paintActions(ctx, actions(), width, height, rect);
    const blob = await canvasToBlob(exportCanvas, "image/png");
    onFinish(blob, exportCanvas.toDataURL("image/png"));
  };

  /* Hidden-region hint geometry in percentages. */
  const hintStyle = {
    left: `${(rect.x / width) * 100}%`,
    top: `${(rect.y / height) * 100}%`,
    width: `${(rect.w / width) * 100}%`,
    height: `${(rect.h / height) * 100}%`,
  };

  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.length - 1;

  return (
    <div className="flex flex-col gap-3">
      {/* canvas over the visible half */}
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-line shadow-card"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={challenge.visibleUrl}
          alt="The visible half of the photo"
          className="absolute inset-0 h-full w-full"
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="touch-draw absolute inset-0 h-full w-full cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {!hasInk && (
          <div
            className="pointer-events-none absolute flex items-center justify-center"
            style={hintStyle}
          >
            <div className="absolute inset-1.5 rounded-xl border-2 border-dashed border-faint/70" />
            <span className="animate-float rounded-full bg-ink/75 px-3.5 py-1.5 text-center text-xs font-semibold text-white backdrop-blur-sm">
              ✏️ Draw it — or 📷 drop in a photo
            </span>
          </div>
        )}
      </div>

      {/* toolbar */}
      <Card className="flex flex-col gap-3 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Color ${c}`}
              onClick={() => {
                setColor(c);
                setTool("pencil");
              }}
              className={`size-8 rounded-full border transition-transform active:scale-90 ${
                color === c && tool === "pencil"
                  ? "scale-110 border-ink ring-2 ring-ink/15"
                  : "border-line"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label
            aria-label="Custom color"
            className="relative size-8 cursor-pointer rounded-full border border-line active:scale-90"
            style={{
              background:
                "conic-gradient(#e5484d, #ffc53d, #46a758, #0090ff, #8e4ec6, #e5484d)",
            }}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setTool("pencil");
              }}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-paper p-1">
            <ToolButton active={tool === "pencil"} onClick={() => setTool("pencil")} label="Pencil">
              <PencilIcon />
            </ToolButton>
            <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} label="Eraser">
              <EraserIcon />
            </ToolButton>
            <ToolButton
              active={false}
              onClick={() => photoInputRef.current?.click()}
              label="Answer with a photo"
            >
              <CameraIcon />
            </ToolButton>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => addPhoto(e.target.files?.[0])}
          />

          <input
            type="range"
            aria-label="Brush size"
            min={SIZE_MIN}
            max={SIZE_MAX}
            step={0.001}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="h-11 min-w-0 flex-1 accent-ink"
          />
          <span
            className="rounded-full bg-ink"
            style={{
              width: `${8 + ((size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)) * 16}px`,
              height: `${8 + ((size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)) * 16}px`,
            }}
          />

          <div className="ml-auto flex items-center gap-1">
            <IconButton onClick={undo} disabled={!canUndo} label="Undo">
              <UndoIcon />
            </IconButton>
            <IconButton onClick={redo} disabled={!canRedo} label="Redo">
              <UndoIcon flipped />
            </IconButton>
            <IconButton onClick={clearAll} disabled={actions().length === 0} label="Clear drawing">
              <TrashIcon />
            </IconButton>
          </div>
        </div>

        <Button
          size="lg"
          onClick={finish}
          loading={submitting}
          disabled={!hasInk || actions().length === 0}
          className={armed ? "bg-ink hover:bg-ink" : ""}
        >
          {submitting
            ? "Sending your masterpiece…"
            : armed
              ? "Tap again to reveal the truth 👀"
              : "Finish"}
        </Button>
      </Card>
    </div>
  );
}

/* ---- small toolbar atoms ---- */

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex size-9 items-center justify-center rounded-full transition-all active:scale-90 ${
        active ? "bg-ink text-white shadow-card" : "text-soft"
      }`}
    >
      {children}
    </button>
  );
}

function IconButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-10 items-center justify-center rounded-full text-soft transition-all
        hover:bg-paper active:scale-90 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const iconProps = {
  className: "size-5",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function PencilIcon() {
  return (
    <svg {...iconProps}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg {...iconProps}>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21H7Z" />
      <path d="M22 21H7" />
    </svg>
  );
}

function UndoIcon({ flipped = false }: { flipped?: boolean }) {
  return (
    <svg {...iconProps} style={flipped ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
