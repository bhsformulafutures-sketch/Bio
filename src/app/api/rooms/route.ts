import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAllTokens, SESSION_COOKIE, writeSessionCookies } from "@/lib/session";
import { cookies } from "next/headers";
import type { RoomSummaryDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/rooms — every room this browser belongs to, active first.
 * Dead tokens (deleted rooms) are pruned from the cookie as a side effect.
 */
export async function GET() {
  const tokens = await getAllTokens();
  if (tokens.length === 0) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const jar = await cookies();
  const activeToken = jar.get(SESSION_COOKIE)?.value ?? null;
  const store = getStore();

  const rooms: RoomSummaryDTO[] = [];
  const liveTokens: string[] = [];
  let liveActiveToken: string | null = null;

  try {
    for (const token of tokens) {
      const session = await store.getSessionByToken(token);
      if (!session) continue; // room was deleted — drop the token
      liveTokens.push(token);
      const active = token === activeToken;
      if (active) liveActiveToken = token;
      rooms.push({
        id: session.room.id,
        code: session.room.code,
        createdAt: session.room.createdAt,
        myName: session.participant.name,
        partnerName: session.partner?.name ?? null,
        active,
      });
    }
  } catch (error) {
    console.error("listRooms failed:", error);
    return NextResponse.json({ error: "Couldn't load your rooms." }, { status: 500 });
  }

  if (rooms.length === 0) {
    const response = NextResponse.json({ error: "No session" }, { status: 401 });
    writeSessionCookies(response, [], null);
    return response;
  }

  // If the active room disappeared, fall back to the first live one.
  if (!liveActiveToken) {
    liveActiveToken = liveTokens[0];
    rooms[0] = { ...rooms[0], active: true };
  }

  const response = NextResponse.json({ rooms });
  writeSessionCookies(response, liveTokens, liveActiveToken);
  return response;
}
