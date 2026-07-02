import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAllTokens, writeSessionCookies } from "@/lib/session";
import { sessionToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** POST /api/rooms/active { roomId } — switch which room this browser is in. */
export async function POST(request: NextRequest) {
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

  const tokens = await getAllTokens();
  const store = getStore();
  try {
    for (const token of tokens) {
      const session = await store.getSessionByToken(token);
      if (session?.room.id === roomId) {
        const response = NextResponse.json(sessionToDTO(session));
        writeSessionCookies(response, tokens, token);
        return response;
      }
    }
  } catch (error) {
    console.error("switchRoom failed:", error);
    return NextResponse.json({ error: "Couldn't switch rooms." }, { status: 500 });
  }
  return NextResponse.json({ error: "You're not in that room." }, { status: 404 });
}
