import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSession } from "@/lib/session";
import { albumsToDTO, normalizeAlbumName, albumRecordToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/albums — every album in my room with cover + count. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

  try {
    const albums = await albumsToDTO(session.room.id);
    return NextResponse.json({ albums });
  } catch (error) {
    console.error("listAlbums failed:", error);
    return NextResponse.json({ error: "Couldn't load albums." }, { status: 500 });
  }
}

/** POST /api/albums { name } — create a new album. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No session" }, { status: 401 });

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
    const album = await getStore().createAlbum(session.room.id, name);
    return NextResponse.json(
      { album: albumRecordToDTO(album, [], null) },
      { status: 201 }
    );
  } catch (error) {
    console.error("createAlbum failed:", error);
    return NextResponse.json({ error: "Couldn't create the album." }, { status: 500 });
  }
}
