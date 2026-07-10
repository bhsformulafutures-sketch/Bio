import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sessionToDTO } from "@/lib/serialize";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** GET /api/me — who am I, which room, who's my partner. 401 when not in a room.
 *  Doubles as the presence heartbeat: each poll marks me active. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  await getStore().touch(session.participant.id);
  return NextResponse.json(await sessionToDTO(session));
}
