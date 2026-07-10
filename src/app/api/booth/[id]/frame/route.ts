import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const MAX_FRAME_BYTES = 3 * 1024 * 1024;

/** POST /api/booth/[id]/frame — multipart: idx + frame (jpeg). Each device
 *  uploads its own shots; the strip is composited once all have landed. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  const store = getStore();
  const booth = await store.getBooth(id);
  if (!booth || booth.roomId !== session.room.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let frame: Blob | null = null;
  let idx = -1;
  try {
    const form = await request.formData();
    const entry = form.get("frame");
    if (entry instanceof Blob) frame = entry;
    idx = Number(form.get("idx"));
  } catch {
    /* handled below */
  }
  if (
    !frame ||
    frame.size === 0 ||
    frame.size > MAX_FRAME_BYTES ||
    !Number.isInteger(idx) ||
    idx < 0 ||
    idx >= booth.shots
  ) {
    return NextResponse.json({ error: "Invalid frame." }, { status: 400 });
  }

  const path = `rooms/${booth.roomId}/booths/${booth.id}/${session.participant.id}-${idx}.jpg`;
  await store.saveFile(path, new Uint8Array(await frame.arrayBuffer()), "image/jpeg");
  await store.addBoothFrame(booth.id, session.participant.id, idx, path);
  return NextResponse.json({ ok: true });
}
