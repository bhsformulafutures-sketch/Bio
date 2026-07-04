import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import type { MemoryKind, SessionRecord } from "@/lib/store/types";

export const dynamic = "force-dynamic";

/** Parse & validate a { kind, itemId } body, ensuring the memory is a
 *  completed one that lives in the caller's room. */
async function resolveItem(
  request: NextRequest,
  session: SessionRecord
): Promise<{ kind: MemoryKind; itemId: string } | null> {
  let kind: string;
  let itemId: string;
  try {
    const body = await request.json();
    kind = String(body?.kind ?? "");
    itemId = String(body?.itemId ?? "");
  } catch {
    return null;
  }
  if ((kind !== "challenge" && kind !== "random") || !itemId) return null;

  const store = getStore();
  if (kind === "challenge") {
    const c = await store.getChallenge(itemId);
    if (!c || c.roomId !== session.room.id || c.status !== "completed") return null;
  } else {
    const r = await store.getRandom(itemId);
    if (!r || r.roomId !== session.room.id) return null;
  }
  return { kind, itemId };
}

/** POST /api/albums/:id/items { kind, itemId } — add a memory to the album. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;
  const store = getStore();
  const album = await store.getAlbum(id);
  if (!album || album.roomId !== session.room.id) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  const item = await resolveItem(request, session);
  if (!item) return NextResponse.json({ error: "Invalid memory." }, { status: 400 });

  try {
    await store.addAlbumItem(id, item.kind, item.itemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("addAlbumItem failed:", error);
    return NextResponse.json({ error: "Couldn't add to the album." }, { status: 500 });
  }
}

/** DELETE /api/albums/:id/items { kind, itemId } — remove a memory. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;
  const store = getStore();
  const album = await store.getAlbum(id);
  if (!album || album.roomId !== session.room.id) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  const item = await resolveItem(request, session);
  if (!item) return NextResponse.json({ error: "Invalid memory." }, { status: 400 });

  try {
    await store.removeAlbumItem(id, item.kind, item.itemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("removeAlbumItem failed:", error);
    return NextResponse.json({ error: "Couldn't remove from the album." }, { status: 500 });
  }
}
