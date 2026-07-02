import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sessionToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/me — who am I, which room, who's my partner. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  return NextResponse.json(sessionToDTO(session));
}
