import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { randomToDTO } from "@/lib/serialize";
import { pickPrompt } from "@/lib/games/random/prompts";
import { hasOpenRandom, reconcileRandom } from "@/lib/games/random/service";
import { notifyRandomStarted } from "@/lib/notify/notifications";

export const dynamic = "force-dynamic";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/** GET /api/randoms — every Random Challenge in my room, newest first. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  try {
    const store = getStore();
    const randoms = await store.listRandoms(session.room.id);
    const dtos = await Promise.all(
      randoms.map(async (raw) => {
        const random = await reconcileRandom(raw);
        const submissions = await store.listRandomSubmissions(random.id);
        return randomToDTO(random, submissions, session);
      })
    );
    return NextResponse.json({ randoms: dtos });
  } catch (error) {
    console.error("listRandoms failed:", error);
    return NextResponse.json({ error: "Couldn't load challenges." }, { status: 500 });
  }
}

/** POST /api/randoms — start a new Random Challenge with a surprise prompt. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  try {
    const store = getStore();

    if (await hasOpenRandom(session.room.id)) {
      return NextResponse.json(
        { error: "You've already got a Random Challenge running. Finish that one first!" },
        { status: 409 }
      );
    }

    // Avoid repeating the most recent prompts.
    const recent = (await store.listRandoms(session.room.id))
      .slice(0, 10)
      .map((r) => r.prompt);
    const prompt = pickPrompt(recent);

    const random = await store.createRandom({
      id: randomUUID(),
      roomId: session.room.id,
      starterId: session.participant.id,
      prompt: prompt.text,
      category: prompt.category,
      expiresAt: new Date(Date.now() + TWENTY_FOUR_HOURS_MS).toISOString(),
    });

    await notifyRandomStarted(
      session.room.id,
      session.participant.id,
      session.participant.name,
      random.prompt
    );

    return NextResponse.json(
      { random: randomToDTO(random, [], session) },
      { status: 201 }
    );
  } catch (error) {
    console.error("createRandom failed:", error);
    return NextResponse.json({ error: "Couldn't start a challenge. Try again." }, { status: 500 });
  }
}
