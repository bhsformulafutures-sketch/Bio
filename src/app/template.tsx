"use client";

import { motion } from "motion/react";
import { tween } from "@/lib/motion";

/**
 * App Router re-mounts this template on every navigation, so it's the natural
 * home for a global page transition. A quick, calm crossfade + rise makes
 * screen changes feel fluid instead of hard-cutting — without fighting each
 * page's own staggered section entrances.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tween.base}
    >
      {children}
    </motion.div>
  );
}
