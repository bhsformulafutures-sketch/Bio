import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { challengeToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const MAX_MERGED_BYTES = 4 * 1024 * 1024;

/**
 * POST /api/challenges/:id/merged — multipart form: merged (jpeg blob).
 * The merge (original + transparent drawing) is composited client-side,
 * deterministically. Either participant may backfill it if the first
 * upload was interrupted.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;
  const store = getStore();
  const challenge = await store.getChallenge(id);
  if (!challenge || challenge.roomId !== session.room.id) {
    return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
  }
  if (challenge.status !== "completed") {
    return NextResponse.json({ error: "Not completed yet." }, { status: 409 });
  }

  let merged: Blob | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("merged");
    if (entry instanceof Blob) merged = entry;
  } catch {
    /* handled below */
  }
  if (!merged || merged.size === 0 || merged.size > MAX_MERGED_BYTES) {
    return NextResponse.json({ error: "Invalid merged image." }, { status: 400 });
  }

  try {
    const mergedPath = `rooms/${challenge.roomId}/${challenge.id}/merged.jpg`;
    await store.saveFile(
      mergedPath,
      new Uint8Array(await merged.arrayBuffer()),
      "image/jpeg"
    );
    await store.setMergedPath(id, mergedPath);
    const updated = await store.getChallenge(id);
    return NextResponse.json({
      challenge: updated ? challengeToDTO(updated, session) : undefined,
    });
  } catch (error) {
    console.error("saveMerged failed:", error);
    return NextResponse.json({ error: "Couldn't save the merged image." }, { status: 500 });
  }
}
