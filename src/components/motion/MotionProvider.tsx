"use client";

import { MotionConfig } from "motion/react";
import { spring } from "@/lib/motion";

/**
 * App-wide motion defaults. `reducedMotion="user"` makes every Framer Motion
 * animation automatically respect the OS "reduce motion" setting, so we get
 * accessibility for free without guarding each component.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={spring.gentle}>
      {children}
    </MotionConfig>
  );
}
