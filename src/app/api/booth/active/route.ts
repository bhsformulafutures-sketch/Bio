import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { boothToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/booth/active — the room's current pending/live booth, if any. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  const store = getStore();
  const booth = await store.getActiveBooth(session.room.id);
  if (!booth) return NextResponse.json({ booth: null });
  const frames = await store.listBoothFrames(booth.id);
  return NextResponse.json({
    booth: boothToDTO(booth, frames, session),
    serverNow: Date.now(),
  });
}
