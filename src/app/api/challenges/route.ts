import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { challengeToDTO } from "@/lib/serialize";
import type { HiddenSide } from "@/lib/types";
import { SIDES } from "@/lib/region";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // uploads are pre-compressed client-side

/** GET /api/challenges — every challenge in my room, newest first. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  try {
    const challenges = await getStore().listChallenges(session.room.id);
    return NextResponse.json({
      challenges: challenges.map((c) => challengeToDTO(c, session)),
    });
  } catch (error) {
    console.error("listChallenges failed:", error);
    return NextResponse.json({ error: "Couldn't load challenges." }, { status: 500 });
  }
}

/**
 * POST /api/challenges — multipart form:
 *   original (jpeg blob), visible (jpeg blob, hidden area blanked),
 *   side, ratio, width, height
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const original = form.get("original");
  const visible = form.get("visible");
  const side = String(form.get("side") ?? "") as HiddenSide;
  const ratio = Number(form.get("ratio"));
  const width = Math.round(Number(form.get("width")));
  const height = Math.round(Number(form.get("height")));

  if (
    !(original instanceof Blob) ||
    !(visible instanceof Blob) ||
    !SIDES.includes(side) ||
    !(ratio >= 0.2 && ratio <= 0.6) ||
    !(width > 0 && height > 0 && width <= 4000 && height <= 4000)
  ) {
    return NextResponse.json({ error: "Invalid challenge data." }, { status: 400 });
  }
  if (original.size > MAX_IMAGE_BYTES || visible.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large." }, { status: 413 });
  }

  try {
    const store = getStore();
    const id = randomUUID();
    const base = `rooms/${session.room.id}/${id}`;
    const originalPath = `${base}/original.jpg`;
    const visiblePath = `${base}/visible.jpg`;

    await Promise.all([
      store.saveFile(originalPath, new Uint8Array(await original.arrayBuffer()), "image/jpeg"),
      store.saveFile(visiblePath, new Uint8Array(await visible.arrayBuffer()), "image/jpeg"),
    ]);

    const challenge = await store.createChallenge({
      id,
      roomId: session.room.id,
      creatorId: session.participant.id,
      hiddenSide: side,
      hiddenRatio: ratio,
      width,
      height,
      originalPath,
      visiblePath,
    });

    return NextResponse.json(
      { challenge: challengeToDTO(challenge, session) },
      { status: 201 }
    );
  } catch (error) {
    console.error("createChallenge failed:", error);
    return NextResponse.json(
      { error: "Upload failed. Check your connection and try again." },
      { status: 500 }
    );
  }
}
