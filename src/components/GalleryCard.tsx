"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { ChallengeDTO } from "@/lib/types";
import { BlurImage } from "@/components/motion/BlurImage";
import { spring } from "@/lib/motion";
import { tiltFor } from "@/lib/tilt";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** One memory in the gallery grid. */
export function GalleryCard({
  challenge,
  index = 0,
  delayMs = 0,
}: {
  challenge: ChallengeDTO;
  index?: number;
  delayMs?: number;
}) {
  const preview = challenge.mergedUrl ?? challenge.visibleUrl;
  const tilt = tiltFor(index);
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 16, rotate: tilt }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      whileHover={{ rotate: 0, y: -5, scale: 1.02, zIndex: 5 }}
      transition={{ ...spring.gentle, delay: delayMs / 1000 }}
    >
      <Link
        href={`/challenge/${challenge.id}`}
        className="group block overflow-hidden rounded-2xl bg-surface p-1.5 shadow-card
          transition-shadow duration-200 hover:shadow-lift"
      >
        <BlurImage
          src={preview}
          alt="Completed challenge"
          loading="lazy"
          wrapperClassName="w-full rounded-xl"
          className="block w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          style={{ aspectRatio: `${challenge.width} / ${challenge.height}` }}
        />
        <div className="flex items-center justify-between gap-2 px-1.5 py-2">
          <p className="truncate text-[13px] text-soft">
            📸 {challenge.creator.name}
            {challenge.solver && <> · ✏️ {challenge.solver.name}</>}
          </p>
          <span className="shrink-0 text-xs text-faint">
            {formatDate(challenge.completedAt ?? challenge.createdAt)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
