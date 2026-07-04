"use client";

import { useMemo } from "react";

/**
 * The "living interface": a soft, slow, never-distracting layer of motion
 * that sits above the static `body::before` dusk wash but behind all content.
 *
 * - A couple of large blurred blobs (rose + periwinkle) drifting on their own
 *   timelines.
 * - A scatter of tiny twinkling particles in the accent + gold tones.
 *
 * Tuned to the "Dusk & Blush" palette and kept deliberately faint. Collapses
 * entirely under prefers-reduced-motion (see `.ambient-layer` in globals.css).
 */
export function AmbientBackground({
  density = "app",
}: {
  density?: "app" | "hero";
}) {
  // Deterministic-per-mount particle field so it doesn't reshuffle on render.
  const particles = useMemo(
    () =>
      Array.from({ length: density === "hero" ? 16 : 10 }, (_, i) => ({
        id: i,
        left: Math.round(seeded(i * 3 + 1) * 100),
        top: Math.round(seeded(i * 3 + 2) * 100),
        delay: (seeded(i * 3 + 3) * 6).toFixed(2),
        scale: 0.5 + seeded(i * 7 + 5) * 0.9,
        gold: seeded(i * 5 + 4) > 0.6,
      })),
    [density]
  );

  return (
    <div className="ambient-layer" aria-hidden>
      {/* Drifting blurred blobs */}
      <div
        className="animate-drift absolute -left-24 top-[-8%] size-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "var(--color-accent-soft)" }}
      />
      <div
        className="animate-drift-slow absolute right-[-12%] top-1/3 size-80 rounded-full opacity-45 blur-3xl"
        style={{ background: "var(--color-dusk-soft)" }}
      />
      <div
        className="animate-drift absolute bottom-[-12%] left-1/4 size-72 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--color-accent-soft)", animationDelay: "9s" }}
      />

      {/* Twinkling particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="animate-twinkle absolute block size-1.5 rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDelay: `${p.delay}s`,
            transform: `scale(${p.scale})`,
            background: p.gold ? "var(--color-gold)" : "var(--color-accent)",
            opacity: 0.5,
          }}
        />
      ))}
    </div>
  );
}

/** Tiny deterministic PRNG so the particle field is stable per render. */
function seeded(n: number): number {
  const x = Math.sin(n * 999.13) * 43758.5453;
  return x - Math.floor(x);
}
