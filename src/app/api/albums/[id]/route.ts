import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { albumsToDTO, normalizeAlbumName } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/albums/:id — one album (name, cover, member keys). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;
  try {
    const store = getStore();
    const album = await store.getAlbum(id);
    if (!album || album.roomId !== session.room.id) {
      return NextResponse.json({ error: "Album not found." }, { status: 404 });
    }
    const all = await albumsToDTO(session.room.id);
    const dto = all.find((a) => a.id === id)!;
    return NextResponse.json({ album: dto });
  } catch (error) {
    console.error("getAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't load the album." }, { status: 500 });
  }
}

/** PATCH /api/albums/:id { name } — rename. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;
  let name = "";
  try {
    name = normalizeAlbumName((await request.json())?.name);
  } catch {
    /* validation below */
  }
  if (!name) {
    return NextResponse.json({ error: "Give your album a name." }, { status: 400 });
  }

  try {
    const store = getStore();
    const album = await store.getAlbum(id);
    if (!album || album.roomId !== session.room.id) {
      return NextResponse.json({ error: "Album not found." }, { status: 404 });
    }
    const updated = await store.renameAlbum(id, name);
    return NextResponse.json({ album: updated });
  } catch (error) {
    console.error("renameAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't rename the album." }, { status: 500 });
  }
}

/** DELETE /api/albums/:id — remove the album (memories themselves stay). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { id } = await params;
  try {
    const store = getStore();
    const album = await store.getAlbum(id);
    if (!album || album.roomId !== session.room.id) {
      return NextResponse.json({ error: "Album not found." }, { status: 404 });
    }
    await store.deleteAlbum(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("deleteAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't delete the album." }, { status: 500 });
  }
}
