import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { boothToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** How long after both cameras are ready the synchronized countdown begins. */
const START_DELAY_MS = 6_000;

/** POST /api/booth/[id]/ready — my camera is live; start when both are. */
export async function POST(
  _req: Request,
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
  await store.touch(session.participant.id);

  // Both room participants must be camera-ready before the countdown anchors.
  const requiredIds = [session.participant.id];
  if (session.partner) requiredIds.push(session.partner.id);

  const updated = await store.readyBooth(
    booth.id,
    session.participant.id,
    requiredIds,
    START_DELAY_MS
  );
  const target = updated ?? booth;
  const frames = await store.listBoothFrames(target.id);
  return NextResponse.json({
    booth: boothToDTO(target, frames, session),
    serverNow: Date.now(),
  });
}
