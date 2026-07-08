import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { whereAmIToDTO } from "@/lib/serialize";
import { notifyWhereAmIStarted } from "@/lib/notify/notifications";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // pre-compressed client-side
const MAX_ANSWER = 80;
const MAX_HINT = 120;
const HINT_COUNT = 3;

/** GET /api/whereami — every Where Am I round in my room, newest first. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  try {
    const store = getStore();
    const rounds = await store.listWhereAmIRounds(session.room.id);
    const dtos = await Promise.all(
      rounds.map(async (round) => {
        const guesses = await store.listWhereAmIGuesses(round.id);
        return whereAmIToDTO(round, guesses, session);
      })
    );
    return NextResponse.json({ rounds: dtos });
  } catch (error) {
    console.error("listWhereAmI failed:", error);
    return NextResponse.json({ error: "Couldn't load rounds." }, { status: 500 });
  }
}

/**
 * POST /api/whereami — start a round. Multipart form:
 *   photo (jpeg blob), width, height, answer, hints (exactly 3 entries)
 * One live round per room at a time.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  try {
    const store = getStore();

    const rounds = await store.listWhereAmIRounds(session.room.id);
    if (rounds.some((r) => r.status === "waiting")) {
      return NextResponse.json(
        { error: "There's already a Where Am I round in play. Finish that one first!" },
        { status: 409 }
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
    }

    const photo = form.get("photo");
    const width = Math.round(Number(form.get("width")));
    const height = Math.round(Number(form.get("height")));
    const answer = String(form.get("answer") ?? "").trim();
    const hints = form
      .getAll("hints")
      .map((h) => String(h).trim());

    if (
      !(photo instanceof Blob) ||
      !(width > 0 && height > 0 && width <= 4000 && height <= 4000)
    ) {
      return NextResponse.json({ error: "Invalid photo." }, { status: 400 });
    }
    if (photo.size === 0 || photo.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "That photo is too large." }, { status: 413 });
    }
    if (!answer || answer.length > MAX_ANSWER) {
      return NextResponse.json(
        { error: "Give the place a name (up to 80 characters)." },
        { status: 400 }
      );
    }
    if (
      hints.length !== HINT_COUNT ||
      hints.some((h) => !h || h.length > MAX_HINT)
    ) {
      return NextResponse.json(
        { error: "Write all three hints (up to 120 characters each)." },
        { status: 400 }
      );
    }

    const id = randomUUID();
    const photoPath = `rooms/${session.room.id}/whereami/${id}/photo.jpg`;
    await store.saveFile(
      photoPath,
      new Uint8Array(await photo.arrayBuffer()),
      "image/jpeg"
    );

    const round = await store.createWhereAmIRound({
      id,
      roomId: session.room.id,
      creatorId: session.participant.id,
      photoPath,
      width,
      height,
      answer,
      hints,
    });

    await notifyWhereAmIStarted(
      session.room.id,
      session.participant.id,
      session.participant.name,
      round.id
    );

    return NextResponse.json(
      { round: whereAmIToDTO(round, [], session) },
      { status: 201 }
    );
  } catch (error) {
    console.error("createWhereAmI failed:", error);
    return NextResponse.json(
      { error: "Couldn't start the round. Try again." },
      { status: 500 }
    );
  }
}
