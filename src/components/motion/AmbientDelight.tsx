"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useAmbientPaused } from "@/lib/ambient";

/**
 * The "living scrapbook" delight layer — frequent, unpredictable moments of
 * warmth (a paper airplane, a few floating hearts, drifting petals, a
 * sticky note) layered above the ambient background and below all real
 * content. Each one fires on its own randomized ~30s timer, independent of
 * the others, so they overlap and interleave rather than ever feeling like
 * a fixed loop.
 *
 * Disabled entirely under prefers-reduced-motion, and paused whenever a
 * modal/menu is open or the user is mid-drawing (see `useAmbientGate`).
 */
export function AmbientDelight() {
  const paused = useAmbientPaused();
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (reduced) return null;

  return (
    <div className="ambient-layer" aria-hidden>
      <PaperAirplaneLayer paused={paused} />
      <FloatingHeartsLayer paused={paused} />
      <PetalsLayer paused={paused} />
      <StickyNoteLayer paused={paused} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Fires `run` at random intervals between `minMs` and `maxMs` forever,
 * skipping (but not cancelling) turns while `paused` is true. Reads the
 * latest `run`/`paused` via refs so callers don't need to memoize them.
 */
function useRareLoop(minMs: number, maxMs: number, paused: boolean, run: () => Promise<void>) {
  const runRef = useRef(run);
  runRef.current = run;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;
      if (!pausedRef.current && !busy) {
        busy = true;
        try {
          await runRef.current();
        } finally {
          busy = false;
        }
      }
      if (!cancelled) timer = setTimeout(tick, rand(minMs, maxMs));
    };

    timer = setTimeout(tick, rand(minMs, maxMs));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [minMs, maxMs]);
}

type Pt = { x: number; y: number };

/* ------------------------------------------------------------------ */
/* 1. Paper airplane — the signature moment                           */
/* ------------------------------------------------------------------ */

interface Flight {
  id: number;
  start: Pt;
  mid1: Pt;
  mid2: Pt;
  end: Pt;
  duration: number;
}

const EDGES = ["left", "right", "top", "bottom"] as const;

function edgePoint(edge: (typeof EDGES)[number], w: number, h: number, out = 56): Pt {
  const along = rand(0.15, 0.85);
  switch (edge) {
    case "left":
      return { x: -out, y: along * h };
    case "right":
      return { x: w + out, y: along * h };
    case "top":
      return { x: along * w, y: -out };
    case "bottom":
      return { x: along * w, y: h + out };
  }
}

function angleBetween(a: Pt, b: Pt): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function PaperAirplaneLayer({ paused }: { paused: boolean }) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const nextId = useRef(0);

  const spawn = useCallback(() => {
    return new Promise<void>((resolve) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const from = pick(EDGES);
      const to = pick(EDGES.filter((e) => e !== from));
      const start = edgePoint(from, w, h);
      const end = edgePoint(to, w, h);
      const mid1: Pt = { x: rand(w * 0.2, w * 0.8), y: rand(h * 0.15, h * 0.8) };
      const mid2: Pt = { x: rand(w * 0.2, w * 0.8), y: rand(h * 0.2, h * 0.85) };
      const id = nextId.current++;
      const duration = rand(5, 7.5);

      setFlights((f) => [...f, { id, start, mid1, mid2, end, duration }]);
      setTimeout(
        () => {
          setFlights((f) => f.filter((fl) => fl.id !== id));
          resolve();
        },
        duration * 1000 + 400
      );
    });
  }, []);

  // Roughly every 30 seconds.
  useRareLoop(25_000, 35_000, paused, spawn);

  return (
    <>
      {flights.map((f) => (
        <AirplaneFlight key={f.id} {...f} />
      ))}
    </>
  );
}

function AirplaneFlight({ start, mid1, mid2, end, duration }: Flight) {
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const nextId = useRef(0);
  const lastSpawn = useRef(0);

  const headings = [
    angleBetween(start, mid1),
    angleBetween(start, mid1),
    angleBetween(mid1, mid2),
    angleBetween(mid2, end),
  ];

  return (
    <>
      {/* soft shadow, trailing slightly below */}
      <motion.div
        className="absolute -z-[1] rounded-full bg-ink/10 blur-md"
        style={{ width: 20, height: 7, translateX: "-50%", translateY: "-50%" }}
        initial={{ x: start.x, y: start.y + 12, opacity: 0 }}
        animate={{
          x: [start.x, mid1.x, mid2.x, end.x],
          y: [start.y + 12, mid1.y + 12, mid2.y + 12, end.y + 12],
          opacity: [0, 0.4, 0.4, 0],
        }}
        transition={{ duration, ease: "easeInOut", times: [0, 0.3, 0.7, 1] }}
      />

      <motion.div
        className="absolute"
        style={{ translateX: "-50%", translateY: "-50%" }}
        initial={{ x: start.x, y: start.y, opacity: 0, rotate: headings[0] }}
        animate={{
          x: [start.x, mid1.x, mid2.x, end.x],
          y: [start.y, mid1.y, mid2.y, end.y],
          rotate: headings,
          opacity: [0, 1, 1, 0],
        }}
        transition={{ duration, ease: "easeInOut", times: [0, 0.3, 0.7, 1] }}
        onUpdate={(latest) => {
          const now = performance.now();
          if (now - lastSpawn.current < 240) return;
          lastSpawn.current = now;
          const id = nextId.current++;
          const x = latest.x as number;
          const y = latest.y as number;
          setHearts((h) => [...h.slice(-7), { id, x, y }]);
          setTimeout(() => setHearts((h) => h.filter((t) => t.id !== id)), 2200);
        }}
      >
        {/* the plane wobbles gently on top of its heading rotation */}
        <motion.div
          animate={{ rotate: [-4, 4, -4] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
        >
          <PaperPlaneIcon />
        </motion.div>
      </motion.div>

      {hearts.map((h) => (
        <TrailHeart key={h.id} x={h.x} y={h.y} />
      ))}
    </>
  );
}

function PaperPlaneIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 44 44" className="drop-shadow-sm">
      <path
        d="M40 20 L6 5 L19 20 L6 35 Z"
        fill="var(--color-surface)"
        stroke="var(--color-faint)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M19 20 L40 20" stroke="var(--color-line)" strokeWidth="1.2" />
    </svg>
  );
}

