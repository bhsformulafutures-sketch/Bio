"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { RandomDTO } from "@/lib/types";
import { CATEGORY_META, type PromptCategory } from "@/lib/games/random/prompts";
import { Badge } from "./ui";
import { Countdown } from "./Countdown";
import { BlurImage } from "./motion/BlurImage";
import { tiltFor } from "@/lib/tilt";
import { spring } from "@/lib/motion";

function emojiFor(category: string): string {
  return CATEGORY_META[category as PromptCategory]?.emoji ?? "📸";
}

/** A compact Random Challenge tile for the home feed. */
export function RandomCard({
  random,
  index = 0,
  delayMs = 0,
}: {
  random: RandomDTO;
  index?: number;
  delayMs?: number;
}) {
  const cover = random.submissions[0]?.photoUrl ?? null;
  const tilt = tiltFor(index + 1); // offset so it doesn't mirror the GalleryCards

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 16, rotate: tilt }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      whileHover={{ rotate: 0, y: -5, scale: 1.02, zIndex: 5 }}
      transition={{ ...spring.gentle, delay: delayMs / 1000 }}
    >
      <Link
        href={`/random/${random.id}`}
        className="group block overflow-hidden rounded-2xl bg-surface p-1.5 shadow-card
          transition-shadow duration-200 hover:shadow-lift"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-br from-accent-soft to-dusk-soft">
          {cover ? (
            <BlurImage
              src={cover}
              alt=""
              loading="lazy"
              wrapperClassName="absolute inset-0 h-full w-full"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <span className="animate-float absolute inset-0 flex items-center justify-center text-4xl opacity-70">
              {emojiFor(random.category)}
            </span>
          )}
          <div className="absolute left-2 top-2">
            {random.status === "open" ? (
              <Badge tone="dusk">
                ⏳ <Countdown expiresAt={random.expiresAt} />
              </Badge>
            ) : random.status === "completed" ? (
              <Badge tone="soft">💞 Both in</Badge>
            ) : (
              <Badge tone="line">Missed</Badge>
            )}
          </div>
        </div>
        <div className="px-1.5 py-2">
          <p className="line-clamp-2 text-[13px] font-medium text-ink">{random.prompt}</p>
        </div>
      </Link>
    </motion.div>
  );
}
