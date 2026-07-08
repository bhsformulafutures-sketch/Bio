"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import type { KnowMeAnswerPair, KnowMeRoundDTO, SessionDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import {
  categoryOfQuestion,
  KNOWME_CATEGORY_META,
} from "@/lib/games/knowme/questions";
import { knowMePairVerdict, knowMeVerdict } from "@/lib/games/knowme/verdict";
import { spring } from "@/lib/motion";
import { Header } from "@/components/Header";
import { Avatar, Badge, Button, Card, Skeleton, Spinner, TextInput } from "@/components/ui";
import { ScoreHearts } from "@/components/KnowMeCard";
import { toast } from "@/components/Toast";

const POLL_MS = 10_000;
const MAX_CHARS = 120;

function draftKey(id: string) {
  return `km-draft-${id}`;
}

const emptyDraft = (count: number): KnowMeAnswerPair[] =>
  Array.from({ length: count }, () => ({ truth: "", guess: "" }));

/** Little progress dots — one per question, filled once both fields are in. */
function ProgressDots({ draft }: { draft: KnowMeAnswerPair[] }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {draft.map((pair, i) => {
        const done = pair.truth.trim() !== "" && pair.guess.trim() !== "";
        return (
          <motion.span
            key={i}
            animate={{ scale: done ? 1 : 0.8 }}
            transition={spring.bouncy}
            className={`size-2.5 rounded-full transition-colors duration-300 ${
              done ? "bg-accent" : "bg-line"
            }`}
          />
        );
      })}
    </div>
  );
}

/** Category chip for a question. */
function QuestionBadge({ question }: { question: string }) {
  const meta = KNOWME_CATEGORY_META[categoryOfQuestion(question)];
  return (
    <Badge tone="dusk">
      {meta.emoji} {meta.label}
    </Badge>
  );
}

