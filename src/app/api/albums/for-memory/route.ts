import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/albums/for-memory?kind=challenge&id=<memoryId>
 * Returns the ids of albums in my room that already contain this memory —
 * drives the checkmarks in the "add to album" sheet.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const kind = request.nextUrl.searchParams.get("kind");
  const memoryId = request.nextUrl.searchParams.get("id") ?? "";
  if (kind !== "challenge" && kind !== "random") {
    return NextResponse.json({ error: "Unknown memory type." }, { status: 400 });
  }

  try {
    const albumIds = await getStore().albumIdsForMemory(session.room.id, kind, memoryId);
    return NextResponse.json({ albumIds });
  } catch (error) {
    console.error("albumIdsForMemory failed:", error);
    return NextResponse.json({ error: "Couldn't load albums." }, { status: 500 });
  }
}
