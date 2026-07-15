"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { SessionDTO, WhereAmIRoundDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { spring, tween } from "@/lib/motion";
import { Header } from "@/components/Header";
import { Avatar, Badge, Button, Card, Skeleton, Spinner, TextInput } from "@/components/ui";
import { toast } from "@/components/Toast";
import { BlurImage } from "@/components/motion/BlurImage";

const POLL_MS = 10_000;
const MAX_GUESSES = 4;

/* Torn-paper hint notes lean a little, like they were stuck on in a hurry. */
const NOTE_TILTS = [-1.8, 1.4, -1.1];
const HINT_LABELS = ["Barely a clue", "Warmer…", "Basically telling them"];

/** Row of hearts — the stake and the score of the round. */
function Hearts({ lit, dimmed = 0, className = "" }: { lit: number; dimmed?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label={`${lit} hearts`}>
      {Array.from({ length: lit + dimmed }, (_, i) => (
        <span
          key={i}
          className={`text-lg leading-none ${i < lit ? "text-accent" : "text-line"}`}
          aria-hidden
        >
          ♥
        </span>
      ))}
    </span>
  );
}

/** A no-deps confetti burst: little paper bits flung from the middle. */
function ConfettiBurst() {
  const pieces = useMemo(() => {
    const colors = ["#e8607d", "#7b74d6", "#f0b34a", "#fdeef1", "#eeecfb"];
    return Array.from({ length: 26 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 340,
      y: -60 - Math.random() * 240,
      rotate: (Math.random() - 0.5) * 540,
      scale: 0.6 + Math.random() * 0.9,
      color: colors[i % colors.length],
      delay: Math.random() * 0.15,
      round: i % 3 === 0,
    }));
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className={`absolute left-1/2 top-1/3 block h-2.5 w-2 ${p.round ? "rounded-full" : "rounded-[2px]"}`}
          style={{ backgroundColor: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: p.scale }}
          animate={{ x: p.x, y: [0, p.y, p.y + 220], opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: 1.6, delay: p.delay, ease: [0.16, 0.8, 0.4, 1] }}
        />
      ))}
    </div>
  );
}

/** One unlocked hint as a torn-paper note. */
function HintNote({ hint, index }: { hint: string; index: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, rotate: NOTE_TILTS[index % NOTE_TILTS.length] * 2, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, rotate: NOTE_TILTS[index % NOTE_TILTS.length], scale: 1 }}
      transition={spring.bouncy}
      className="relative rounded-lg bg-[#fdf6e4] px-4 pb-3.5 pt-5 shadow-card"
      style={{ clipPath: "polygon(0% 6%, 3% 0%, 97% 2%, 100% 8%, 99% 94%, 96% 100%, 4% 98%, 0% 92%)" }}
    >
      {/* a strip of "tape" holding the note down */}
      <span className="absolute -top-1 left-1/2 h-3.5 w-12 -translate-x-1/2 rotate-2 rounded-[2px] bg-dusk-soft/80" />
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#a9781f]">
        {HINT_LABELS[index] ?? `Hint ${index + 1}`}
      </p>
      <p className="mt-0.5 text-[15px] leading-snug text-ink">{hint}</p>
    </motion.div>
  );
}

