import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { boothToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const MAX_STRIP_BYTES = 8 * 1024 * 1024;

/** POST /api/booth/[id]/strip — multipart: strip (jpeg). The initiator
 *  composites the finished strip client-side and uploads it here. */
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

  let strip: Blob | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("strip");
    if (entry instanceof Blob) strip = entry;
  } catch {
    /* handled below */
  }
  if (!strip || strip.size === 0 || strip.size > MAX_STRIP_BYTES) {
    return NextResponse.json({ error: "Invalid strip." }, { status: 400 });
  }

  const path = `rooms/${booth.roomId}/booths/${booth.id}/strip.jpg`;
  await store.saveFile(path, new Uint8Array(await strip.arrayBuffer()), "image/jpeg");
  await store.setBoothStrip(booth.id, path);
  const updated = (await store.getBooth(booth.id)) ?? booth;
  const frames = await store.listBoothFrames(booth.id);
  return NextResponse.json({ booth: boothToDTO(updated, frames, session) });
}
