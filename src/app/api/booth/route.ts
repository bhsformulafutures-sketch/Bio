import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { boothToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const DEFAULT_SHOTS = 4;
const MIN_SHOTS = 3;
const MAX_SHOTS = 6;

/** POST /api/booth — start a photobooth (needs both partners in the room). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  if (!session.partner) {
    return NextResponse.json(
      { error: "Your partner needs to join the room first." },
      { status: 409 }
    );
  }

  let shots = DEFAULT_SHOTS;
  try {
    const body = await req.json();
    if (typeof body?.shots === "number") shots = body.shots;
  } catch {
    /* default shots */
  }
  shots = Math.max(MIN_SHOTS, Math.min(MAX_SHOTS, Math.round(shots)));

  const store = getStore();
  await store.touch(session.participant.id);
  const booth = await store.createBooth(
    session.room.id,
    session.participant.id,
    shots
  );
  const frames = await store.listBoothFrames(booth.id);
  return NextResponse.json({
    booth: boothToDTO(booth, frames, session),
    serverNow: Date.now(),
  });
}
