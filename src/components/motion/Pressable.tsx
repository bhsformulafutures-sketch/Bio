"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { spring } from "@/lib/motion";

/**
 * A lightweight wrapper that gives any child (a Link, a row, a tile) the app's
 * shared hover-lift + spring press, without each caller re-deriving the feel.
 * The child stays the real interactive element; this just animates its frame.
 */
export function Pressable({
  children,
  className,
  lift = -3,
  tap = 0.98,
}: {
  children: ReactNode;
  className?: string;
  /** vertical hover lift in px (0 to disable) */
  lift?: number;
  /** tap scale */
  tap?: number;
}) {
  return (
    <motion.div
      className={className}
      whileHover={lift ? { y: lift } : undefined}
      whileTap={{ scale: tap }}
      transition={spring.gentle}
    >
      {children}
    </motion.div>
  );
}
