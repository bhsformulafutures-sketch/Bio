"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionDTO, TrackDTO } from "@/lib/types";
import { api } from "@/lib/api";
import { providerLabel } from "@/lib/music";
import { Header } from "@/components/Header";
import { Button, Card, Spinner, TextInput } from "@/components/ui";
import { toast } from "@/components/Toast";
import { NoteCanvas, type NoteCanvasHandle } from "@/components/NoteCanvas";
import { HeartIcon, MusicIcon, NoteIcon, PlusIcon, TrashIcon } from "@/components/icons";

const POLL_MS = 15_000;

export default function MusicPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [tracks, setTracks] = useState<TrackDTO[] | null>(null);
  const [nowPlaying, setNowPlaying] = useState<TrackDTO | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [me, list] = await Promise.all([api.me(), api.listTracks()]);
      setSession(me);
      setTracks(list.tracks);
    } catch (error) {
      if ((error as { status?: number }).status === 401) router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const removeTrack = async (id: string) => {
    setTracks((cur) => cur?.filter((t) => t.id !== id) ?? cur);
    if (nowPlaying?.id === id) setNowPlaying(null);
    try {
      await api.deleteTrack(id);
    } catch {
      refresh();
    }
  };

  if (!session || !tracks) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7 text-accent" />
      </div>
    );
  }

  const queue = tracks.filter((t) => t.kind === "queue");
  const dedications = tracks.filter((t) => t.kind === "dedication");

  return (
    <div className="min-h-dvh pb-16">
      <Header session={session} />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 pt-6">
        <div className="animate-fade-up">
          <Link
            href="/home"
            className="mb-2 block w-fit text-sm font-medium text-faint transition-colors hover:text-soft"
          >
            ← Home
          </Link>
          <h1 className="font-display text-2xl font-bold">Record player</h1>
          <p className="mt-1 text-[15px] text-soft">
            Cue up songs together, or send one that reminds you of them.
          </p>
        </div>

        <Player track={nowPlaying} />

        {/* Shared queue */}
        <section className="animate-fade-up flex flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-soft">
            <MusicIcon className="size-4" />
            The queue
          </h2>
          <AddSong onAdded={refresh} />
          {queue.length === 0 ? (
            <p className="px-1 text-sm text-faint">
              Nothing queued yet — paste a song link above.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {queue.map((t) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  playing={nowPlaying?.id === t.id}
                  onPlay={() => setNowPlaying(t)}
                  onRemove={() => removeTrack(t.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Dedications */}
        <section className="animate-fade-up flex flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-soft">
            <HeartIcon className="size-4" />
            Dedications
          </h2>
          <DedicationForm partnerName={session.partner?.name} onAdded={refresh} />
          {dedications.length === 0 ? (
            <p className="px-1 text-sm text-faint">
              No dedications yet. Send a song and the lyric that says it for you.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {dedications.map((t) => (
                <DedicationCard
                  key={t.id}
                  track={t}
                  playing={nowPlaying?.id === t.id}
                  onPlay={() => setNowPlaying(t)}
                  onRemove={() => removeTrack(t.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* ---- the spinning record + embedded player ---- */
function Player({ track }: { track: TrackDTO | null }) {
  const playing = !!track;
  return (
    <div className="animate-fade-up flex flex-col items-center gap-4">
      <div className="relative flex h-48 w-full items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a221b] to-[#1a1512]">
        <div
          className={`relative size-40 rounded-full shadow-lift ${
            playing ? "animate-[spin_5s_linear_infinite]" : ""
          }`}
          style={{
            background:
              "repeating-radial-gradient(circle at center, #17120d 0 3px, #241c15 3px 6px)",
          }}
        >
          <div className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-accent p-1 text-center">
            <span className="line-clamp-2 text-[9px] font-bold leading-tight text-white">
              {track ? track.title : "otherhalf"}
            </span>
          </div>
          <div className="absolute inset-0 m-auto size-2 rounded-full bg-paper" />
        </div>
      </div>
      {track && track.embedUrl ? (
        <Embed track={track} />
      ) : track ? (
        <a href={track.url} target="_blank" rel="noreferrer" className="w-full">
          <Button variant="soft" className="w-full">
            Open {providerLabel(track.provider)} to listen
          </Button>
        </a>
      ) : (
        <p className="text-sm text-faint">Pick a song below to start it spinning.</p>
      )}
    </div>
  );
}

function Embed({ track }: { track: TrackDTO }) {
  if (track.provider === "youtube") {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-ink shadow-card">
        <iframe
          key={track.id}
          src={track.embedUrl!}
          title={track.title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <iframe
      key={track.id}
      src={track.embedUrl!}
      title={track.title}
      loading="lazy"
      className="w-full overflow-hidden rounded-2xl shadow-card"
      style={{ height: track.provider === "spotify" ? 352 : 232 }}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    />
  );
}

/* ---- queue row ---- */
function TrackRow({
  track,
  playing,
  onPlay,
  onRemove,
}: {
  track: TrackDTO;
  playing: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card transition-colors ${
        playing ? "ring-2 ring-accent/40" : ""
      }`}
    >
      <button
        onClick={onPlay}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-deep active:scale-95"
        aria-label="Play"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{track.title}</p>
        <p className="truncate text-xs text-faint">
          {track.artist ? `${track.artist} · ` : ""}
          {providerLabel(track.provider)} · {track.addedByName}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="shrink-0 text-faint transition-colors hover:text-red-500"
        aria-label="Remove"
      >
        <TrashIcon className="size-4" />
      </button>
    </div>
  );
}

/* ---- dedication card ---- */
function DedicationCard({
  track,
  playing,
  onPlay,
  onRemove,
}: {
  track: TrackDTO;
  playing: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  return (
    <Card className={`flex flex-col gap-3 p-4 ${playing ? "ring-2 ring-accent/40" : ""}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={onPlay}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white active:scale-95"
          aria-label="Play"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{track.title}</p>
          <p className="truncate text-xs text-faint">
            {track.artist ? `${track.artist} · ` : ""}
            from {track.addedByName}
          </p>
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 text-faint transition-colors hover:text-red-500"
          aria-label="Remove"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
      {track.lyric && (
        <p className="border-l-2 border-accent/40 pl-3 font-display text-[15px] italic text-ink">
          &ldquo;{track.lyric}&rdquo;
        </p>
      )}
      {track.noteUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.noteUrl}
          alt="Handwritten note"
          className="w-full rounded-xl bg-paper"
          draggable={false}
        />
      )}
    </Card>
  );
}

/* ---- add a queue song ---- */
function AddSong({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !url.trim()) {
      toast("Add a title and a song link.", "error");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("kind", "queue");
      form.append("title", title.trim());
      form.append("url", url.trim());
      await api.addTrack(form);
      setTitle("");
      setUrl("");
      onAdded();
    } catch (error) {
      toast((error as { message?: string }).message ?? "Couldn't add it.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-2 p-3">
      <TextInput
        placeholder="Song title"
        value={title}
        maxLength={140}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextInput
        placeholder="Paste a Spotify / YouTube / Apple Music link"
        value={url}
        inputMode="url"
        onChange={(e) => setUrl(e.target.value)}
      />
      <Button size="sm" onClick={submit} loading={busy} className="self-end">
        <PlusIcon className="size-4" />
        Add to queue
      </Button>
    </Card>
  );
}

/* ---- send a dedication ---- */
function DedicationForm({
  partnerName,
  onAdded,
}: {
  partnerName?: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [lyric, setLyric] = useState("");
  const [busy, setBusy] = useState(false);
  const noteRef = useRef<NoteCanvasHandle>(null);

  const submit = async () => {
    if (!title.trim() || !url.trim()) {
      toast("Add a title and a song link.", "error");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("kind", "dedication");
      form.append("title", title.trim());
      form.append("url", url.trim());
      if (lyric.trim()) form.append("lyric", lyric.trim());
      const note = await noteRef.current?.toBlob();
      if (note) form.append("note", note, "note.png");
      await api.addTrack(form);
      setTitle("");
      setUrl("");
      setLyric("");
      noteRef.current?.clear();
      setOpen(false);
      onAdded();
      toast("Dedication sent");
    } catch (error) {
      toast((error as { message?: string }).message ?? "Couldn't send it.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="self-start">
        <NoteIcon className="size-4" />
        Send a dedication
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm font-semibold text-soft">
        A song for {partnerName ?? "your other half"}
      </p>
      <TextInput
        placeholder="Song title"
        value={title}
        maxLength={140}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextInput
        placeholder="Paste the song link"
        value={url}
        inputMode="url"
        onChange={(e) => setUrl(e.target.value)}
      />
      <textarea
        placeholder="A lyric that reminds you of them…"
        value={lyric}
        maxLength={500}
        onChange={(e) => setLyric(e.target.value)}
        className="min-h-20 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink
          placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      <div>
        <p className="mb-1.5 text-xs font-semibold text-soft">Handwritten note (optional)</p>
        <NoteCanvas ref={noteRef} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} loading={busy}>
          Send it
        </Button>
      </div>
    </Card>
  );
}
