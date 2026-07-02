"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChallengeDTO, SessionDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { compositeMerged } from "@/lib/image-client";
import { Header } from "@/components/Header";
import { Button, Card, Spinner } from "@/components/ui";
import { DrawingBoard } from "@/components/DrawingBoard";
import { RevealSequence } from "@/components/RevealSequence";
import { ResultView } from "@/components/ResultView";
import { formatDate } from "@/components/GalleryCard";
import { toast } from "@/components/Toast";

const WAITING_POLL_MS = 10_000;

export default function ChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [challenge, setChallenge] = useState<ChallengeDTO | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revealing, setRevealing] = useState<string | null>(null); // drawing src during reveal
  const [justRevealed, setJustRevealed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, data] = await Promise.all([api.me(), api.getChallenge(id)]);
      setSession(me);
      setChallenge((current) =>
        // Don't let a poll interrupt an in-flight submission/reveal.
        current?.status === "completed" ? current : data.challenge
      );
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 401) router.replace("/");
      else if (status === 404) setNotFound(true);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  /* While my challenge waits for my partner, poll so the page flips to
     the result on its own the moment they finish. */
  const isWaitingOnPartner = challenge?.status === "waiting" && challenge.mine;
  useEffect(() => {
    if (!isWaitingOnPartner) return;
    const interval = setInterval(load, WAITING_POLL_MS);
    return () => clearInterval(interval);
  }, [isWaitingOnPartner, load]);

  const mergeStarted = useRef(false);
  const buildMerge = useCallback(
    async (completed: ChallengeDTO, drawingSrc: string) => {
      if (mergeStarted.current || completed.mergedUrl || !completed.originalUrl) return;
      mergeStarted.current = true;
      try {
        const blob = await compositeMerged(
          completed.originalUrl,
          drawingSrc,
          completed.width,
          completed.height
        );
        const { challenge: updated } = await api.saveMerged(completed.id, blob);
        if (updated) setChallenge(updated);
      } catch {
        /* ResultView self-heals later if this upload didn't land */
      }
    },
    []
  );

  const onFinish = async (drawing: Blob, drawingDataUrl: string) => {
    setSubmitting(true);
    try {
      const { challenge: completed } = await api.completeChallenge(id, drawing);
      localStorage.removeItem(`oh-draft-${id}`);
      setChallenge(completed);
      setRevealing(drawingDataUrl);
      buildMerge(completed, drawingDataUrl); // fire-and-forget during the reveal
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.challenge) {
        toast("Looks like this was already completed!", "error");
        localStorage.removeItem(`oh-draft-${id}`);
        setChallenge(error.challenge);
      } else {
        toast(
          error instanceof ApiError
            ? error.message
            : "Couldn't submit — your drawing is saved, try again.",
          "error"
        );
      }
      setSubmitting(false);
    }
  };

  /* ---- render states ---- */

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-4xl">🫥</span>
        <p className="text-soft">This challenge doesn&apos;t exist (or isn&apos;t yours).</p>
        <Link href="/home">
          <Button variant="soft">Back home</Button>
        </Link>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7 text-accent" />
      </div>
    );
  }

  if (revealing) {
    return (
      <div className="min-h-dvh">
        <RevealSequence
          challenge={challenge}
          drawingSrc={revealing}
          onDone={() => {
            setRevealing(null);
            setJustRevealed(true);
          }}
        />
      </div>
    );
  }

  const partnerName = session?.partner?.name ?? "your partner";

  return (
    <div className="min-h-dvh pb-10">
      <Header session={session} />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-5">
        <Link
          href="/home"
          className="w-fit text-sm font-medium text-faint transition-colors hover:text-soft"
        >
          ← Home
        </Link>

        {challenge.status === "completed" ? (
          <>
            <div className="animate-fade-up">
              <h1 className="font-display text-2xl font-bold">
                {justRevealed ? "A new memory 💛" : "Memory"}
              </h1>
              <p className="mt-1 text-sm text-soft">
                📸 {challenge.creator.name}
                {challenge.solver && <> · ✏️ {challenge.solver.name}</>} ·{" "}
                {formatDate(challenge.completedAt ?? challenge.createdAt)}
              </p>
            </div>
            <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
              <ResultView challenge={challenge} nudge={justRevealed} />
            </div>
            {justRevealed && (
              <Link href="/home" className="animate-fade-up" style={{ animationDelay: "160ms" }}>
                <Button variant="soft" className="w-full">
                  Saved to your gallery — back home
                </Button>
              </Link>
            )}
          </>
        ) : challenge.mine ? (
          <>
            <div className="animate-fade-up">
              <h1 className="font-display text-2xl font-bold">Waiting on {partnerName} ⌛</h1>
              <p className="mt-1 text-sm text-soft">
                Here&apos;s what they&apos;ll see. We&apos;ll flip this page the moment they finish.
              </p>
            </div>
            <Card className="animate-fade-up overflow-hidden" >
              <div
                className="relative w-full"
                style={{ aspectRatio: `${challenge.width} / ${challenge.height}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={challenge.visibleUrl}
                  alt="What your partner sees"
                  className="absolute inset-0 h-full w-full"
                  draggable={false}
                />
              </div>
            </Card>
            {!session?.partner && (
              <p className="text-center text-sm text-faint">
                Psst — they haven&apos;t joined yet. Share your room code from the home screen.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="animate-fade-up">
              <h1 className="font-display text-2xl font-bold">
                {challenge.creator.name} challenges you 🎨
              </h1>
              <p className="mt-1 text-sm text-soft">
                Draw what you think is hiding in the {challenge.hiddenSide} of this photo.
              </p>
            </div>
            <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
              <DrawingBoard
                challenge={challenge}
                submitting={submitting}
                onFinish={onFinish}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
