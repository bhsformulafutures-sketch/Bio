import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getUser, setActiveRoom } from "@/lib/session";
import { sessionToDTO } from "@/lib/serialize";
import { normalizeRoomCode, roomCodeError } from "@/lib/room-code";

export const dynamic = "force-dynamic";

/** POST /api/room { code } — create a room with your own chosen code. */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!user.name.trim()) {
    return NextResponse.json({ error: "Finish your profile first." }, { status: 400 });
  }

  let code = "";
  try {
    const body = await request.json();
    code = normalizeRoomCode(String(body?.code ?? ""));
  } catch {
    /* fall through to validation */
  }
  const codeProblem = roomCodeError(code);
  if (codeProblem) {
    return NextResponse.json({ error: codeProblem }, { status: 400 });
  }

  try {
    const store = getStore();
    const result = await store.createRoom(user.id, user.name, code);
    if (!result.ok) {
      return NextResponse.json(
        { error: "That code's already taken — try another." },
        { status: 409 }
      );
    }
    const dto = await sessionToDTO({
      user,
      room: result.room,
      participant: result.participant,
      partner: null,
    });
    const response = NextResponse.json(dto, { status: 201 });
    setActiveRoom(response, result.room.id);
    return response;
  } catch (error) {
    console.error("createRoom failed:", error);
    return NextResponse.json(
      { error: "Couldn't create the room. Please try again." },
      { status: 500 }
    );
  }
}
