import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { albumDetailToDTO, albumSummaryToDTO, loadRoomMemoryMaps } from "@/lib/serialize";
import type { SessionRecord } from "@/lib/store/types";

export const dynamic = "force-dynamic";

const MAX_NAME = 40;

/** Load an album and confirm it belongs to the viewer's room. */
async function loadOwnedAlbum(id: string, session: SessionRecord) {
  const album = await getStore().getAlbum(id);
  if (!album || album.roomId !== session.room.id) return null;
  return album;
}

/** GET /api/albums/[id] — full album with its memories. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });
  const { id } = await params;

  try {
    const store = getStore();
    const album = await loadOwnedAlbum(id, session);
    if (!album) return NextResponse.json({ error: "Album not found." }, { status: 404 });
    const items = await store.listAlbumItems(album.id);
    const maps = await loadRoomMemoryMaps(session);
    return NextResponse.json({
      album: albumDetailToDTO(album, items, maps.challengeById, maps.randomById),
    });
  } catch (error) {
    console.error("getAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't load the album." }, { status: 500 });
  }
}

/** PATCH /api/albums/[id] — rename. Body: { name }. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });
  const { id } = await params;

  let name = "";
  try {
    name = String(((await request.json()) as { name?: string }).name ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (name.length < 1 || name.length > MAX_NAME) {
    return NextResponse.json(
      { error: `Album names are 1–${MAX_NAME} characters.` },
      { status: 400 }
    );
  }

  try {
    const store = getStore();
    const album = await loadOwnedAlbum(id, session);
    if (!album) return NextResponse.json({ error: "Album not found." }, { status: 404 });
    const renamed = await store.renameAlbum(album.id, name);
    const items = await store.listAlbumItems(album.id);
    const maps = await loadRoomMemoryMaps(session);
    return NextResponse.json({
      album: albumSummaryToDTO(renamed, items, maps.challengeById, maps.randomById),
    });
  } catch (error) {
    console.error("renameAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't rename the album." }, { status: 500 });
  }
}

/** DELETE /api/albums/[id] — remove the album (memories themselves are kept). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });
  const { id } = await params;

  try {
    const store = getStore();
    const album = await loadOwnedAlbum(id, session);
    if (!album) return NextResponse.json({ error: "Album not found." }, { status: 404 });
    await store.deleteAlbum(album.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("deleteAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't delete the album." }, { status: 500 });
  }
}