function TrailHeart({ x, y }: { x: number; y: number }) {
  const dx = useRef(rand(-14, 14)).current;
  const size = useRef(rand(9, 15)).current;
  return (
    <motion.span
      className="absolute block"
      style={{
        left: 0,
        top: 0,
        fontSize: size,
        color: "var(--color-accent)",
        translateX: "-50%",
        translateY: "-50%",
      }}
      initial={{ x, y, opacity: 0.9, scale: 0.6 }}
      animate={{ x: x + dx, y: y - rand(36, 60), opacity: 0, scale: 1 }}
      transition={{ duration: 2, ease: "easeOut" }}
    >
      ♥
    </motion.span>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Floating hearts — ambient, unrelated to the airplane trail       */
/* ------------------------------------------------------------------ */

function FloatingHeartsLayer({ paused }: { paused: boolean }) {
  const [batches, setBatches] = useState<{ id: number; hearts: Pt[] }[]>([]);
  const nextId = useRef(0);

  const spawn = useCallback(() => {
    return new Promise<void>((resolve) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const count = Math.round(rand(2, 4));
      const hearts = Array.from({ length: count }, () => ({
        x: rand(w * 0.08, w * 0.92),
        y: rand(h * 0.55, h * 0.95),
      }));
      const id = nextId.current++;
      setBatches((b) => [...b, { id, hearts }]);
      setTimeout(() => {
        setBatches((b) => b.filter((batch) => batch.id !== id));
        resolve();
      }, 9000);
    });
  }, []);

  // Roughly every 30 seconds.
  useRareLoop(25_000, 35_000, paused, spawn);

  return (
    <>
      {batches.map((batch) =>
        batch.hearts.map((p, i) => <AmbientHeart key={`${batch.id}-${i}`} origin={p} delay={i * 0.6} />)
      )}
    </>
  );
}

function AmbientHeart({ origin, delay }: { origin: Pt; delay: number }) {
  const size = useRef(rand(8, 13)).current;
  const dx = useRef(rand(-24, 24)).current;
  const rise = useRef(rand(90, 160)).current;
  const peak = useRef(rand(0.35, 0.6)).current;
  const gold = useRef(Math.random() > 0.7).current;

  return (
    <motion.span
      className="absolute block"
      style={{
        left: origin.x,
        top: origin.y,
        fontSize: size,
        color: gold ? "var(--color-gold)" : "var(--color-accent)",
        translateX: "-50%",
        translateY: "-50%",
      }}
      initial={{ y: 0, x: 0, opacity: 0, scale: 0.7 }}
      animate={{ y: -rise, x: dx, opacity: [0, peak, 0], scale: 1 }}
      transition={{ duration: rand(6, 9), ease: "easeInOut", delay }}
    >
      ♥
    </motion.span>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Drifting flower petals                                          */
/* ------------------------------------------------------------------ */

function PetalsLayer({ paused }: { paused: boolean }) {
  const [gusts, setGusts] = useState<{ id: number }[]>([]);
  const nextId = useRef(0);

  const spawn = useCallback(() => {
    return new Promise<void>((resolve) => {
      const id = nextId.current++;
      setGusts((g) => [...g, { id }]);
      setTimeout(() => {
        setGusts((g) => g.filter((gust) => gust.id !== id));
        resolve();
      }, 15000);
    });
  }, []);

  // Roughly every 30 seconds.
  useRareLoop(25_000, 35_000, paused, spawn);

  return (
    <>
      {gusts.map((g) => (
        <PetalGust key={g.id} />
      ))}
    </>
  );
}

function PetalGust() {
  const petals = useRef(
    Array.from({ length: Math.round(rand(3, 6)) }, (_, i) => ({
      id: i,
      startX: rand(0, 100),
      size: rand(8, 16),
      duration: rand(9, 14),
      delay: rand(0, 3),
      drift: rand(-14, 14),
      spin: rand(140, 320) * (Math.random() > 0.5 ? 1 : -1),
      gold: Math.random() > 0.65,
    }))
  ).current;

  return (
    <>
      {petals.map((p) => (
        <motion.span
          key={p.id}
          className="absolute block rounded-[60%_40%_60%_40%/60%_40%_60%_40%]"
          style={{
            left: `${p.startX}%`,
            top: "-4%",
            width: p.size,
            height: p.size * 0.75,
            background: p.gold ? "var(--color-gold)" : "var(--color-accent)",
            opacity: 0,
          }}
          initial={{ y: 0, x: 0, rotate: 0, opacity: 0 }}
          animate={{
            y: ["0vh", "108vh"],
            x: [0, p.drift * 3, p.drift * 6],
            rotate: p.spin,
            opacity: [0, 0.55, 0.55, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "linear",
            times: [0, 0.08, 0.85, 1],
          }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Floating sticky note with a tiny doodle                         */
/* ------------------------------------------------------------------ */

/* Bottom corners only — every page varies in header/hero height, but the
   trailing whitespace below the last section is reliably clear on all of
   them, mobile included. */
const CORNERS = [
  { bottom: "9%", left: "5%" },
  { bottom: "9%", right: "5%" },
  { bottom: "18%", left: "6%" },
  { bottom: "18%", right: "6%" },
] as const;

function StickyNoteLayer({ paused }: { paused: boolean }) {
  const [note, setNote] = useState<{ id: number; corner: (typeof CORNERS)[number]; tilt: number } | null>(
    null
  );
  const nextId = useRef(0);

  const spawn = useCallback(() => {
    return new Promise<void>((resolve) => {
      const id = nextId.current++;
      const corner = pick(CORNERS);
      const tilt = rand(-7, 7);
      setNote({ id, corner, tilt });
      setTimeout(() => {
        setNote((n) => (n?.id === id ? null : n));
        resolve();
      }, 5600);
    });
  }, []);

  // Roughly every 30 seconds.
  useRareLoop(25_000, 35_000, paused, spawn);

  if (!note) return null;
  return <StickyNote corner={note.corner} tilt={note.tilt} />;
}

function StickyNote({ corner, tilt }: { corner: (typeof CORNERS)[number]; tilt: number }) {
  const Doodle = pick(DOODLES);
  return (
    <motion.div
      className="absolute flex size-14 items-center justify-center rounded-md shadow-card"
      style={{
        ...corner,
        background: "var(--color-gold)",
      }}
      initial={{ opacity: 0, y: -10, rotate: tilt - 4, scale: 0.9 }}
      animate={{
        opacity: [0, 0.92, 0.92, 0],
        y: [-10, 0, 0, -6],
        rotate: [tilt - 4, tilt, tilt, tilt - 2],
        scale: [0.9, 1, 1, 0.96],
      }}
      transition={{ duration: 5.6, ease: "easeInOut", times: [0, 0.18, 0.78, 1] }}
    >
      <Doodle />
    </motion.div>
  );
}

const DOODLES = [
  function HeartDoodle() {
    return (
      <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
        <path
          d="M16 27S4 19.5 4 11.8C4 7.6 7.2 5 10.6 5c2.2 0 4.2 1.1 5.4 3 1.2-1.9 3.2-3 5.4-3C24.8 5 28 7.6 28 11.8 28 19.5 16 27 16 27Z"
          stroke="var(--color-ink)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  },
  function SmileyDoodle() {
    return (
      <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="11" stroke="var(--color-ink)" strokeWidth="2" />
        <path d="M11 18c1.5 2.2 3.3 3.2 5 3.2s3.5-1 5-3.2" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="13" r="1.4" fill="var(--color-ink)" />
        <circle cx="20" cy="13" r="1.4" fill="var(--color-ink)" />
      </svg>
    );
  },
  function FlowerDoodle() {
    return (
      <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse
            key={deg}
            cx="16"
            cy="9"
            rx="3.4"
            ry="5.4"
            fill="var(--color-accent-soft)"
            stroke="var(--color-ink)"
            strokeWidth="1.2"
            transform={`rotate(${deg} 16 16)`}
          />
        ))}
        <circle cx="16" cy="16" r="2.6" fill="var(--color-gold)" stroke="var(--color-ink)" strokeWidth="1" />
      </svg>
    );
  },
  function StarDoodle() {
    return (
      <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
        <path
          d="M16 4l3.4 8 8.6.7-6.5 5.7 2 8.4L16 22.4 8.5 26.8l2-8.4L4 12.7l8.6-.7Z"
          stroke="var(--color-ink)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  },
  function PaperclipDoodle() {
    return (
      <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
        <path
          d="M11 15.5 20 6.6a4 4 0 1 1 5.7 5.7L14.8 23.1a2.4 2.4 0 1 1-3.4-3.4l9-8.9a0.8 0.8 0 1 1 1.1 1.1l-8 8"
          stroke="var(--color-ink)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  },
  function SquiggleDoodle() {
    return (
      <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
        <path
          d="M5 20c2.5-6 5-6 7.5 0s5 6 7.5 0 5-6 7.5 0"
          stroke="var(--color-ink)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  },
];
