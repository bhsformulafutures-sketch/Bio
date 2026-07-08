import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { knowMeToDTO } from "@/lib/serialize";
import { pickKnowMeQuestions } from "@/lib/games/knowme/questions";
import { hasLiveKnowMe, recentKnowMeQuestions } from "@/lib/games/knowme/service";
import { notifyKnowMeStarted } from "@/lib/notify/notifications";

export const dynamic = "force-dynamic";

/** GET /api/knowme — every Know Me round in my room, newest first. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  try {
    const store = getStore();
    const rounds = await store.listKnowMeRounds(session.room.id);
    const dtos = await Promise.all(
      rounds.map(async (round) => {
        const answers = await store.listKnowMeAnswers(round.id);
        return knowMeToDTO(round, answers, session);
      })
    );
    return NextResponse.json({ rounds: dtos });
  } catch (error) {
    console.error("listKnowMe failed:", error);
    return NextResponse.json({ error: "Couldn't load your rounds." }, { status: 500 });
  }
}

/** POST /api/knowme — start a new round with five fresh questions. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  try {
    const store = getStore();

    const existing = await store.listKnowMeRounds(session.room.id);
    if (hasLiveKnowMe(existing)) {
      return NextResponse.json(
        { error: "You've already got a Know Me round going. Finish that one first!" },
        { status: 409 }
      );
    }

    // Don't repeat questions from the room's last few rounds.
    const recent = await recentKnowMeQuestions(session.room.id);
    const questions = pickKnowMeQuestions(recent);

    const round = await store.createKnowMeRound({
      id: randomUUID(),
      roomId: session.room.id,
      starterId: session.participant.id,
      questions,
    });

    await notifyKnowMeStarted(
      session.room.id,
      session.participant.id,
      session.participant.name
    );

    return NextResponse.json(
      { round: knowMeToDTO(round, [], session) },
      { status: 201 }
    );
  } catch (error) {
    console.error("startKnowMe failed:", error);
    return NextResponse.json({ error: "Couldn't start a round. Try again." }, { status: 500 });
  }
}
