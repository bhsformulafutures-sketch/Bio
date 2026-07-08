"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KnowMeRoundDTO, SessionDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { Header } from "@/components/Header";
import { Badge, Button, Card, Skeleton } from "@/components/ui";
import { KnowMeCard } from "@/components/KnowMeCard";
import { toast } from "@/components/Toast";

export default function KnowMePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [rounds, setRounds] = useState<KnowMeRoundDTO[] | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, data] = await Promise.all([api.me(), api.listKnowMe()]);
      setSession(me);
      setRounds(data.rounds);
    } catch (error) {
      if ((error as { status?: number }).status === 401) router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const live = rounds?.find((r) => r.status === "open" || r.status === "answered");
  const finished = rounds?.filter((r) => r.status === "completed") ?? [];
  const partnerName = session?.partner?.name ?? null;

  const start = async () => {
    if (live) {
      router.push(`/knowme/${live.id}`);
      return;
    }
    setStarting(true);
    try {
      const { round } = await api.startKnowMe();
      router.push(`/knowme/${round.id}`);
    } catch (error) {
      toast(
        error instanceof ApiError ? error.message : "Couldn't start a round.",
        "error"
      );
      setStarting(false);
      load();
    }
  };

  return (
    <div className="min-h-dvh pb-12">
      <Header session={session} />
      <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-5">
        <Link
          href="/home"
          className="w-fit text-sm font-medium text-faint transition-colors hover:text-soft"
        >
          ← Home
        </Link>

        {/* Hero */}
        <Card className="animate-fade-up overflow-hidden">
          <div className="flex flex-col gap-3 bg-gradient-to-br from-accent-soft to-dusk-soft p-5">
            <Badge tone="soft" className="w-fit">
              Game · Know Me
            </Badge>
            <h1 className="font-display text-2xl font-bold leading-snug text-ink">
              How well do you know each other?
            </h1>
            <p className="text-sm text-soft">
              Five questions. You both answer for yourselves and guess for the
              other — then judge each other&apos;s guesses. 💘 for a nailed one.
            </p>
            <Button size="lg" onClick={start} loading={starting} disabled={rounds === null}>
              {live ? "Continue your round" : "Start a round"}
            </Button>
          </div>
        </Card>

        {/* Live round shortcut */}
        {live && (
          <Card
            interactive
            className="animate-fade-up flex items-center justify-between gap-3 p-4"
            onClick={() => router.push(`/knowme/${live.id}`)}
          >
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold text-ink">
                {live.status === "answered"
                  ? "Reveal ready — go rate the guesses"
                  : live.mineSubmitted
                    ? `Waiting on ${partnerName ?? "your partner"}…`
                    : "Your answers are due"}
              </p>
              <p className="text-sm text-soft">Started by {live.starter.name}</p>
            </div>
            <span className="text-2xl" aria-hidden>
              {live.status === "answered" ? "💌" : "✍️"}
            </span>
          </Card>
        )}

        {/* History */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-ink">Past rounds</h2>
          {rounds === null ? (
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : finished.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-8 text-center">
              <span className="text-3xl" aria-hidden>
                🫶
              </span>
              <p className="text-sm text-soft">
                No finished rounds yet — play one and your scores will live here.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {finished.map((round, i) => (
                <KnowMeCard
                  key={round.id}
                  round={round}
                  partnerName={partnerName}
                  index={i}
                  delayMs={i * 60}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
