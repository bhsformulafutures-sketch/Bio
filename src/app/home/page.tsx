"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChallengeDTO, RandomDTO, SessionDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { Header } from "@/components/Header";
import { Avatar, Button, Card, Skeleton } from "@/components/ui";
import { GalleryCard, formatDate } from "@/components/GalleryCard";
import { RandomCard } from "@/components/RandomCard";
import { toast } from "@/components/Toast";

const POLL_MS = 12_000;

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [challenges, setChallenges] = useState<ChallengeDTO[] | null>(null);
  const [randoms, setRandoms] = useState<RandomDTO[] | null>(null);
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [me, list, rand] = await Promise.all([
        api.me(),
        api.listChallenges(),
        api.listRandoms(),
      ]);
      setSession(me);
      setChallenges(list.challenges);
      setRandoms(rand.randoms);
    } catch (error) {
      if ((error as { status?: number }).status === 401) router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  if (!session || !challenges || !randoms) {
    return (
      <div className="min-h-dvh">
        <Header session={session} />
        <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-8">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-40" />
        </main>
      </div>
    );
  }

  const yourTurn = challenges.filter((c) => c.status === "waiting" && !c.mine);
  const waitingOnPartner = challenges.filter((c) => c.status === "waiting" && c.mine);
  const memories = challenges.filter((c) => c.status === "completed");
  const openRandom = randoms.find((r) => r.status === "open") ?? null;
  const doneRandoms = randoms.filter((r) => r.status !== "open");
  const partnerName = session.partner?.name;
  const totalMoments = memories.length + doneRandoms.length;

  const share = async () => {
    const text = `Join me on Two of Us 💞 Room code: ${session.room.code} — ${window.location.origin}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Invite copied — send it to them!");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const startRandom = async () => {
    if (openRandom) {
      router.push(`/random/${openRandom.id}`);
      return;
    }
    setStarting(true);
    try {
      const { random } = await api.startRandom();
      router.push(`/random/${random.id}`);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't start a challenge.", "error");
      setStarting(false);
    }
  };

  return (
    <div className="min-h-dvh pb-16">
      <Header session={session} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-6">
        <div className="animate-fade-up flex items-center gap-3">
          <Avatar avatar={session.user.avatar} name={session.user.name} className="size-11 text-xl" />
          <div>
            <h1 className="font-display text-2xl font-bold leading-tight">
              Hi {session.participant.name}
            </h1>
            <p className="text-[15px] text-soft">
              {partnerName
                ? `You & ${partnerName} · ${totalMoments} ${totalMoments === 1 ? "moment" : "moments"} together`
                : "Your room is ready — invite your other half."}
            </p>
          </div>
        </div>

        {!session.partner && (
          <Card className="animate-fade-up flex flex-col items-center gap-4 overflow-hidden p-6 text-center">
            <p className="text-sm text-soft">Share this code with your person</p>
            <p className="font-mono text-4xl font-bold tracking-[0.25em] text-ink">
              {session.room.code}
            </p>
            <Button onClick={share}>Send invite 💌</Button>
          </Card>
        )}

        {/* Play together — the two mini-games */}
        <section className="animate-fade-up flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-soft">Play together</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push("/new")}
              className="group relative flex flex-col items-start gap-2 overflow-hidden rounded-3xl
                bg-gradient-to-br from-accent-soft to-surface p-4 text-left shadow-card
                transition-all hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]"
            >
              <span className="text-3xl transition-transform group-hover:scale-110">🎨</span>
              <span className="font-display text-lg font-bold leading-tight">Other Half</span>
              <span className="text-xs text-soft">Hide half a photo — they imagine the rest.</span>
            </button>
            <button
              onClick={startRandom}
              disabled={starting}
              className="group relative flex flex-col items-start gap-2 overflow-hidden rounded-3xl
                bg-gradient-to-br from-dusk-soft to-surface p-4 text-left shadow-card
                transition-all hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98] disabled:opacity-60"
            >
              <span className="text-3xl transition-transform group-hover:scale-110">🎲</span>
              <span className="font-display text-lg font-bold leading-tight">
                {openRandom ? "Continue" : "Random"}
              </span>
              <span className="text-xs text-soft">
                {openRandom ? "You've got one in progress." : "A surprise prompt. 24 hours. Go!"}
              </span>
            </button>
          </div>
        </section>

        {openRandom && (
          <section className="animate-fade-up flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-soft">
              Happening now 🎲
            </h2>
            <Link
              href={`/random/${openRandom.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-dusk/20 bg-dusk-soft/50 p-4
                transition-all hover:-translate-y-0.5 hover:shadow-card active:scale-[0.99]"
            >
              <span className="animate-breathe text-3xl">📸</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{openRandom.prompt}</p>
                <p className="text-sm text-soft">
                  {openRandom.mineSubmitted
                    ? openRandom.partnerSubmitted
                      ? "You both answered — tap to reveal!"
                      : `Waiting on ${partnerName ?? "your partner"}`
                    : "Your move — snap it before time runs out"}
                </p>
              </div>
              <span className="flex size-8 items-center justify-center rounded-full bg-dusk-soft text-dusk transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </section>
        )}

        {yourTurn.length > 0 && (
          <section className="animate-fade-up flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-soft">Your turn ✏️</h2>
            {yourTurn.map((c) => (
              <Link
                key={c.id}
                href={`/challenge/${c.id}`}
                className="group flex items-center gap-4 rounded-2xl bg-surface p-3 shadow-card
                  transition-all hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.visibleUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.creator.name} sent you a challenge</p>
                  <p className="text-sm text-soft">
                    Imagine the missing {c.hiddenSide} · {formatDate(c.createdAt)}
                  </p>
                </div>
                <span className="mr-1 flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent-deep transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            ))}
          </section>
        )}

        {waitingOnPartner.length > 0 && (
          <section className="animate-fade-up flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-soft">
              Waiting on {partnerName ?? "your partner"} ⌛
            </h2>
            {waitingOnPartner.map((c) => (
              <Link
                key={c.id}
                href={`/challenge/${c.id}`}
                className="flex items-center gap-4 rounded-2xl border border-dashed border-line bg-surface/60 p-3
                  transition-colors hover:border-faint"
              >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.visibleUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                </div>
                <p className="text-sm text-soft">
                  Sent {formatDate(c.createdAt)} — they haven&apos;t drawn yet
                </p>
              </Link>
            ))}
          </section>
        )}

        <section className="animate-fade-up flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-soft">Memories 💛</h2>
          {memories.length === 0 && doneRandoms.length === 0 ? (
            <div className="dotted flex flex-col items-center gap-3 rounded-3xl border border-line py-14 text-center">
              <span className="animate-float text-4xl">🌱</span>
              <p className="max-w-60 text-sm text-soft">
                Every finished game blossoms into a memory here. Start one above and plant the first!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {memories.map((c) => (
                <GalleryCard key={c.id} challenge={c} />
              ))}
              {doneRandoms.map((r) => (
                <RandomCard key={r.id} random={r} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
