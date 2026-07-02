"use client";

import { useEffect, useRef, useState } from "react";
import type { ChallengeDTO } from "@/lib/types";
import { CompareSlider } from "./CompareSlider";
import { compositeMerged } from "@/lib/image-client";
import { api } from "@/lib/api";

type View = "compare" | "original" | "drawing" | "merged";

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "compare", label: "Compare" },
  { id: "original", label: "Original" },
  { id: "drawing", label: "Imagined" },
  { id: "merged", label: "Merged" },
];

/** Detail view for a completed challenge — the heart of every memory. */
export function ResultView({
  challenge,
  nudge = false,
}: {
  challenge: ChallengeDTO;
  nudge?: boolean;
}) {
  const [view, setView] = useState<View>("compare");
  const [mergedUrl, setMergedUrl] = useState(challenge.mergedUrl);
  const healing = useRef(false);

  /* Self-heal: if the merged image upload was interrupted, rebuild it
     deterministically from original + drawing and store it once. */
  useEffect(() => {
    if (mergedUrl || healing.current) return;
    if (!challenge.originalUrl || !challenge.drawingUrl) return;
    healing.current = true;
    (async () => {
      try {
        const blob = await compositeMerged(
          challenge.originalUrl!,
          challenge.drawingUrl!,
          challenge.width,
          challenge.height
        );
        const { challenge: updated } = await api.saveMerged(challenge.id, blob);
        if (updated?.mergedUrl) setMergedUrl(updated.mergedUrl);
        else setMergedUrl(URL.createObjectURL(blob));
      } catch {
        /* comparison still works without the stored merge */
      }
    })();
  }, [challenge, mergedUrl]);

  const aspectRatio = challenge.width / challenge.height;
  const frame = "absolute inset-0 h-full w-full";

  const imagined = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={challenge.visibleUrl} alt="" className={frame} draggable={false} />
      {challenge.drawingUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={challenge.drawingUrl} alt="The drawing" className={frame} draggable={false} />
      )}
    </>
  );

  const original = challenge.originalUrl && (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={challenge.originalUrl} alt="The original photo" className={frame} draggable={false} />
  );

  return (
    <div className="flex flex-col gap-3">
      {view === "compare" ? (
        <CompareSlider
          left={<div className={frame}>{original}</div>}
          right={<div className={frame}>{imagined}</div>}
          aspectRatio={aspectRatio}
          nudge={nudge}
        />
      ) : (
        <div
          className="relative w-full overflow-hidden rounded-2xl bg-line"
          style={{ aspectRatio: `${aspectRatio}` }}
        >
          {view === "original" && original}
          {view === "drawing" && imagined}
          {view === "merged" &&
            (mergedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mergedUrl} alt="Merged result" className={frame} draggable={false} />
            ) : (
              <div className={`${frame} flex items-center justify-center text-sm text-faint`}>
                Building the merge…
              </div>
            ))}
        </div>
      )}

      <div className="flex justify-center">
        <div className="flex rounded-full bg-surface p-1 shadow-card">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition-all active:scale-95 ${
                view === v.id ? "bg-ink text-white" : "text-soft hover:text-ink"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
