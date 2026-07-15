import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { trackToDTO } from "@/lib/serialize";
import { fetchTrackMeta, parseTrackUrl } from "@/lib/music";
import { notifyDedicationSent } from "@/lib/notify/notifications";
import type { NewTrack, TrackKind } from "@/lib/store/types";

export const dynamic = "force-dynamic";

const MAX_NOTE_BYTES = 2 * 1024 * 1024;

/** GET /api/tracks — the room's queue + dedications, newest first. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  const tracks = await getStore().listTracks(session.room.id);
  return NextResponse.json({
    tracks: tracks.map((t) => trackToDTO(t, session)),
  });
}

/** POST /api/tracks — add a song to the queue, or send a dedication.
 *  Multipart: kind, title, artist?, url, lyric?, note? (png). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const kind: TrackKind = form.get("kind") === "dedication" ? "dedication" : "queue";
  let title = String(form.get("title") ?? "").trim().slice(0, 140);
  const url = String(form.get("url") ?? "").trim().slice(0, 2000);
  let artist = String(form.get("artist") ?? "").trim().slice(0, 140) || null;
  const lyric = String(form.get("lyric") ?? "").trim().slice(0, 500) || null;

  if (!url) {
    return NextResponse.json({ error: "Paste a song link." }, { status: 400 });
  }

  const { provider, embedUrl } = parseTrackUrl(url);

  // Fill title/artist from the provider's oEmbed endpoint when the client
  // didn't supply them. A typed title always wins over the fetched one.
  if (!title || !artist) {
    const meta = await fetchTrackMeta(url, provider);
    if (meta) {
      if (!title) title = meta.title;
      if (!artist) artist = meta.artist;
    }
  }
  if (!title) {
    return NextResponse.json(
      { error: "Couldn't read that link — give the song a title." },
      { status: 400 }
    );
  }
  const store = getStore();
  const trackId = randomUUID();

  // Optional handwritten note (dedications only).
  let notePath: string | null = null;
  const note = form.get("note");
  if (kind === "dedication" && note instanceof Blob && note.size > 0) {
    if (note.size > MAX_NOTE_BYTES) {
      return NextResponse.json({ error: "That note is too large." }, { status: 400 });
    }
    notePath = `rooms/${session.room.id}/music/${trackId}-note.png`;
    await store.saveFile(notePath, new Uint8Array(await note.arrayBuffer()), "image/png");
  }

  const data: NewTrack = {
    id: trackId,
    roomId: session.room.id,
    addedById: session.participant.id,
    kind,
    title,
    artist,
    url,
    provider,
    embedUrl,
    lyric: kind === "dedication" ? lyric : null,
    notePath,
  };
  const track = await store.createTrack(data);
  await store.touch(session.participant.id);
  if (kind === "dedication") {
    await notifyDedicationSent(
      session.room.id,
      session.participant.id,
      session.participant.name,
      track.title
    );
  }
  return NextResponse.json({ track: trackToDTO(track, session) });
}
