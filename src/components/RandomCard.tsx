"use client";

import Link from "next/link";
import type { RandomDTO } from "@/lib/types";
import { CATEGORY_META, type PromptCategory } from "@/lib/games/random/prompts";
import { Badge } from "./ui";
import { Countdown } from "./Countdown";

function emojiFor(category: string): string {
  return CATEGORY_META[category as PromptCategory]?.emoji ?? "📸";
}

/** A compact Random Challenge tile for the home feed. */
export function RandomCard({
  random,
  delayMs = 0,
}: {
  random: RandomDTO;
  delayMs?: number;
}) {
  const cover = random.submissions[0]?.photoUrl ?? null;

  return (
    <Link
      href={`/random/${random.id}`}
      className="group block animate-fade-up overflow-hidden rounded-2xl bg-surface shadow-card transition-all
        duration-200 hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-accent-soft to-dusk-soft">
        {cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            draggable={false}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-4xl opacity-70">
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
      <div className="px-3 py-2.5">
        <p className="line-clamp-2 text-[13px] font-medium text-ink">{random.prompt}</p>
      </div>
    </Link>
  );
}
