import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getUser, setActiveRoom } from "@/lib/session";
import { sessionToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** POST /api/room — create a room and become its first member. */
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!user.name.trim()) {
    return NextResponse.json({ error: "Finish your profile first." }, { status: 400 });
  }

  try {
    const store = getStore();
    const { room, participant } = await store.createRoom(user.id, user.name);
    const dto = await sessionToDTO({ user, room, participant, partner: null });
    const response = NextResponse.json(dto, { status: 201 });
    setActiveRoom(response, room.id);
    return response;
  } catch (error) {
    console.error("createRoom failed:", error);
    return NextResponse.json(
      { error: "Couldn't create the room. Please try again." },
      { status: 500 }
    );
  }
}
