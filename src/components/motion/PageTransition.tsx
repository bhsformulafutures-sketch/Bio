"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { pageVariants } from "@/lib/motion";

/**
 * Wraps a page's content so navigating between screens crossfades + rises
 * instead of hard-cutting. Kept intentionally light so it never fights the
 * per-section reveal animations inside a page.
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}
