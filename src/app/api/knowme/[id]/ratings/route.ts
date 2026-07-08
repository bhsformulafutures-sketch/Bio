import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { knowMeToDTO } from "@/lib/serialize";
import { KNOWME_ROUND_SIZE } from "@/lib/games/knowme/questions";

export const dynamic = "force-dynamic";

/** Validate the verdicts: exactly 5 booleans. */
function parseRatings(body: unknown): boolean[] | null {
  const ratings = (body as { ratings?: unknown })?.ratings;
  if (!Array.isArray(ratings) || ratings.length !== KNOWME_ROUND_SIZE) return null;
  if (!ratings.every((r) => typeof r === "boolean")) return null;
  return ratings as boolean[];
}

/** POST /api/knowme/:id/ratings — rate the partner's guesses about me. */
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
    if (round.status === "open") {
      return NextResponse.json(
        { error: "Ratings open once you've both answered." },
        { status: 409 }
      );
    }

    const answers = await store.listKnowMeAnswers(round.id);
    const mine = answers.find((a) => a.participantId === session.participant.id);
    if (!mine) {
      return NextResponse.json(
        { error: "Send your answers before rating." },
        { status: 409 }
      );
    }
    if (mine.ratings) {
      return NextResponse.json(
        { error: "You've already rated this round." },
        { status: 409 }
      );
    }

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      /* fall through to validation */
    }
    const ratings = parseRatings(body);
    if (!ratings) {
      return NextResponse.json(
        { error: "Give a verdict on all five guesses." },
        { status: 400 }
      );
    }

    await store.saveKnowMeRatings(round.id, session.participant.id, ratings);

    // Both rated? The round is complete.
    const all = await store.listKnowMeAnswers(round.id);
    let updated = round;
    if (all.length >= 2 && all.every((a) => a.ratings !== null)) {
      const completedAt = new Date().toISOString();
      await store.setKnowMeStatus(round.id, "completed", completedAt);
      updated = { ...round, status: "completed", completedAt };
    }

    return NextResponse.json({ round: knowMeToDTO(updated, all, session) });
  } catch (error) {
    console.error("rateKnowMe failed:", error);
    return NextResponse.json({ error: "Couldn't save your ratings. Try again." }, { status: 500 });
  }
}
