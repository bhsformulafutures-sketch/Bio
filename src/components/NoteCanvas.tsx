"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export interface NoteCanvasHandle {
  toBlob: () => Promise<Blob | null>;
  isEmpty: () => boolean;
  clear: () => void;
}

const W = 640;
const H = 220;

/** A small freehand pad for a handwritten note. Exports a transparent PNG. */
export const NoteCanvas = forwardRef<NoteCanvasHandle, { className?: string }>(
  function NoteCanvas({ className = "" }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const dirty = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [hasInk, setHasInk] = useState(false);

    const ctx = () => canvasRef.current?.getContext("2d") ?? null;

    const pos = (e: React.PointerEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * W,
        y: ((e.clientY - rect.top) / rect.height) * H,
      };
    };

    const down = (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      last.current = pos(e);
    };
    const move = (e: React.PointerEvent) => {
      if (!drawing.current) return;
      const c = ctx();
      if (!c) return;
      const p = pos(e);
      c.strokeStyle = "#221c15";
      c.lineWidth = 4;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      c.moveTo(last.current!.x, last.current!.y);
      c.lineTo(p.x, p.y);
      c.stroke();
      last.current = p;
      dirty.current = true;
      if (!hasInk) setHasInk(true);
    };
    const up = () => {
      drawing.current = false;
      last.current = null;
    };

    const clear = () => {
      ctx()?.clearRect(0, 0, W, H);
      dirty.current = false;
      setHasInk(false);
    };

    useImperativeHandle(ref, () => ({
      isEmpty: () => !dirty.current,
      clear,
      toBlob: () =>
        new Promise((resolve) => {
          if (!dirty.current || !canvasRef.current) return resolve(null);
          canvasRef.current.toBlob((b) => resolve(b), "image/png");
        }),
    }));

    return (
      <div className={`relative ${className}`}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="touch-draw aspect-[640/220] w-full rounded-xl border border-dashed border-line bg-paper"
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-faint">
            Write a little note…
          </span>
        )}
        {hasInk && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-2 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-soft shadow-card active:scale-95"
          >
            Clear
          </button>
        )}
      </div>
    );
  }
);
