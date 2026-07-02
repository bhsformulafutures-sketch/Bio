import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getUser, setActiveRoom } from "@/lib/session";
import { sessionToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** POST /api/room/join { code } — join an existing room by its code. */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!user.name.trim()) {
    return NextResponse.json({ error: "Finish your profile first." }, { status: 400 });
  }

  let code = "";
  try {
    const body = await request.json();
    code = String(body?.code ?? "").trim().toUpperCase().replace(/\s/g, "");
  } catch {
    /* fall through to validation */
  }
  if (!code) {
    return NextResponse.json({ error: "Enter a room code." }, { status: 400 });
  }

  try {
    const store = getStore();

    // Already in this room? Just switch to it.
    const memberships = await store.listMemberships(user.id);
    for (const m of memberships) {
      const room = await store.getRoom(m.roomId);
      if (room?.code === code) {
        const participants = await store.getRoomParticipants(room.id);
        const partner = participants.find((p) => p.id !== m.id) ?? null;
        const dto = await sessionToDTO({ user, room, participant: m, partner });
        const response = NextResponse.json(dto, { status: 200 });
        setActiveRoom(response, room.id);
        return response;
      }
    }

    const result = await store.joinRoom(code, user.id, user.name);
    if (!result.ok) {
      const message =
        result.reason === "not_found"
          ? "That room code doesn't exist. Double-check it?"
          : result.reason === "already_in"
            ? "You're already in that room."
            : "This room already has its two people.";
      const status =
        result.reason === "not_found" ? 404 : result.reason === "already_in" ? 409 : 409;
      return NextResponse.json({ error: message }, { status });
    }

    const participants = await store.getRoomParticipants(result.room.id);
    const partner = participants.find((p) => p.id !== result.participant.id) ?? null;
    const dto = await sessionToDTO({
      user,
      room: result.room,
      participant: result.participant,
      partner,
    });
    const response = NextResponse.json(dto, { status: 200 });
    setActiveRoom(response, result.room.id);
    return response;
  } catch (error) {
    console.error("joinRoom failed:", error);
    return NextResponse.json(
      { error: "Couldn't join the room. Please try again." },
      { status: 500 }
    );
  }
}
