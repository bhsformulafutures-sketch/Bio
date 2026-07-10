import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { boothToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/booths — completed photobooth strips for the room gallery. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  const store = getStore();
  const booths = await store.listBooths(session.room.id);
  const dtos = await Promise.all(
    booths.map(async (b) =>
      boothToDTO(b, await store.listBoothFrames(b.id), session)
    )
  );
  return NextResponse.json({ booths: dtos });
}
