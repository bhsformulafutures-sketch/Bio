import type { Transition, Variants } from "motion/react";

/**
 * One motion language for the whole app.
 *
 * Everything animated should pull its timing/easing/spring from here so the
 * interface feels like a single, cohesive, physical material — not a pile of
 * one-off transitions. Think Arc / Linear / Notion: subtle, springy, calm.
 */

/** Signature easing — a soft, confident ease-out (matches globals.css). */
export const EASE = [0.22, 1, 0.36, 1] as const;
/** A gentler ease for ambient / decorative loops. */
export const EASE_SOFT = [0.4, 0, 0.2, 1] as const;

/** Spring presets, from snappy to pillowy. */
export const spring = {
  /** Buttons, taps — quick and lively. */
  snappy: { type: "spring", stiffness: 500, damping: 30, mass: 0.6 },
  /** Cards, panels — a touch of overshoot. */
  gentle: { type: "spring", stiffness: 300, damping: 26, mass: 0.8 },
  /** Layout moves (reorder, expand) — smooth, no bounce. */
  smooth: { type: "spring", stiffness: 240, damping: 30 },
  /** Playful pop for entrances / badges. */
  bouncy: { type: "spring", stiffness: 420, damping: 18, mass: 0.7 },
} satisfies Record<string, Transition>;

/** Duration-based transitions for fades and crossfades. */
export const tween = {
  fast: { duration: 0.18, ease: EASE },
  base: { duration: 0.32, ease: EASE },
  slow: { duration: 0.5, ease: EASE },
} satisfies Record<string, Transition>;

/* ------------------------------------------------------------------ */
/* Reusable variants                                                  */
/* ------------------------------------------------------------------ */

/** Fade + rise. The house entrance. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: tween.base },
};

/** Soft pop-in for cards / dialogs. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring.gentle },
};

/**
 * Container that reveals its children one after another. Pair with
 * `staggerItem` on each child.
 */
export const staggerContainer = (stagger = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: tween.base },
};

/** Page-level crossfade for route transitions. */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: tween.base },
  exit: { opacity: 0, y: -8, transition: tween.fast },
};

/** Shared hover/tap feel for pressable surfaces. */
export const pressable = {
  whileHover: { scale: 1.02, transition: spring.snappy },
  whileTap: { scale: 0.97, transition: spring.snappy },
} as const;

/** A gentler press for large primary buttons. */
export const pressableSoft = {
  whileHover: { scale: 1.015, transition: spring.snappy },
  whileTap: { scale: 0.98, transition: spring.snappy },
} as const;
