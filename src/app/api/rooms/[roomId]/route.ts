import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAllTokens, SESSION_COOKIE, writeSessionCookies } from "@/lib/session";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/rooms/:roomId — permanently delete a room you belong to,
 * including every photo, drawing and memory, for both people.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const tokens = await getAllTokens();
  const store = getStore();

  try {
    let memberToken: string | null = null;
    const otherTokens: string[] = [];
    for (const token of tokens) {
      const session = await store.getSessionByToken(token);
      if (!session) continue;
      if (session.room.id === roomId) memberToken = token;
      else otherTokens.push(token);
    }
    if (!memberToken) {
      return NextResponse.json({ error: "You're not in that room." }, { status: 404 });
    }

    await store.deleteRoom(roomId);

    // If the deleted room was active, hop to the next room (or sign out).
    const jar = await cookies();
    const activeToken = jar.get(SESSION_COOKIE)?.value;
    const nextActive =
      activeToken && activeToken !== memberToken ? activeToken : otherTokens[0] ?? null;

    const response = NextResponse.json({ ok: true, hasRooms: otherTokens.length > 0 });
    writeSessionCookies(response, otherTokens, nextActive);
    return response;
  } catch (error) {
    console.error("deleteRoom failed:", error);
    return NextResponse.json(
      { error: "Couldn't delete the room. Please try again." },
      { status: 500 }
    );
  }
}
