"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { KnowMeRoundDTO } from "@/lib/types";
import { knowMeVerdict } from "@/lib/games/knowme/verdict";
import { Badge } from "./ui";
import { formatDate } from "./GalleryCard";
import { tiltFor } from "@/lib/tilt";
import { spring } from "@/lib/motion";

/** A row of five hearts, filled up to `score`. */
export function ScoreHearts({
  score,
  className = "text-base",
}: {
  score: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${score} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < score ? "" : "opacity-25 grayscale"}>
          💘
        </span>
      ))}
    </span>
  );
}

/** A memory-style tile for a Know Me round, for history lists and feeds. */
export function KnowMeCard({
  round,
  partnerName,
  index = 0,
  delayMs = 0,
}: {
  round: KnowMeRoundDTO;
  partnerName?: string | null;
  index?: number;
  delayMs?: number;
}) {
  const tilt = tiltFor(index + 2); // offset so it doesn't mirror the photo cards
  const done = round.status === "completed";
  const myScore = round.myScore ?? 0;
  const partnerScore = round.partnerScore ?? 0;

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 16, rotate: tilt }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      whileHover={{ rotate: 0, y: -5, scale: 1.02, zIndex: 5 }}
      transition={{ ...spring.gentle, delay: delayMs / 1000 }}
    >
      <Link
        href={`/knowme/${round.id}`}
        className="group block overflow-hidden rounded-2xl bg-surface p-1.5 shadow-card
          transition-shadow duration-200 hover:shadow-lift"
      >
        <div className="flex flex-col gap-2 rounded-xl bg-gradient-to-br from-accent-soft to-dusk-soft p-4">
          <div className="flex items-center justify-between">
            {done ? (
              <Badge tone="soft">💞 Rated</Badge>
            ) : round.status === "answered" ? (
              <Badge tone="gold">Reveal ready</Badge>
            ) : (
              <Badge tone="dusk">In play</Badge>
            )}
            <span className="text-[11px] font-semibold text-faint">
              {formatDate(round.completedAt ?? round.createdAt)}
            </span>
          </div>
          {done ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">You</span>
                <ScoreHearts score={myScore} className="text-[13px]" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">
                  {partnerName ?? "Partner"}
                </span>
                <ScoreHearts score={partnerScore} className="text-[13px]" />
              </div>
            </div>
          ) : (
            <p className="line-clamp-2 text-[13px] font-medium text-ink">
              {round.questions[0]}
            </p>
          )}
        </div>
        <div className="px-1.5 py-2">
          <p className="line-clamp-1 text-[13px] font-medium text-ink">
            {done
              ? knowMeVerdict(Math.max(myScore, partnerScore))
              : `${round.questions.length} questions · started by ${round.starter.name}`}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
