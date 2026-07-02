import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStore } from "@/lib/store";
import { getUser, ROOM_COOKIE, setActiveRoom } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/rooms/:roomId — permanently delete a room you belong to,
 * including every photo, drawing and memory, for both people.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { roomId } = await params;
  const store = getStore();

  try {
    const membership = await store.getMembership(user.id, roomId);
    if (!membership) {
      return NextResponse.json({ error: "You're not in that room." }, { status: 404 });
    }

    await store.deleteRoom(roomId);

    // Move to another room if the deleted one was active.
    const remaining = await store.listMemberships(user.id);
    const jar = await cookies();
    const activeRoomId = jar.get(ROOM_COOKIE)?.value;
    const nextActive =
      activeRoomId && activeRoomId !== roomId
        ? activeRoomId
        : remaining[0]?.roomId ?? null;

    const response = NextResponse.json({ ok: true, hasRooms: remaining.length > 0 });
    if (nextActive) setActiveRoom(response, nextActive);
    else response.cookies.set(ROOM_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("deleteRoom failed:", error);
    return NextResponse.json(
      { error: "Couldn't delete the room. Please try again." },
      { status: 500 }
    );
  }
}
