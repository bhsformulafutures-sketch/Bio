"use client";

import Link from "next/link";
import type { ChallengeDTO } from "@/lib/types";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** One memory in the gallery grid. */
export function GalleryCard({ challenge }: { challenge: ChallengeDTO }) {
  const preview = challenge.mergedUrl ?? challenge.visibleUrl;
  return (
    <Link
      href={`/challenge/${challenge.id}`}
      className="group block overflow-hidden rounded-2xl bg-surface shadow-card transition-all
        duration-200 hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]"
    >
      <div
        className="relative w-full overflow-hidden bg-line"
        style={{ aspectRatio: `${challenge.width} / ${challenge.height}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt="Completed challenge"
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          draggable={false}
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <p className="truncate text-[13px] text-soft">
          📸 {challenge.creator.name}
          {challenge.solver && <> · ✏️ {challenge.solver.name}</>}
        </p>
        <span className="shrink-0 text-xs text-faint">
          {formatDate(challenge.completedAt ?? challenge.createdAt)}
        </span>
      </div>
    </Link>
  );
}
