import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { knowMeToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/knowme/:id — a single Know Me round, shaped for the viewer. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;
  try {
    const store = getStore();
    const round = await store.getKnowMeRound(id);
    if (!round || round.roomId !== session.room.id) {
      return NextResponse.json({ error: "Round not found." }, { status: 404 });
    }
    const answers = await store.listKnowMeAnswers(round.id);
    return NextResponse.json({ round: knowMeToDTO(round, answers, session) });
  } catch (error) {
    console.error("getKnowMe failed:", error);
    return NextResponse.json({ error: "Couldn't load the round." }, { status: 500 });
  }
}
