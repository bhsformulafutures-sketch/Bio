import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { whereAmIToDTO, WHEREAMI_MAX_GUESSES } from "@/lib/serialize";
import { matchesAnswer } from "@/lib/games/whereami/match";
import { notifyWhereAmIFinished } from "@/lib/notify/notifications";

export const dynamic = "force-dynamic";

const MAX_GUESS = 80;

/**
 * POST /api/whereami/:id/guess — { text }
 * Judges one guess server-side (the answer never travels to the guesser's
 * browser early). A wrong guess unlocks the next hint; the fourth wrong
 * guess ends the round and reveals the answer.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;

  try {
    const store = getStore();
    const round = await store.getWhereAmIRound(id);
    if (!round || round.roomId !== session.room.id) {
      return NextResponse.json({ error: "Round not found." }, { status: 404 });
    }
    if (round.creatorId === session.participant.id) {
      return NextResponse.json(
        { error: "You know exactly where you are — no guessing your own round!" },
        { status: 403 }
      );
    }
    if (round.status !== "waiting") {
      return NextResponse.json(
        { error: "This round is already over." },
        { status: 409 }
      );
    }

    let text = "";
    try {
      const body = (await request.json()) as { text?: unknown };
      text = String(body.text ?? "").trim();
    } catch {
      /* fall through to the empty-guess check */
    }
    if (!text || text.length > MAX_GUESS) {
      return NextResponse.json(
        { error: "Type a guess (up to 80 characters)." },
        { status: 400 }
      );
    }

    const before = await store.listWhereAmIGuesses(round.id);
    if (before.length >= WHEREAMI_MAX_GUESSES) {
      // Shouldn't happen (status flips on the 4th wrong guess), but never
      // hand out a 5th attempt on a stale record.
      return NextResponse.json(
        { error: "This round is already over." },
        { status: 409 }
      );
    }

    const correct = matchesAnswer(round.answer, text);
    await store.addWhereAmIGuess({
      roundId: round.id,
      participantId: session.participant.id,
      text,
      correct,
    });

    const guesses = await store.listWhereAmIGuesses(round.id);
    let current = round;
    const finished = correct || guesses.length >= WHEREAMI_MAX_GUESSES;
    if (finished) {
      const status = correct ? ("solved" as const) : ("revealed" as const);
      const completedAt = new Date().toISOString();
      await store.setWhereAmIStatus(round.id, status, completedAt);
      current = { ...round, status, completedAt };
      await notifyWhereAmIFinished(
        round.roomId,
        session.participant.id,
        session.participant.name,
        round.id,
        correct
      );
    }

    return NextResponse.json({ round: whereAmIToDTO(current, guesses, session) });
  } catch (error) {
    console.error("guessWhereAmI failed:", error);
    return NextResponse.json(
      { error: "Couldn't send your guess. Try again." },
      { status: 500 }
    );
  }
}
