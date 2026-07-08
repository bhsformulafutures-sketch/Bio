import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { whereAmIToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/whereami/:id — one round, shaped for this viewer. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;

  try {
    const store = getStore();
    const round = await store.getWhereAmIRound(id);
    if (!round || round.roomId !== session.room.id) {
      return NextResponse.json({ error: "Round not found." }, { status: 404 });
    }
    const guesses = await store.listWhereAmIGuesses(round.id);
    return NextResponse.json({ round: whereAmIToDTO(round, guesses, session) });
  } catch (error) {
    console.error("getWhereAmI failed:", error);
    return NextResponse.json({ error: "Couldn't load the round." }, { status: 500 });
  }
}