/** The wrong-guess log — the misses are half the fun. */
function GuessLog({ round, affectionate }: { round: WhereAmIRoundDTO; affectionate: boolean }) {
  const wrong = round.guesses.filter((g) => !g.correct);
  if (wrong.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-soft">
        {affectionate ? "The scenic route" : "Guesses so far"}
      </p>
      <ul className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {wrong.map((g, i) => (
            <motion.li
              key={g.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={tween.base}
              className="flex items-center gap-2.5 rounded-xl bg-paper px-3.5 py-2.5"
            >
              <span className="text-sm text-faint" aria-hidden>
                {i + 1}.
              </span>
              <span className="flex-1 text-[15px] text-soft line-through decoration-accent/40">
                {g.text}
              </span>
              <span className="text-sm" aria-hidden>
                🙈
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

export default function WhereAmIRoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [round, setRound] = useState<WhereAmIRoundDTO | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [guess, setGuess] = useState("");
  const [sending, setSending] = useState(false);
  /** set when the ending happened on this screen, to earn the fanfare */
  const [liveEnding, setLiveEnding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, data] = await Promise.all([api.me(), api.getWhereAmI(id)]);
      setSession(me);
      setRound((current) => {
        if (current && current.status === "waiting" && data.round.status !== "waiting") {
          setLiveEnding(true);
        }
        return data.round;
      });
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 401) router.replace("/");
      else if (status === 404) setNotFound(true);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  // The creator watches live: poll while the partner is still guessing.
  const watching = round?.mine === true && round.status === "waiting";
  useEffect(() => {
    if (!watching) return;
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [watching, load]);

  const submitGuess = async () => {
    const text = guess.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { round: updated } = await api.guessWhereAmI(id, text);
      if (updated.status !== "waiting") setLiveEnding(true);
      else toast("Not quite — a new hint just appeared 👀");
      setRound(updated);
      setGuess("");
    } catch (error) {
      toast(
        error instanceof ApiError ? error.message : "Couldn't send that — try again.",
        "error"
      );
    } finally {
      setSending(false);
    }
  };

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-4xl">🧭</span>
        <p className="text-soft">This round doesn&apos;t exist (or isn&apos;t yours).</p>
        <Link href="/home">
          <Button variant="soft">Back home</Button>
        </Link>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="min-h-dvh pb-12">
        <Header session={session} />
        <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-72 w-full rounded-lg" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
        </main>
      </div>
    );
  }

  const partnerName = session?.partner?.name ?? "your partner";
  const finished = round.status !== "waiting";
  const solved = round.status === "solved";

  return (
    <div className="min-h-dvh pb-12">
      <Header session={session} />
      <main className="relative mx-auto flex max-w-lg flex-col gap-5 px-4 pt-5">
        {liveEnding && solved && <ConfettiBurst />}

        <div className="flex items-center justify-between">
          <Link
            href="/home"
            className="w-fit text-sm font-medium text-faint transition-colors hover:text-soft"
          >
            ← Home
          </Link>
          {round.status === "waiting" ? (
            <Badge tone="dusk">🔎 In play</Badge>
          ) : solved ? (
            <Badge tone="soft">Found it</Badge>
          ) : (
            <Badge tone="line">Revealed</Badge>
          )}
        </div>

        <div className="animate-fade-up">
          <h1 className="font-display text-2xl font-bold">Where am I?</h1>
          <p className="mt-1 text-[15px] text-soft">
            {round.mine
              ? finished
                ? `Your mystery spot, ${solved ? "found" : "kept secret to the end"}.`
                : `${partnerName} is on the trail of your mystery spot.`
              : finished
                ? `${round.creator.name}'s mystery spot.`
                : `${round.creator.name} is somewhere in this photo. Name the place.`}
          </p>
        </div>

        {/* The photo — the whole case file. */}
        <div className="animate-fade-up overflow-hidden rounded-lg shadow-card">
          <BlurImage
            src={round.photoUrl}
            alt={round.mine ? "Your photo" : `${round.creator.name}'s mystery place`}
            wrapperClassName="w-full"
            className="block w-full object-cover"
            style={{ aspectRatio: `${round.width} / ${round.height}` }}
          />
        </div>

        {/* ── Finished: triumph or a sweet reveal ─────────────── */}
        {finished && (
          <motion.section
            initial={liveEnding ? { opacity: 0, y: 24, scale: 0.97 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={spring.gentle}
            className="flex flex-col gap-4"
          >
            <Card className="flex flex-col items-center gap-3 p-6 text-center">
              {solved ? (
                <>
                  <motion.span
                    className="text-4xl"
                    initial={liveEnding ? { scale: 0 } : false}
                    animate={{ scale: 1 }}
                    transition={{ ...spring.bouncy, delay: 0.15 }}
                    aria-hidden
                  >
                    🎯
                  </motion.span>
                  <p className="font-display text-xl font-bold text-ink">
                    {round.mine ? `${partnerName} found you` : "You found them"}
                  </p>
                  <p className="text-sm text-soft">The place was</p>
                  <p className="rounded-lg bg-accent-soft px-5 py-2.5 font-display text-lg font-bold text-accent-deep">
                    {round.answer}
                  </p>
                  <div className="mt-1 flex flex-col items-center gap-1">
                    <Hearts lit={round.hearts ?? 0} dimmed={MAX_GUESSES - (round.hearts ?? 0)} />
                    <p className="text-xs text-faint">
                      {round.hearts === MAX_GUESSES
                        ? "First try — no hints needed. Show-off."
                        : `${round.hearts} heart${round.hearts === 1 ? "" : "s"} earned`}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span className="animate-heartbeat text-4xl" aria-hidden>
                    💔
                  </span>
                  <p className="font-display text-xl font-bold text-ink">
                    {round.mine ? "Your spot stayed secret" : "It slipped away"}
                  </p>
                  <p className="text-sm text-soft">
                    {round.mine
                      ? `Four tries and ${partnerName} never quite landed on it.`
                      : "Four tries, so many almosts. It was"}
                  </p>
                  <p className="rounded-lg bg-dusk-soft px-5 py-2.5 font-display text-lg font-bold text-dusk">
                    {round.answer}
                  </p>
                  <p className="text-xs text-faint">
                    {round.mine
                      ? "The wrong guesses below are yours to treasure."
                      : "Somebody owes you a visit so you'll know it next time."}
                  </p>
                </>
              )}
            </Card>

            <Card className="flex flex-col gap-4 p-4">
              <GuessLog round={round} affectionate />
              {round.unlockedHints.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-soft">The hints</p>
                  <ul className="flex flex-col gap-3">
                    {round.unlockedHints.map((hint, i) => (
                      <li key={i}>
                        <HintNote hint={hint} index={i} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            <Link href="/home" className="self-center">
              <Button variant="soft">Back home</Button>
            </Link>
          </motion.section>
        )}

        {/* ── Guesser: the hunt is on ─────────────────────────── */}
        {!finished && !round.mine && (
          <section className="animate-fade-up flex flex-col gap-4">
            <Card className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-ink">
                  Guess it now for {round.guessesLeft} heart{round.guessesLeft === 1 ? "" : "s"}
                </span>
                <span className="text-xs text-faint">
                  Each wrong guess costs a heart and unlocks a hint
                </span>
              </div>
              <Hearts lit={round.guessesLeft} dimmed={MAX_GUESSES - round.guessesLeft} />
            </Card>

            {round.unlockedHints.length > 0 && (
              <ul className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {round.unlockedHints.map((hint, i) => (
                    <li key={i}>
                      <HintNote hint={hint} index={i} />
                    </li>
                  ))}
                </AnimatePresence>
              </ul>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitGuess();
              }}
              className="flex gap-2"
            >
              <TextInput
                placeholder="Name the place…"
                value={guess}
                maxLength={80}
                onChange={(e) => setGuess(e.target.value)}
                autoFocus
              />
              <Button type="submit" loading={sending} disabled={!guess.trim()}>
                Guess
              </Button>
            </form>

            <GuessLog round={round} affectionate={false} />
          </section>
        )}

        {/* ── Creator: watching the hunt live ─────────────────── */}
        {!finished && round.mine && (
          <section className="animate-fade-up flex flex-col gap-4">
            <Card className="flex items-center gap-3 p-4">
              <Avatar avatar={session?.partner?.avatar} name={partnerName} className="size-10" />
              <div className="flex-1">
                <p className="font-semibold text-ink">
                  {round.guesses.length === 0
                    ? `Waiting on ${partnerName}'s first guess…`
                    : `${partnerName} is guessing…`}
                </p>
                <p className="text-sm text-soft">
                  {round.guessesLeft} guess{round.guessesLeft === 1 ? "" : "es"} left · updates live
                </p>
              </div>
              <Spinner className="size-5 text-dusk" />
            </Card>

            <Card className="flex flex-col gap-4 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-soft">Your secret</p>
                <Hearts lit={round.guessesLeft} dimmed={MAX_GUESSES - round.guessesLeft} />
              </div>
              <p className="rounded-lg bg-paper px-4 py-2.5 font-display text-lg font-bold text-ink">
                {round.answer}
              </p>
              <ul className="flex flex-col gap-3">
                {round.unlockedHints.map((hint, i) => {
                  const unlocked = i < round.guesses.filter((g) => !g.correct).length;
                  return (
                    <li key={i} className={unlocked ? "" : "opacity-55"}>
                      <HintNote hint={hint} index={i} />
                      <p className="mt-1 pl-1 text-[11px] text-faint">
                        {unlocked ? "Unlocked" : `Unlocks after wrong guess ${i + 1}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card className="flex flex-col gap-3 p-4">
              {round.guesses.length === 0 ? (
                <p className="py-2 text-center text-sm text-faint">
                  No guesses yet — the suspense is delicious.
                </p>
              ) : (
                <GuessLog round={round} affectionate={false} />
              )}
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}
