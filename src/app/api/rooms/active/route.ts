import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getUser, setActiveRoom } from "@/lib/session";
import { sessionToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** POST /api/rooms/active { roomId } — switch which room this browser is in. */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No session" }, { status: 401 });

  let roomId = "";
  try {
    const body = await request.json();
    roomId = String(body?.roomId ?? "");
  } catch {
    /* fall through to validation */
  }
  if (!roomId) {
    return NextResponse.json({ error: "Missing roomId." }, { status: 400 });
  }

  try {
    const store = getStore();
    const membership = await store.getMembership(user.id, roomId);
    if (!membership) {
      return NextResponse.json({ error: "You're not in that room." }, { status: 404 });
    }
    const room = await store.getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: "That room no longer exists." }, { status: 404 });
    }
    const participants = await store.getRoomParticipants(roomId);
    const partner = participants.find((p) => p.id !== membership.id) ?? null;

    const dto = await sessionToDTO({ user, room, participant: membership, partner });
    const response = NextResponse.json(dto);
    setActiveRoom(response, roomId);
    return response;
  } catch (error) {
    console.error("switchRoom failed:", error);
    return NextResponse.json({ error: "Couldn't switch rooms." }, { status: 500 });
  }
}
