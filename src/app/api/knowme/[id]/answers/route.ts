import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { knowMeToDTO } from "@/lib/serialize";
import { KNOWME_ROUND_SIZE } from "@/lib/games/knowme/questions";
import { notifyKnowMeAnswered } from "@/lib/notify/notifications";

export const dynamic = "force-dynamic";

const MAX_ANSWER_CHARS = 120;

/** Validate the submitted sheet: 5 pairs of non-empty, short, trimmed strings. */
function parseAnswers(body: unknown): { truth: string; guess: string }[] | null {
  const answers = (body as { answers?: unknown })?.answers;
  if (!Array.isArray(answers) || answers.length !== KNOWME_ROUND_SIZE) return null;
  const clean: { truth: string; guess: string }[] = [];
  for (const item of answers) {
    const truth = typeof (item as { truth?: unknown })?.truth === "string"
      ? (item as { truth: string }).truth.trim()
      : "";
    const guess = typeof (item as { guess?: unknown })?.guess === "string"
      ? (item as { guess: string }).guess.trim()
      : "";
    if (!truth || !guess) return null;
    if (truth.length > MAX_ANSWER_CHARS || guess.length > MAX_ANSWER_CHARS) return null;
    clean.push({ truth, guess });
  }
  return clean;
}

/** POST /api/knowme/:id/answers — submit my truths + guesses for a round. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;
  try {
    const store = getStore();
    const round = await store.getKnowMeRound(id);
    if (!round || round.roomId !== session.room.id) {
      return NextResponse.json({ error: "Round not found." }, { status: 404 });
    }
    if (round.status !== "open") {
      return NextResponse.json(
        { error: "This round is already past the answering stage." },
        { status: 409 }
      );
    }

    const existing = await store.listKnowMeAnswers(round.id);
    if (existing.some((a) => a.participantId === session.participant.id)) {
      return NextResponse.json(
        { error: "You've already sent your answers for this round." },
        { status: 409 }
      );
    }

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      /* fall through to validation */
    }
    const answers = parseAnswers(body);
    if (!answers) {
      return NextResponse.json(
        { error: `Every question needs a truth and a guess (max ${MAX_ANSWER_CHARS} characters each).` },
        { status: 400 }
      );
    }

    await store.upsertKnowMeAnswer({
      roundId: round.id,
      participantId: session.participant.id,
      answers,
    });

    // Both sheets in? Flip to the reveal stage.
    const all = await store.listKnowMeAnswers(round.id);
    let updated = round;
    if (all.length >= 2) {
      await store.setKnowMeStatus(round.id, "answered");
      updated = { ...round, status: "answered" };
      await notifyKnowMeAnswered(session.room.id);
    }

    return NextResponse.json({ round: knowMeToDTO(updated, all, session) });
  } catch (error) {
    console.error("submitKnowMeAnswers failed:", error);
    return NextResponse.json({ error: "Couldn't send your answers. Try again." }, { status: 500 });
  }
}
