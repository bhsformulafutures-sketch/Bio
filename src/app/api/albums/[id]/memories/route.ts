import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Validate session + album ownership + that the challenge is a completed
 *  memory in the same room. Returns the ids or an error payload. */
async function validate(albumId: string, challengeId: string) {
  const session = await getSession();
  if (!session) return { error: "No session" as const, status: 401 };
  const store = getStore();
  const album = await store.getAlbum(albumId);
  if (!album || album.roomId !== session.room.id) {
    return { error: "Album not found." as const, status: 404 };
  }
  if (!challengeId) {
    return { error: "Missing memory." as const, status: 400 };
  }
  const challenge = await store.getChallenge(challengeId);
  if (!challenge || challenge.roomId !== session.room.id) {
    return { error: "Memory not found." as const, status: 404 };
  }
  if (challenge.status !== "completed") {
    return { error: "Only completed memories can be filed." as const, status: 400 };
  }
  return { store };
}

async function readChallengeId(request: NextRequest): Promise<string> {
  try {
    const body = await request.json();
    return String(body?.challengeId ?? "").trim();
  } catch {
    return "";
  }
}

/** POST /api/albums/:id/memories — add a memory. Body: { challengeId }. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const challengeId = await readChallengeId(request);
  const result = await validate(id, challengeId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  try {
    await result.store.addMemoryToAlbum(id, challengeId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("addMemoryToAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't add to the album." }, { status: 500 });
  }
}

/** DELETE /api/albums/:id/memories — remove a memory. Body: { challengeId }. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const challengeId = await readChallengeId(request);
  const result = await validate(id, challengeId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  try {
    await result.store.removeMemoryFromAlbum(id, challengeId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("removeMemoryFromAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't remove from the album." }, { status: 500 });
  }
}
