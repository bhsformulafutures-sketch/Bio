"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChallengeDTO } from "@/lib/types";
import { hiddenRect } from "@/lib/region";
import { Spinner } from "./ui";

type Phase = "processing" | "preparing" | "3" | "2" | "1" | "reveal";

const SLIDE_OUT: Record<string, string> = {
  left: "-translate-x-full",
  right: "translate-x-full",
  top: "-translate-y-full",
  bottom: "translate-y-full",
};

interface RevealSequenceProps {
  challenge: ChallengeDTO; // completed — originalUrl is present
  /** Local data URL of the drawing (fresh submission) or remote drawingUrl. */
  drawingSrc: string;
  onDone: () => void;
}

/**
 * The payoff moment: processing → countdown → the mask slides off the
 * hidden region and the real photo breathes through the drawing.
 */
export function RevealSequence({ challenge, drawingSrc, onDone }: RevealSequenceProps) {
  const [phase, setPhase] = useState<Phase>("processing");
  const [maskGone, setMaskGone] = useState(false);
  const [ghost, setGhost] = useState(false);

  const rect = useMemo(
    () =>
      hiddenRect(
        challenge.hiddenSide,
        challenge.hiddenRatio,
        challenge.width,
        challenge.height
      ),
    [challenge]
  );

  useEffect(() => {
    const steps: Array<[Phase | "mask" | "ghost" | "done", number]> = [
      ["preparing", 1100],
      ["3", 1000],
      ["2", 850],
      ["1", 850],
      ["reveal", 850],
      ["mask", 400],
      ["ghost", 1600],
      ["done", 2100],
    ];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    for (const [step, delay] of steps) {
      at += delay;
      timers.push(
        setTimeout(() => {
          if (step === "mask") setMaskGone(true);
          else if (step === "ghost") setGhost(true);
          else if (step === "done") onDone();
          else setPhase(step);
        }, at)
      );
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = {
    left: `${(rect.x / challenge.width) * 100}%`,
    top: `${(rect.y / challenge.height) * 100}%`,
    width: `${(rect.w / challenge.width) * 100}%`,
    height: `${(rect.h / challenge.height) * 100}%`,
  };

  if (phase !== "reveal") {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-6 px-6">
        {phase === "processing" || phase === "preparing" ? (
          <>
            <Spinner className="size-8 text-accent" />
            <p key={phase} className="animate-fade-in text-lg font-medium text-soft">
              {phase === "processing" ? "Processing…" : "Preparing reveal…"}
            </p>
          </>
        ) : (
          <span
            key={phase}
            className="animate-count font-display text-[9rem] leading-none font-bold text-accent"
          >
            {phase}
          </span>
        )}
        <button
          onClick={onDone}
          className="fixed bottom-8 text-sm font-medium text-faint transition-colors hover:text-soft"
        >
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in px-4 pt-6">
      <p className="mb-4 text-center font-display text-2xl font-bold">
        The truth, revealed
      </p>
      <div
        className="relative mx-auto w-full max-w-lg overflow-hidden rounded-lg shadow-lift"
        style={{ aspectRatio: `${challenge.width} / ${challenge.height}` }}
      >
        {/* the real photo underneath */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={challenge.originalUrl!}
          alt="The original photo"
          className="absolute inset-0 h-full w-full"
          draggable={false}
        />
        {/* the drawing stays on top, breathing to let the truth through */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={drawingSrc}
          alt="Your drawing"
          className="absolute inset-0 h-full w-full transition-opacity duration-[1400ms] ease-in-out"
          style={{ opacity: ghost ? 0.45 : 1 }}
          draggable={false}
        />
        {/* the mask that slides away */}
        <div
          className={`absolute bg-paper transition-transform duration-[1300ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            maskGone ? SLIDE_OUT[challenge.hiddenSide] : ""
          }`}
          style={pct}
        >
          <div
            className="animate-shimmer h-full w-full"
            style={{
              background:
                "linear-gradient(100deg, transparent 30%, rgba(217,111,78,0.12) 50%, transparent 70%)",
              backgroundSize: "200% 100%",
            }}
          />
        </div>
        {/* a couple of sparkles once the truth has fully settled in */}
        {ghost && (
          <>
            <span
              aria-hidden
              className="animate-sparkle pointer-events-none absolute right-4 top-4 text-2xl"
            >
              ✨
            </span>
            <span
              aria-hidden
              className="animate-sparkle pointer-events-none absolute bottom-5 left-5 text-xl"
              style={{ animationDelay: "0.4s" }}
            >
              ✨
            </span>
          </>
        )}
      </div>
      <p className="mt-4 text-center text-sm text-soft">
        {ghost ? "Comparing imaginations…" : "Here it comes…"}
      </p>
    </div>
  );
}
