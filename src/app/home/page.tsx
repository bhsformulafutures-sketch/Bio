"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChallengeDTO, SessionDTO } from "@/lib/types";
import { api } from "@/lib/api";
import { Header } from "@/components/Header";
import { Button, Card, Spinner } from "@/components/ui";
import { GalleryCard, formatDate } from "@/components/GalleryCard";
import { toast } from "@/components/Toast";

const POLL_MS = 12_000;

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [challenges, setChallenges] = useState<ChallengeDTO[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [me, list] = await Promise.all([api.me(), api.listChallenges()]);
      setSession(me);
      setChallenges(list.challenges);
    } catch (error) {
      if ((error as { status?: number }).status === 401) router.replace("/");
    }
  }, [router]);

  /* Initial load + gentle polling + refresh when the tab regains focus. */
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

  if (!session || !challenges) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7 text-accent" />
      </div>
    );
  }

  const yourTurn = challenges.filter((c) => c.status === "waiting" && !c.mine);
  const waitingOnPartner = challenges.filter((c) => c.status === "waiting" && c.mine);
  const memories = challenges.filter((c) => c.status === "completed");
  const partnerName = session.partner?.name;

  const share = async () => {
    const text = `Join me on Other Half! Room code: ${session.room.code} — ${window.location.origin}`;
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

  return (
    <div className="min-h-dvh pb-28">
      <Header session={session} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-6">
        <div className="animate-fade-up">
          <h1 className="font-display text-2xl font-bold">
            Hi {session.participant.name} 👋
          </h1>
          <p className="mt-1 text-[15px] text-soft">
            {partnerName
              ? `You & ${partnerName} · ${memories.length} ${memories.length === 1 ? "memory" : "memories"} so far`
              : "Your room is ready — invite your other half."}
          </p>
        </div>

        {!session.partner && (
          <Card className="animate-fade-up flex flex-col items-center gap-4 p-6 text-center">
            <p className="text-sm text-soft">Share this code with your person</p>
            <p className="font-mono text-4xl font-bold tracking-[0.25em] text-ink">
              {session.room.code}
            </p>
            <Button onClick={share}>Send invite</Button>
          </Card>
        )}

        {yourTurn.length > 0 && (
          <section className="animate-fade-up flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-soft">
              Your turn ✏️
            </h2>
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
                  <p className="font-semibold">
                    {c.creator.name} sent you a challenge
                  </p>
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
          <h2 className="text-sm font-bold uppercase tracking-wide text-soft">
            Memories 💛
          </h2>
          {memories.length === 0 ? (
            <div className="dotted flex flex-col items-center gap-2 rounded-3xl border border-line py-12 text-center">
              <span className="text-3xl">🖼️</span>
              <p className="max-w-56 text-sm text-soft">
                Completed challenges live here forever. Send the first one!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {memories.map((c) => (
                <GalleryCard key={c.id} challenge={c} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* thumb-reach primary action */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-paper via-paper/90 to-transparent px-4 pb-6 pt-8">
        <div className="mx-auto max-w-3xl">
          <Button
            size="lg"
            className="w-full shadow-lift"
            onClick={() => router.push("/new")}
          >
            📷 New challenge
          </Button>
        </div>
      </div>
    </div>
  );
}
