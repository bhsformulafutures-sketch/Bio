import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { challengeToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const MAX_DRAWING_BYTES = 8 * 1024 * 1024; // transparent PNGs can be chunky

/**
 * POST /api/challenges/:id/complete — multipart form: drawing (png blob).
 * Atomically completes the challenge; the response finally includes the
 * original photo so the client can run the reveal and build the merge.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;
  const store = getStore();

  const challenge = await store.getChallenge(id);
  if (!challenge || challenge.roomId !== session.room.id) {
    return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
  }
  if (challenge.creatorId === session.participant.id) {
    return NextResponse.json(
      { error: "You can't answer your own challenge — that's cheating!" },
      { status: 403 }
    );
  }
  if (challenge.status !== "waiting") {
    return NextResponse.json(
      { error: "This one has already been completed.", challenge: challengeToDTO(challenge, session) },
      { status: 409 }
    );
  }

  let drawing: Blob | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("drawing");
    if (entry instanceof Blob) drawing = entry;
  } catch {
    /* handled below */
  }
  if (!drawing || drawing.size === 0 || drawing.size > MAX_DRAWING_BYTES) {
    return NextResponse.json({ error: "Invalid drawing upload." }, { status: 400 });
  }

  try {
    const drawingPath = `rooms/${challenge.roomId}/${challenge.id}/drawing.png`;
    await store.saveFile(
      drawingPath,
      new Uint8Array(await drawing.arrayBuffer()),
      "image/png"
    );

    const result = await store.completeChallenge(
      id,
      session.participant.id,
      drawingPath
    );
    if (result === "conflict") {
      const current = await store.getChallenge(id);
      return NextResponse.json(
        {
          error: "This one has already been completed.",
          challenge: current ? challengeToDTO(current, session) : undefined,
        },
        { status: 409 }
      );
    }
    if (!result) {
      return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    }
    return NextResponse.json({ challenge: challengeToDTO(result, session) });
  } catch (error) {
    console.error("completeChallenge failed:", error);
    return NextResponse.json(
      { error: "Couldn't submit your drawing. It's saved locally — try again." },
      { status: 500 }
    );
  }
}
