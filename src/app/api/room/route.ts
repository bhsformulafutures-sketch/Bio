import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { attachSession } from "@/lib/session";
import { sessionToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** POST /api/room — create a room and become its first participant. */
export async function POST(request: NextRequest) {
  let name = "";
  try {
    const body = await request.json();
    name = String(body?.name ?? "").trim().slice(0, 30);
  } catch {
    /* fall through to validation */
  }
  if (!name) {
    return NextResponse.json({ error: "Please tell us your name." }, { status: 400 });
  }

  try {
    const { room, participant } = await getStore().createRoom(name);
    const response = NextResponse.json(
      sessionToDTO({ room, participant, partner: null }),
      { status: 201 }
    );
    await attachSession(response, participant.token);
    return response;
  } catch (error) {
    console.error("createRoom failed:", error);
    return NextResponse.json(
      { error: "Couldn't create the room. Please try again." },
      { status: 500 }
    );
  }
}
