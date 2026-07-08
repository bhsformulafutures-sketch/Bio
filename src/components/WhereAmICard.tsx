"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { WhereAmIRoundDTO } from "@/lib/types";
import { Badge } from "./ui";
import { BlurImage } from "./motion/BlurImage";
import { tiltFor } from "./GalleryCard";
import { spring } from "@/lib/motion";

/** A row of four hearts, filled up to `earned`. */
export function GuessHearts({ earned, className = "text-sm" }: { earned: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${earned} out of 4 hearts`}>
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i} className={i < earned ? "" : "opacity-25 grayscale"}>
          ♥️
        </span>
      ))}
    </span>
  );
}

/** A compact Where Am I tile for the home feed and history lists. */
export function WhereAmICard({
  round,
  index = 0,
  delayMs = 0,
}: {
  round: WhereAmIRoundDTO;
  index?: number;
  delayMs?: number;
}) {
  const tilt = tiltFor(index + 2); // offset from GalleryCard/RandomCard tilts

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 16, rotate: tilt }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      whileHover={{ rotate: 0, y: -5, scale: 1.02, zIndex: 5 }}
      transition={{ ...spring.gentle, delay: delayMs / 1000 }}
    >
      <Link
        href={`/whereami/${round.id}`}
        className="group block overflow-hidden rounded-2xl bg-surface p-1.5 shadow-card
          transition-shadow duration-200 hover:shadow-lift"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-br from-mint to-dusk-soft">
          <BlurImage
            src={round.photoUrl}
            alt=""
            loading="lazy"
            wrapperClassName="absolute inset-0 h-full w-full"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          <div className="absolute left-2 top-2">
            {round.status === "waiting" ? (
              <Badge tone="dusk">🔍 Guessing…</Badge>
            ) : round.status === "solved" ? (
              <Badge tone="soft">
                📍 Found <GuessHearts earned={round.hearts ?? 0} className="text-[11px]" />
              </Badge>
            ) : (
              <Badge tone="line">🙈 Stumped</Badge>
            )}
          </div>
        </div>
        <div className="px-1.5 py-2">
          <p className="line-clamp-2 text-[13px] font-medium text-ink">
            {round.answer ?? `Where ${round.mine ? "are you" : "are they"}? A secret spot…`}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
