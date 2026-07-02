import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { challengeToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/challenges/:id — a single challenge, shaped for the viewer. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;
  try {
    const challenge = await getStore().getChallenge(id);
    if (!challenge || challenge.roomId !== session.room.id) {
      return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    }
    return NextResponse.json({ challenge: challengeToDTO(challenge, session) });
  } catch (error) {
    console.error("getChallenge failed:", error);
    return NextResponse.json({ error: "Couldn't load the challenge." }, { status: 500 });
  }
}
