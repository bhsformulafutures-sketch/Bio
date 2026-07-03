import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { albumToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const MAX_NAME = 60;

/** GET /api/albums — every album in my room with its memory ids (newest first). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  try {
    const store = getStore();
    const [albums, memberships, challenges] = await Promise.all([
      store.listAlbums(session.room.id),
      store.listAlbumMemories(session.room.id),
      store.listChallenges(session.room.id),
    ]);

    // Only completed challenges can be filed; order to match the gallery.
    const order = new Map<string, number>();
    challenges.forEach((c, i) => order.set(c.id, i));

    const byAlbum = new Map<string, string[]>();
    for (const m of memberships) {
      if (!order.has(m.challengeId)) continue; // challenge gone
      const list = byAlbum.get(m.albumId) ?? [];
      list.push(m.challengeId);
      byAlbum.set(m.albumId, list);
    }
    for (const list of byAlbum.values()) {
      list.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    }

    return NextResponse.json({
      albums: albums.map((a) => albumToDTO(a, byAlbum.get(a.id) ?? [])),
    });
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
    const body = await request.json();
    name = String(body?.name ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Give your album a name." }, { status: 400 });
  if (name.length > MAX_NAME) name = name.slice(0, MAX_NAME);

  try {
    const album = await getStore().createAlbum(session.room.id, name);
    return NextResponse.json({ album: albumToDTO(album, []) }, { status: 201 });
  } catch (error) {
    console.error("createAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't create the album." }, { status: 500 });
  }
}
