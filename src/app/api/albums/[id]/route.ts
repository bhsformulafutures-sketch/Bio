import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { albumToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const MAX_NAME = 60;

/** Load an album and confirm it belongs to the caller's active room. */
async function ownedAlbum(id: string) {
  const session = await getSession();
  if (!session) return { error: "No session" as const, status: 401 };
  const album = await getStore().getAlbum(id);
  if (!album || album.roomId !== session.room.id) {
    return { error: "Album not found." as const, status: 404 };
  }
  return { session, album };
}

/** PATCH /api/albums/:id — rename. Body: { name }. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const owned = await ownedAlbum(id);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  let name = "";
  try {
    const body = await request.json();
    name = String(body?.name ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Album name can't be empty." }, { status: 400 });
  if (name.length > MAX_NAME) name = name.slice(0, MAX_NAME);

  try {
    const updated = await getStore().renameAlbum(id, name);
    if (!updated) return NextResponse.json({ error: "Album not found." }, { status: 404 });
    return NextResponse.json({ album: albumToDTO(updated, []) });
  } catch (error) {
    console.error("renameAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't rename the album." }, { status: 500 });
  }
}

/** DELETE /api/albums/:id — remove the album (memories themselves are kept). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const owned = await ownedAlbum(id);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  try {
    await getStore().deleteAlbum(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("deleteAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't delete the album." }, { status: 500 });
  }
}
