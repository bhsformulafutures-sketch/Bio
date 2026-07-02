import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStore } from "@/lib/store";
import { getUser, ROOM_COOKIE } from "@/lib/session";
import type { RoomSummaryDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/rooms — every room this person belongs to, active first. */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No session" }, { status: 401 });

  const store = getStore();
  const jar = await cookies();
  const activeRoomId = jar.get(ROOM_COOKIE)?.value ?? null;

  try {
    const memberships = await store.listMemberships(user.id);
    if (memberships.length === 0) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }

    const rooms: RoomSummaryDTO[] = [];
    for (const membership of memberships) {
      const room = await store.getRoom(membership.roomId);
      if (!room) continue;
      const participants = await store.getRoomParticipants(room.id);
      const partner = participants.find((p) => p.id !== membership.id) ?? null;
      rooms.push({
        id: room.id,
        code: room.code,
        createdAt: room.createdAt,
        myName: membership.name,
        partnerName: partner?.name ?? null,
        active: room.id === activeRoomId,
      });
    }

    // If nothing is marked active (fresh cookie), highlight the first room.
    if (!rooms.some((r) => r.active) && rooms[0]) rooms[0].active = true;

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("listRooms failed:", error);
    return NextResponse.json({ error: "Couldn't load your rooms." }, { status: 500 });
  }
}
