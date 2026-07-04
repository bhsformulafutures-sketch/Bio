import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import type { MemoryKind } from "@/lib/types";
import type { SessionRecord } from "@/lib/store/types";

export const dynamic = "force-dynamic";

async function loadOwnedAlbum(id: string, session: SessionRecord) {
  const album = await getStore().getAlbum(id);
  if (!album || album.roomId !== session.room.id) return null;
  return album;
}

/** Parse and validate the { kind, memoryId } body, confirming the memory
 *  really lives in the viewer's room. */
async function readMemoryRef(
  request: NextRequest,
  session: SessionRecord
): Promise<{ kind: MemoryKind; memoryId: string } | { error: string; status: number }> {
  let body: { kind?: string; memoryId?: string };
  try {
    body = (await request.json()) as { kind?: string; memoryId?: string };
  } catch {
    return { error: "Invalid request.", status: 400 };
  }
  const kind = body.kind;
  const memoryId = String(body.memoryId ?? "");
  if (kind !== "challenge" && kind !== "random") {
    return { error: "Unknown memory type.", status: 400 };
  }
  const store = getStore();
  if (kind === "challenge") {
    const c = await store.getChallenge(memoryId);
    if (!c || c.roomId !== session.room.id || c.status !== "completed") {
      return { error: "That memory isn't ready yet.", status: 400 };
    }
  } else {
    const r = await store.getRandom(memoryId);
    if (!r || r.roomId !== session.room.id || r.status === "open") {
      return { error: "That memory isn't ready yet.", status: 400 };
    }
  }
  return { kind, memoryId };
}

/** POST /api/albums/[id]/items — add a memory to the album. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });
  const { id } = await params;

  const album = await loadOwnedAlbum(id, session);
  if (!album) return NextResponse.json({ error: "Album not found." }, { status: 404 });

  const ref = await readMemoryRef(request, session);
  if ("error" in ref) return NextResponse.json({ error: ref.error }, { status: ref.status });

  try {
    await getStore().addAlbumItem(album.id, ref.kind, ref.memoryId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("addAlbumItem failed:", error);
    return NextResponse.json({ error: "Couldn't add to the album." }, { status: 500 });
  }
}

/** DELETE /api/albums/[id]/items — remove a memory from the album. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });
  const { id } = await params;

  const album = await loadOwnedAlbum(id, session);
  if (!album) return NextResponse.json({ error: "Album not found." }, { status: 404 });

  let body: { kind?: string; memoryId?: string };
  try {
    body = (await request.json()) as { kind?: string; memoryId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const kind = body.kind;
  const memoryId = String(body.memoryId ?? "");
  if (kind !== "challenge" && kind !== "random") {
    return NextResponse.json({ error: "Unknown memory type." }, { status: 400 });
  }

  try {
    await getStore().removeAlbumItem(album.id, kind, memoryId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("removeAlbumItem failed:", error);
    return NextResponse.json({ error: "Couldn't update the album." }, { status: 500 });
  }
}