/** One guess-versus-truth pairing inside the reveal. */
function GuessPair({
  guessLabel,
  guess,
  truthLabel,
  truth,
  verdict,
}: {
  guessLabel: string;
  guess: string;
  truthLabel: string;
  truth: string;
  verdict?: boolean | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="relative flex flex-col gap-1 rounded-2xl bg-dusk-soft/60 p-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-dusk">
          {guessLabel}
        </span>
        <p className="text-sm font-medium text-ink">{guess}</p>
        {verdict !== undefined && verdict !== null && (
          <span
            className="absolute -right-1.5 -top-1.5 rounded-full bg-surface px-1.5 py-0.5 text-xs shadow-card"
            aria-label={verdict ? "Nailed it" : "Not quite"}
          >
            {verdict ? "💘" : "❌"}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 rounded-2xl bg-accent-soft/60 p-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-accent-deep">
          {truthLabel}
        </span>
        <p className="text-sm font-medium text-ink">{truth}</p>
      </div>
    </div>
  );
}

export default function KnowMeRoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [round, setRound] = useState<KnowMeRoundDTO | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [draft, setDraft] = useState<KnowMeAnswerPair[] | null>(null);
  const [sending, setSending] = useState(false);
  const [verdicts, setVerdicts] = useState<(boolean | null)[]>([]);
  const [savingRatings, setSavingRatings] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, data] = await Promise.all([api.me(), api.getKnowMe(id)]);
      setSession(me);
      setRound((current) => {
        if (current && current.status === "open" && data.round.status !== "open") {
          setJustRevealed(true);
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

  /* Restore (or seed) the answering draft once the questions are known. */
  useEffect(() => {
    if (!round || round.mineSubmitted || draft !== null) return;
    let restored: KnowMeAnswerPair[] | null = null;
    try {
      const raw = localStorage.getItem(draftKey(round.id));
      if (raw) {
        const saved = JSON.parse(raw) as KnowMeAnswerPair[];
        if (
          Array.isArray(saved) &&
          saved.length === round.questions.length &&
          saved.every((p) => typeof p?.truth === "string" && typeof p?.guess === "string")
        ) {
          restored = saved;
        }
      }
    } catch {
      /* corrupt draft — start fresh */
    }
    setDraft(restored ?? emptyDraft(round.questions.length));
  }, [round, draft]);

  /* Seed the verdict toggles when the rating stage opens. */
  useEffect(() => {
    if (round && round.status === "answered" && !round.myRatings) {
      setVerdicts((v) =>
        v.length === round.questions.length ? v : round.questions.map(() => null)
      );
    }
  }, [round]);

  /* Poll while we're waiting on the other person. */
  const waitingOnPartner =
    round !== null &&
    ((round.status === "open" && round.mineSubmitted && !round.partnerSubmitted) ||
      (round.status === "answered" && round.myRatings !== null && round.partnerRatings === null));
  useEffect(() => {
    if (!waitingOnPartner) return;
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [waitingOnPartner, load]);

  const setField = (index: number, field: keyof KnowMeAnswerPair, value: string) => {
    setDraft((current) => {
      if (!current) return current;
      const next = current.map((pair, i) =>
        i === index ? { ...pair, [field]: value } : pair
      );
      try {
        localStorage.setItem(draftKey(id), JSON.stringify(next));
      } catch {
        /* storage full or blocked — typing still works */
      }
      return next;
    });
  };

  const complete = useMemo(
    () =>
      draft !== null &&
      draft.every((p) => p.truth.trim() !== "" && p.guess.trim() !== ""),
    [draft]
  );

  const submitAnswers = async () => {
    if (!draft || !complete) return;
    setSending(true);
    try {
      const { round: updated } = await api.submitKnowMeAnswers(
        id,
        draft.map((p) => ({ truth: p.truth.trim(), guess: p.guess.trim() }))
      );
      if (updated.status !== "open") setJustRevealed(true);
      setRound(updated);
      try {
        localStorage.removeItem(draftKey(id));
      } catch {
        /* ignore */
      }
      toast("Answers sent 💌");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't send — try again.", "error");
      load();
    } finally {
      setSending(false);
    }
  };

  const allJudged = verdicts.length > 0 && verdicts.every((v) => v !== null);

  const saveRatings = async () => {
    if (!allJudged) return;
    setSavingRatings(true);
    try {
      const { round: updated } = await api.rateKnowMe(id, verdicts as boolean[]);
      setRound(updated);
      toast("Verdicts saved ✨");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't save — try again.", "error");
      load();
    } finally {
      setSavingRatings(false);
    }
  };

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-4xl">🫥</span>
        <p className="text-soft">This round doesn&apos;t exist (or isn&apos;t yours).</p>
        <Link href="/knowme">
          <Button variant="soft">Back to Know Me</Button>
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
          <div className="flex flex-col gap-3 rounded-3xl bg-line/40 p-5">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </main>
      </div>
    );
  }

  const partnerName = session?.partner?.name ?? "your partner";
  const answering = round.status === "open" && !round.mineSubmitted;
  const waitingForSheets = round.status === "open" && round.mineSubmitted;
  const rating = round.status === "answered" && round.myRatings === null;
  const waitingForVerdicts = round.status === "answered" && round.myRatings !== null;
  const done = round.status === "completed";
  const revealVisible = (round.status !== "open" && round.myAnswers && round.partnerAnswers) != null &&
    round.myAnswers !== null && round.partnerAnswers !== null;

  return (
    <div className="min-h-dvh pb-12">
      <Header session={session} />
      <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-5">
        <Link
          href="/knowme"
          className="w-fit text-sm font-medium text-faint transition-colors hover:text-soft"
        >
          ← Know Me
        </Link>

        {/* Round header */}
        <Card className="animate-fade-up overflow-hidden">
          <div className="flex flex-col gap-3 bg-gradient-to-br from-dusk-soft to-accent-soft p-5">
            <div className="flex items-center justify-between">
              <Badge tone="dusk">💭 Know Me</Badge>
              {done ? (
                <Badge tone="soft">💞 Complete</Badge>
              ) : round.status === "answered" ? (
                <Badge tone="gold">Reveal</Badge>
              ) : (
                <Badge tone="line">Round in play</Badge>
              )}
            </div>
            <p className="font-display text-2xl font-bold leading-snug text-ink">
              {answering
                ? "Five questions, two answers each"
                : waitingForSheets
                  ? `Waiting on ${partnerName}`
                  : rating
                    ? "The reveal — judge their guesses"
                    : done
                      ? "The scores are in"
                      : `Waiting on ${partnerName}'s verdicts`}
            </p>
            <p className="text-xs text-soft">
              {round.starter.name} started this round ·{" "}
              {answering
                ? "your truth + your guess for each one"
                : done
                  ? "soulmate math complete"
                  : "guesses stay secret until you've both answered"}
            </p>
          </div>
        </Card>

        {/* ── Answering ─────────────────────────────────────── */}
        {answering && draft && (
          <div className="animate-fade-up flex flex-col gap-4">
            <ProgressDots draft={draft} />
            {round.questions.map((question, i) => (
              <Card key={i} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <QuestionBadge question={question} />
                  <span className="text-xs font-semibold text-faint">
                    {i + 1}/{round.questions.length}
                  </span>
                </div>
                <p className="font-display text-lg font-bold leading-snug text-ink">
                  {question}
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-soft">Your truth</span>
                  <TextInput
                    value={draft[i].truth}
                    maxLength={MAX_CHARS}
                    placeholder="The honest answer, about you"
                    onChange={(e) => setField(i, "truth", e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-soft">
                    Your guess about {partnerName}
                  </span>
                  <TextInput
                    value={draft[i].guess}
                    maxLength={MAX_CHARS}
                    placeholder={`What would ${partnerName} say?`}
                    onChange={(e) => setField(i, "guess", e.target.value)}
                  />
                </label>
              </Card>
            ))}
            <Button size="lg" onClick={submitAnswers} loading={sending} disabled={!complete}>
              {sending ? "Sending…" : complete ? "Send my answers" : "Answer all five to send"}
            </Button>
            <p className="text-center text-xs text-faint">
              {partnerName}&apos;s answers stay hidden until you&apos;ve both sent yours 🤫
            </p>
          </div>
        )}

        {/* ── Waiting for the partner's sheet ───────────────── */}
        {waitingForSheets && (
          <Card className="animate-fade-up flex items-center gap-3 p-4">
            <Avatar avatar={session?.partner?.avatar} name={partnerName} className="size-10" />
            <div className="flex-1">
              <p className="font-semibold text-ink">Waiting on {partnerName}…</p>
              <p className="text-sm text-soft">
                The moment they answer, the side-by-side reveal unlocks.
              </p>
            </div>
            <Spinner className="size-5 text-dusk" />
          </Card>
        )}

        {/* ── Reveal + rating / results ─────────────────────── */}
        {revealVisible && round.myAnswers && round.partnerAnswers && (
          <section className="flex flex-col gap-4" style={{ perspective: 1200 }}>
            {justRevealed && (
              <p className="animate-rise text-center font-display text-lg font-bold text-accent">
                ✨ The guesses are out in the open ✨
              </p>
            )}

            {/* Scoreboard on completed rounds */}
            {done && round.myScore !== null && round.partnerScore !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={spring.gentle}
                className="grid grid-cols-2 gap-3"
              >
                <Card className="flex flex-col items-center gap-1.5 p-4 text-center">
                  <span className="text-xs font-bold uppercase tracking-wide text-faint">
                    You
                  </span>
                  <span className="font-display text-3xl font-bold text-ink">
                    {round.myScore}/5
                  </span>
                  <ScoreHearts score={round.myScore} className="text-sm" />
                  <p className="text-xs font-semibold text-accent-deep">
                    {knowMeVerdict(round.myScore)}
                  </p>
                </Card>
                <Card className="flex flex-col items-center gap-1.5 p-4 text-center">
                  <span className="text-xs font-bold uppercase tracking-wide text-faint">
                    {partnerName}
                  </span>
                  <span className="font-display text-3xl font-bold text-ink">
                    {round.partnerScore}/5
                  </span>
                  <ScoreHearts score={round.partnerScore} className="text-sm" />
                  <p className="text-xs font-semibold text-accent-deep">
                    {knowMeVerdict(round.partnerScore)}
                  </p>
                </Card>
              </motion.div>
            )}
            {done && round.myScore !== null && round.partnerScore !== null && (
              <p className="text-center text-sm font-medium text-soft">
                {knowMePairVerdict(round.myScore, round.partnerScore)}
              </p>
            )}

            {rating && (
              <p className="text-center text-sm text-soft">
                For each question: did {partnerName} nail what you&apos;d say?
              </p>
            )}

            {round.questions.map((question, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, rotateX: -65, y: 28 }}
                animate={{ opacity: 1, rotateX: 0, y: 0 }}
                transition={{ ...spring.gentle, delay: 0.12 + i * 0.11 }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <Card className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <QuestionBadge question={question} />
                    <span className="text-xs font-semibold text-faint">
                      {i + 1}/{round.questions.length}
                    </span>
                  </div>
                  <p className="font-display text-lg font-bold leading-snug text-ink">
                    {question}
                  </p>

                  {/* Their guess about you, next to your truth — you judge this. */}
                  <GuessPair
                    guessLabel={`${partnerName} guessed`}
                    guess={round.partnerAnswers![i]?.guess ?? "—"}
                    truthLabel="Your truth"
                    truth={round.myAnswers![i]?.truth ?? "—"}
                    verdict={rating ? undefined : round.myRatings?.[i] ?? null}
                  />

                  {rating && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          setVerdicts((v) => v.map((x, j) => (j === i ? true : x)))
                        }
                        className={`h-10 rounded-full text-sm font-semibold transition-all active:scale-95 ${
                          verdicts[i] === true
                            ? "bg-accent text-white shadow-card"
                            : "bg-accent-soft/60 text-accent-deep hover:bg-accent-soft"
                        }`}
                      >
                        💘 Nailed it
                      </button>
                      <button
                        onClick={() =>
                          setVerdicts((v) => v.map((x, j) => (j === i ? false : x)))
                        }
                        className={`h-10 rounded-full text-sm font-semibold transition-all active:scale-95 ${
                          verdicts[i] === false
                            ? "bg-ink text-white shadow-card"
                            : "bg-line/60 text-soft hover:bg-line"
                        }`}
                      >
                        ❌ Not quite
                      </button>
                    </div>
                  )}

                  {/* Your guess next to their truth — they judge this one. */}
                  <GuessPair
                    guessLabel="You guessed"
                    guess={round.myAnswers![i]?.guess ?? "—"}
                    truthLabel={`${partnerName}'s truth`}
                    truth={round.partnerAnswers![i]?.truth ?? "—"}
                    verdict={round.partnerRatings ? round.partnerRatings[i] : null}
                  />
                </Card>
              </motion.div>
            ))}

            {rating && (
              <Button size="lg" onClick={saveRatings} loading={savingRatings} disabled={!allJudged}>
                {savingRatings
                  ? "Saving…"
                  : allJudged
                    ? "Save my verdicts"
                    : "Judge all five to save"}
              </Button>
            )}

            {waitingForVerdicts && (
              <Card className="flex items-center gap-3 p-4">
                <Avatar avatar={session?.partner?.avatar} name={partnerName} className="size-10" />
                <div className="flex-1">
                  <p className="font-semibold text-ink">
                    Waiting on {partnerName}&apos;s verdicts…
                  </p>
                  <p className="text-sm text-soft">
                    Your score appears once they&apos;ve judged your guesses.
                  </p>
                </div>
                <Spinner className="size-5 text-dusk" />
              </Card>
            )}

            {done && (
              <Link href="/knowme" className="w-full">
                <Button variant="soft" className="w-full">
                  Back to Know Me
                </Button>
              </Link>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
