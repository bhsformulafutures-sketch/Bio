import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { boothToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/booth/[id] — booth state plus the server clock for sync. */
export async function GET(
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
  const frames = await store.listBoothFrames(booth.id);
  return NextResponse.json({
    booth: boothToDTO(booth, frames, session),
    serverNow: Date.now(),
  });
}
