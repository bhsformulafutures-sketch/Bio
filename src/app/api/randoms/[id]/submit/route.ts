import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { randomToDTO } from "@/lib/serialize";
import { reconcileRandom } from "@/lib/games/random/service";
import { notifyRandomCompleted } from "@/lib/notify/notifications";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // pre-compressed client-side
const MAX_CAPTION = 140;

/**
 * POST /api/randoms/:id/submit — multipart form:
 *   photo (jpeg blob), width, height, caption (optional)
 * Records this person's answer. When both have answered, the challenge
 * completes and both people are notified.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;
  const store = getStore();

  const raw = await store.getRandom(id);
  if (!raw || raw.roomId !== session.room.id) {
    return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
  }
  const random = await reconcileRandom(raw);
  if (random.status !== "open") {
    return NextResponse.json(
      { error: "This challenge has closed — its 24 hours are up." },
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
  const caption = String(form.get("caption") ?? "").trim().slice(0, MAX_CAPTION) || null;

  if (
    !(photo instanceof Blob) ||
    !(width > 0 && height > 0 && width <= 4000 && height <= 4000)
  ) {
    return NextResponse.json({ error: "Invalid photo." }, { status: 400 });
  }
  if (photo.size === 0 || photo.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "That photo is too large." }, { status: 413 });
  }

  try {
    const photoPath = `rooms/${random.roomId}/randoms/${random.id}/${session.participant.id}.jpg`;
    await store.saveFile(
      photoPath,
      new Uint8Array(await photo.arrayBuffer()),
      "image/jpeg"
    );

    await store.addRandomSubmission({
      randomId: random.id,
      participantId: session.participant.id,
      photoPath,
      width,
      height,
      caption,
    });

    const submissions = await store.listRandomSubmissions(random.id);
    let current = random;
    if (submissions.length >= 2 && random.status === "open") {
      await store.markRandomCompleted(random.id);
      current = { ...random, status: "completed", completedAt: new Date().toISOString() };
      await notifyRandomCompleted(random.roomId);
    }

    return NextResponse.json({ random: randomToDTO(current, submissions, session) });
  } catch (error) {
    console.error("submitRandom failed:", error);
    return NextResponse.json(
      { error: "Couldn't save your photo. Check your connection and try again." },
      { status: 500 }
    );
  }
}
