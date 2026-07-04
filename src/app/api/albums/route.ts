import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { albumSummaryToDTO, loadRoomMemoryMaps } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const MAX_NAME = 40;
const MAX_ALBUMS = 100;

/** GET /api/albums — album summaries (with covers) for my room. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  try {
    const store = getStore();
    const albums = await store.listAlbums(session.room.id);
    const maps = await loadRoomMemoryMaps(session);
    const summaries = await Promise.all(
      albums.map(async (album) => {
        const items = await store.listAlbumItems(album.id);
        return albumSummaryToDTO(album, items, maps.challengeById, maps.randomById);
      })
    );
    return NextResponse.json({ albums: summaries });
  } catch (error) {
    console.error("listAlbums failed:", error);
    return NextResponse.json({ error: "Couldn't load albums." }, { status: 500 });
  }
}

/** POST /api/albums — create an album. Body: { name }. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  let name = "";
  try {
    name = String(((await request.json()) as { name?: string }).name ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (name.length < 1 || name.length > MAX_NAME) {
    return NextResponse.json(
      { error: `Give your album a name (1–${MAX_NAME} characters).` },
      { status: 400 }
    );
  }

  try {
    const store = getStore();
    const existing = await store.listAlbums(session.room.id);
    if (existing.length >= MAX_ALBUMS) {
      return NextResponse.json({ error: "That's a lot of albums! Tidy up a few first." }, { status: 400 });
    }
    const album = await store.createAlbum(session.room.id, name);
    const maps = await loadRoomMemoryMaps(session);
    return NextResponse.json(
      { album: albumSummaryToDTO(album, [], maps.challengeById, maps.randomById) },
      { status: 201 }
    );
  } catch (error) {
    console.error("createAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't create the album." }, { status: 500 });
  }
}
