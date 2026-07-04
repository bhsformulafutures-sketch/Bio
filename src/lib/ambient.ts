"use client";

import { useEffect, useState } from "react";

/**
 * Ref-counted pause signal for the ambient delight layer (paper airplane,
 * floating hearts, petals, sticky notes). Any surface that opens a modal,
 * a menu, or captures drawing input calls `pauseAmbient()` on open and
 * `resumeAmbient()` on close so the decorative layer never competes with a
 * real interaction.
 */
type Listener = (paused: boolean) => void;

const listeners = new Set<Listener>();
let count = 0;

export function pauseAmbient(): void {
  count += 1;
  if (count === 1) listeners.forEach((l) => l(true));
}

export function resumeAmbient(): void {
  count = Math.max(0, count - 1);
  if (count === 0) listeners.forEach((l) => l(false));
}

/** Convenience: pause the ambient layer for as long as `active` is true. */
export function useAmbientGate(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    pauseAmbient();
    return () => resumeAmbient();
  }, [active]);
}

export function useAmbientPaused(): boolean {
  const [paused, setPaused] = useState(() => count > 0);
  useEffect(() => {
    listeners.add(setPaused);
    return () => {
      listeners.delete(setPaused);
    };
  }, []);
  return paused;
}
