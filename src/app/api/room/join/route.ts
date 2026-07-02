import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { attachSession, getAllTokens } from "@/lib/session";
import { sessionToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** POST /api/room/join — join an existing room by code. */
export async function POST(request: NextRequest) {
  let name = "";
  let code = "";
  try {
    const body = await request.json();
    name = String(body?.name ?? "").trim().slice(0, 30);
    code = String(body?.code ?? "").trim().toUpperCase().replace(/\s/g, "");
  } catch {
    /* fall through to validation */
  }
  if (!name || !code) {
    return NextResponse.json(
      { error: "A name and a room code are both needed." },
      { status: 400 }
    );
  }

  try {
    const store = getStore();

    // Already a member of this room from this browser? Just switch to it —
    // don't become your own partner.
    for (const token of await getAllTokens()) {
      const existing = await store.getSessionByToken(token);
      if (existing?.room.code === code) {
        const response = NextResponse.json(sessionToDTO(existing), { status: 200 });
        await attachSession(response, token);
        return response;
      }
    }

    const result = await store.joinRoom(code, name);
    if (!result.ok) {
      const message =
        result.reason === "not_found"
          ? "That room code doesn't exist. Double-check it?"
          : "This room already has its two people.";
      return NextResponse.json({ error: message }, { status: result.reason === "not_found" ? 404 : 409 });
    }
    const session = await store.getSessionByToken(result.participant.token);
    const response = NextResponse.json(
      sessionToDTO(session ?? { room: result.room, participant: result.participant, partner: null }),
      { status: 200 }
    );
    await attachSession(response, result.participant.token);
    return response;
  } catch (error) {
    console.error("joinRoom failed:", error);
    return NextResponse.json(
      { error: "Couldn't join the room. Please try again." },
      { status: 500 }
    );
  }
}
