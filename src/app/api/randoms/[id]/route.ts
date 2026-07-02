import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { randomToDTO } from "@/lib/serialize";
import { reconcileRandom } from "@/lib/games/random/service";

export const dynamic = "force-dynamic";

/** GET /api/randoms/:id — a single Random Challenge, shaped for the viewer. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;
  try {
    const store = getStore();
    const raw = await store.getRandom(id);
    if (!raw || raw.roomId !== session.room.id) {
      return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    }
    const random = await reconcileRandom(raw);
    const submissions = await store.listRandomSubmissions(random.id);
    return NextResponse.json({ random: randomToDTO(random, submissions, session) });
  } catch (error) {
    console.error("getRandom failed:", error);
    return NextResponse.json({ error: "Couldn't load the challenge." }, { status: 500 });
  }
}
