"use client";

import { useCallback, useRef, useState } from "react";

interface CompareSliderProps {
  /** Rendered fully (bottom layer) — the original photo. */
  left: React.ReactNode;
  /** Clipped by the handle (top layer) — the imagined version. */
  right: React.ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  aspectRatio: number; // width / height
  /** Play a small attention nudge on mount. */
  nudge?: boolean;
}

/**
 * Draggable before/after slider. The right layer is clipped with
 * clip-path so both images stay perfectly aligned at any position.
 */
export function CompareSlider({
  left,
  right,
  leftLabel = "Original",
  rightLabel = "Imagined",
  aspectRatio,
  nudge = false,
}: CompareSliderProps) {
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const moveTo = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    moveTo(e.clientX);
  };

  return (
    <div
      ref={containerRef}
      className="touch-draw relative w-full cursor-ew-resize select-none overflow-hidden rounded-lg bg-line"
      style={{ aspectRatio: `${aspectRatio}` }}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => dragging && moveTo(e.clientX)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <div className="absolute inset-0">{left}</div>
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      >
        {right}
      </div>

      {/* handle */}
      <div
        className={`absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_8px_rgb(0_0_0/0.35)] ${
          dragging ? "" : "transition-[left] duration-75"
        }`}
        style={{ left: `${position}%` }}
      />
      <div
        className={`absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center
          rounded-full bg-white shadow-lift ${nudge && !dragging ? "animate-nudge" : ""}`}
        style={{ left: `${position}%` }}
      >
        <svg viewBox="0 0 24 24" className="size-5 text-ink" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 8l-4 4 4 4M16 8l4 4-4 4" />
        </svg>
      </div>

      <span className="pointer-events-none absolute top-2.5 left-2.5 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
        {leftLabel}
      </span>
      <span className="pointer-events-none absolute top-2.5 right-2.5 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
        {rightLabel}
      </span>
    </div>
  );
}
