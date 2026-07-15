import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** DELETE /api/tracks/[id] — remove a track from the room radio.
 *  Queue tracks can be removed by either partner; a dedication only by
 *  the person who sent it. */
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
  const track = await store.getTrack(id);
  if (!track || track.roomId !== session.room.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (track.kind === "dedication" && track.addedById !== session.participant.id) {
    return NextResponse.json(
      { error: "Only the sender can take back a dedication." },
      { status: 403 }
    );
  }
  await store.deleteTrack(id);
  if (track.notePath) {
    // Cleanup, not correctness — an orphaned note never breaks anything.
    await store.deleteFile(track.notePath).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
