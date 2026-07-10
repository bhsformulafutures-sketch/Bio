import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** DELETE /api/tracks/[id] — remove a track from the shared room player. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  const store = getStore();
  // Only allow removing tracks that belong to this room.
  const tracks = await store.listTracks(session.room.id);
  if (!tracks.some((t) => t.id === id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await store.deleteTrack(id);
  return NextResponse.json({ ok: true });
}
