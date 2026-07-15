import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { playerToDTO } from "@/lib/serialize";
import { notifyNowPlaying } from "@/lib/notify/notifications";

export const dynamic = "force-dynamic";

/** GET /api/player — the room's "on air" state. `serverNow` lets the client
 *  compute a clock offset so tune-in can join at the right elapsed time. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  const store = getStore();
  const state = await store.getPlayerState(session.room.id);
  const track = state ? await store.getTrack(state.trackId) : null;
  return NextResponse.json({
    player: state && track ? playerToDTO(state, track, session) : null,
    serverNow: new Date().toISOString(),
  });
}

/** PUT /api/player — press play: put a track on air for the whole room. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  let trackId: string;
  try {
    const body = (await req.json()) as { trackId?: string };
    trackId = String(body.trackId ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const store = getStore();
  const track = await store.getTrack(trackId);
  if (!track || track.roomId !== session.room.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const state = await store.setPlayerState(
    session.room.id,
    track.id,
    session.participant.id
  );
  await store.touch(session.participant.id);
  await notifyNowPlaying(
    session.room.id,
    session.participant.id,
    session.participant.name,
    track.title
  );
  return NextResponse.json({
    player: playerToDTO(state, track, session),
    serverNow: new Date().toISOString(),
  });
}

/** DELETE /api/player — stop the broadcast (either partner may). */
export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  await getStore().clearPlayerState(session.room.id);
  return NextResponse.json({ ok: true });
}
