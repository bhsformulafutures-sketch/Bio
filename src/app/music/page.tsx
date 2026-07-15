"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PlayerDTO, SessionDTO, TrackDTO } from "@/lib/types";
import { api } from "@/lib/api";
import { parseTrackUrl, providerLabel } from "@/lib/music";
import { Header } from "@/components/Header";
import { Button, Panel, Spinner, Sticker, TapeStrip, TextInput } from "@/components/ui";
import { toast } from "@/components/Toast";
import { NoteCanvas, type NoteCanvasHandle } from "@/components/NoteCanvas";
import { HeartIcon, MusicIcon, NoteIcon, PlusIcon, TrashIcon } from "@/components/icons";

const POLL_MS = 5_000;

/** What my embed is currently playing, and from which elapsed second. */
interface Listening {
  track: TrackDTO;
  startSeconds: number;
}

export default function MusicPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [tracks, setTracks] = useState<TrackDTO[] | null>(null);
  const [player, setPlayer] = useState<PlayerDTO | null>(null);
  const [listening, setListening] = useState<Listening | null>(null);
  /** serverNow − Date.now(), so elapsed time survives skewed device clocks. */
  const clockOffset = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const [me, list, p] = await Promise.all([
        api.me(),
        api.listTracks(),
        api.getPlayer(),
      ]);
      setSession(me);
      setTracks(list.tracks);
      setPlayer(p.player);
      clockOffset.current = new Date(p.serverNow).getTime() - Date.now();
    } catch (error) {
      if ((error as { status?: number }).status === 401) router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const elapsedSeconds = useCallback(
    (p: PlayerDTO) =>
      Math.max(
        0,
        Math.round(
          (Date.now() + clockOffset.current - new Date(p.startedAt).getTime()) / 1000
        )
      ),
    []
  );

  /** Press play: broadcast to the room and start my own embed from 0. */
  const broadcast = async (track: TrackDTO) => {
    setListening({ track, startSeconds: 0 });
    try {
      const res = await api.setPlayer(track.id);
      setPlayer(res.player);
      clockOffset.current = new Date(res.serverNow).getTime() - Date.now();
    } catch {
      toast("Couldn't go on air — playing just for you.", "error");
    }
  };

  /** Join the partner's broadcast at (roughly) the right spot. */
  const tuneIn = () => {
    if (!player) return;
    // Only YouTube embeds can join mid-song; the rest start from the top.
    const offset = player.track.provider === "youtube" ? elapsedSeconds(player) : 0;
    setListening({ track: player.track, startSeconds: offset });
  };

  const stop = async () => {
    const mine = player?.fromMe && listening?.track.id === player.track.id;
    setListening(null);
    if (mine) {
      setPlayer(null);
      try {
        await api.stopPlayer();
      } catch {
        refresh();
      }
    }
  };

  const removeTrack = async (id: string) => {
    setTracks((cur) => cur?.filter((t) => t.id !== id) ?? cur);
    if (listening?.track.id === id) setListening(null);
    try {
      await api.deleteTrack(id);
    } catch (error) {
      toast((error as { message?: string }).message ?? "Couldn't remove it.", "error");
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
  const stationName = `${session.room.code} FM`;
  const onAir = player !== null;
  const tunedIn = onAir && listening?.track.id === player.track.id;
  const showTuneIn = onAir && !player.fromMe && !tunedIn;

  return (
    <div className="min-h-dvh pb-16">
      <Header session={session} />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 pt-6">
        {/* Station masthead */}
        <div className="animate-fade-up">
          <Link
            href="/home"
            className="mb-2 block w-fit text-sm font-medium text-faint transition-colors hover:text-soft"
          >
            ← Home
          </Link>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl text-ink">{stationName}</h1>
              <p className="mt-1 text-[15px] text-soft">
                {onAir
                  ? `${player.fromMe ? "You are" : `${player.startedByName} is`} broadcasting.`
                  : "Nothing on air — put a song on."}
              </p>
            </div>
            {onAir && (
              <Sticker tone="soft" tilt={-2} className="mb-1 shrink-0 uppercase tracking-widest">
                ● on air
              </Sticker>
            )}
          </div>
        </div>

        {/* Tune-in note from the partner */}
        {showTuneIn && (
          <Panel className="animate-pop relative flex items-center gap-3 p-4">
            <TapeStrip color="gold" className="-top-3 left-6" />
            <div className="min-w-0 flex-1">
              <p className="font-hand text-lg leading-snug text-ink">
                {player.startedByName} put on “{player.track.title}”
              </p>
              <p className="text-xs text-faint">
                {player.track.provider === "youtube"
                  ? "Tune in and catch up to them."
                  : "Tune in — starts from the top on this player."}
              </p>
            </div>
            <Button size="sm" onClick={tuneIn}>
              Tune in
            </Button>
          </Panel>
        )}

        <CassetteDeck
          listening={listening}
          player={player}
          tunedIn={!!tunedIn}
          elapsedSeconds={onAir ? elapsedSeconds : null}
          onStop={stop}
        />

        {/* Side A — the queue */}
        <section className="animate-fade-up flex flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-soft">
            <MusicIcon className="size-4" />
            Side A · The queue
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
                  playing={listening?.track.id === t.id}
                  onPlay={() => broadcast(t)}
                  onRemove={() => removeTrack(t.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Side B — dedications */}
        <section className="animate-fade-up flex flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-soft">
            <HeartIcon className="size-4" />
            Side B · Dedications
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
                  playing={listening?.track.id === t.id}
                  onPlay={() => broadcast(t)}
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

/* ---- the tape deck: cassette + embedded player ---- */
function CassetteDeck({
  listening,
  player,
  tunedIn,
  elapsedSeconds,
  onStop,
}: {
  listening: Listening | null;
  player: PlayerDTO | null;
  tunedIn: boolean;
  elapsedSeconds: ((p: PlayerDTO) => number) | null;
  onStop: () => void;
}) {
  const shown = listening?.track ?? player?.track ?? null;
  const spinning = listening !== null;
  return (
    <div className="animate-fade-up flex flex-col items-center gap-4">
      <div className="relative w-full rounded-lg border border-line bg-[#efe6d2] p-4 shadow-card">
        <Cassette title={shown?.title ?? null} spinning={spinning} />
        <div className="mt-3 flex items-center justify-between px-1">
          <TapeCounter player={player} tunedIn={tunedIn} elapsedSeconds={elapsedSeconds} />
          {listening && (
            <button
              onClick={onStop}
              className="rounded-md border border-line bg-surface px-3 py-1 text-xs font-bold
                uppercase tracking-widest text-soft transition-colors hover:text-ink"
            >
              ■ stop
            </button>
          )}
        </div>
      </div>
      {listening ? (
        <Embed track={listening.track} startSeconds={listening.startSeconds} />
      ) : shown ? (
        <p className="text-sm text-faint">Press play to start the tape.</p>
      ) : (
        <p className="text-sm text-faint">Pick a song below to load the deck.</p>
      )}
      {listening && !listening.track.embedUrl && (
        <a href={listening.track.url} target="_blank" rel="noreferrer" className="w-full">
          <Button variant="soft" className="w-full">
            Open {providerLabel(listening.track.provider)} to listen
          </Button>
        </a>
      )}
    </div>
  );
}

/** The cassette shell: label strip + two spinning spools. */
function Cassette({ title, spinning }: { title: string | null; spinning: boolean }) {
  return (
    <div className="relative mx-auto w-full max-w-xs rounded-md border border-ink/25 bg-[#4a3d33] p-3 shadow-card">
      {/* screws */}
      {["left-1.5 top-1.5", "right-1.5 top-1.5", "left-1.5 bottom-1.5", "right-1.5 bottom-1.5"].map(
        (pos) => (
          <span key={pos} className={`absolute ${pos} size-1.5 rounded-full bg-ink/40`} />
        )
      )}
      {/* handwritten label */}
      <div className="rounded-sm border border-line bg-[#fffef9] px-3 pb-1.5 pt-1">
        <p className="truncate text-center font-hand text-lg leading-snug text-ink">
          {title ?? "· blank tape ·"}
        </p>
        <div className="h-px w-full bg-line" />
      </div>
      {/* tape window with spools */}
      <div className="mt-2 flex items-center justify-between rounded-sm bg-ink/30 px-5 py-2.5">
        <Spool spinning={spinning} />
        <span className="h-1 flex-1 mx-3 rounded-full bg-ink/50" />
        <Spool spinning={spinning} slow />
      </div>
    </div>
  );
}

function Spool({ spinning, slow = false }: { spinning: boolean; slow?: boolean }) {
  return (
    <span
      className={`relative block size-9 rounded-full bg-[#efe6d2] ${
        spinning ? (slow ? "animate-[spin_2.6s_linear_infinite]" : "animate-[spin_1.8s_linear_infinite]") : ""
      }`}
      style={{
        background:
          "repeating-conic-gradient(#efe6d2 0deg 24deg, #b7a98e 24deg 36deg)",
      }}
    >
      <span className="absolute inset-0 m-auto size-3 rounded-full border border-ink/30 bg-[#4a3d33]" />
    </span>
  );
}

/** Ticking mm:ss since the broadcast started. */
function TapeCounter({
  player,
  tunedIn,
  elapsedSeconds,
}: {
  player: PlayerDTO | null;
  tunedIn: boolean;
  elapsedSeconds: ((p: PlayerDTO) => number) | null;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!player) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [player]);
  if (!player || !elapsedSeconds) {
    return <span className="font-mono text-xs tracking-widest text-faint">00:00</span>;
  }
  const s = elapsedSeconds(player);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className="font-mono text-xs tracking-widest text-soft">
      {mm}:{ss}
      {player.fromMe ? " · your broadcast" : tunedIn ? " · listening along" : " · on air"}
    </span>
  );
}

function Embed({ track, startSeconds }: { track: TrackDTO; startSeconds: number }) {
  const src = useMemo(() => {
    if (!track.embedUrl) return null;
    if (track.provider === "youtube") {
      const params = new URLSearchParams({ autoplay: "1" });
      if (startSeconds > 2) params.set("start", String(startSeconds));
      return `${track.embedUrl}?${params}`;
    }
    return track.embedUrl;
  }, [track.embedUrl, track.provider, startSeconds]);

  if (!src) return null;
  if (track.provider === "youtube") {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-line bg-ink shadow-card">
        <iframe
          key={`${track.id}-${startSeconds}`}
          src={src}
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
      src={src}
      title={track.title}
      loading="lazy"
      className="w-full overflow-hidden rounded-lg shadow-card"
      style={{ height: track.provider === "spotify" ? 352 : 232 }}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    />
  );
}

/* ---- queue row: a cassette spine ---- */
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
      className={`flex items-center gap-3 rounded-md border border-line bg-surface p-3 shadow-card transition-colors ${
        playing ? "ring-2 ring-accent/40" : ""
      }`}
    >
      <button
        onClick={onPlay}
        className="flex size-9 shrink-0 items-center justify-center rounded-md border border-accent/30
          bg-accent-soft text-accent-deep active:scale-95"
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
        className="shrink-0 text-faint transition-colors hover:text-accent-deep"
        aria-label="Remove"
      >
        <TrashIcon className="size-4" />
      </button>
    </div>
  );
}

/* ---- dedication card: a labeled cassette from them ---- */
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
    <Panel className={`relative flex flex-col gap-3 p-4 ${playing ? "ring-2 ring-accent/40" : ""}`}>
      <TapeStrip color={track.fromMe ? "blue" : "pink"} className="-top-3 right-8" angle={3} />
      <div className="flex items-center gap-3">
        <button
          onClick={onPlay}
          className="flex size-9 shrink-0 items-center justify-center rounded-md border
            border-accent-deep/40 bg-accent text-white active:scale-95"
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
        {track.fromMe && (
          <button
            onClick={onRemove}
            className="shrink-0 text-faint transition-colors hover:text-accent-deep"
            aria-label="Remove"
          >
            <TrashIcon className="size-4" />
          </button>
        )}
      </div>
      {track.lyric && (
        <p className="border-l-2 border-accent/40 pl-3 font-display text-[17px] italic text-ink">
          &ldquo;{track.lyric}&rdquo;
        </p>
      )}
      {track.noteUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.noteUrl}
          alt="Handwritten note"
          className="w-full rounded-md bg-paper"
          draggable={false}
        />
      )}
    </Panel>
  );
}

/* ---- add a queue song ---- */
function AddSong({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const needsTitle = url.trim() !== "" && parseTrackUrl(url).provider === "other";

  const submit = async () => {
    if (!url.trim()) {
      toast("Paste a song link.", "error");
      return;
    }
    if (needsTitle && !title.trim()) {
      toast("Plain links need a title.", "error");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("kind", "queue");
      if (title.trim()) form.append("title", title.trim());
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
    <Panel className="flex flex-col gap-2 p-3">
      <TextInput
        placeholder="Paste a Spotify / YouTube / Apple Music link"
        value={url}
        inputMode="url"
        onChange={(e) => setUrl(e.target.value)}
      />
      {needsTitle && (
        <TextInput
          placeholder="Song title (we couldn't read the link)"
          value={title}
          maxLength={140}
          onChange={(e) => setTitle(e.target.value)}
        />
      )}
      <Button size="sm" onClick={submit} loading={busy} className="self-end">
        <PlusIcon className="size-4" />
        Add to Side A
      </Button>
    </Panel>
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
  const needsTitle = url.trim() !== "" && parseTrackUrl(url).provider === "other";

  const submit = async () => {
    if (!url.trim()) {
      toast("Paste a song link.", "error");
      return;
    }
    if (needsTitle && !title.trim()) {
      toast("Plain links need a title.", "error");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("kind", "dedication");
      if (title.trim()) form.append("title", title.trim());
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
        Record a dedication
      </Button>
    );
  }

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <p className="font-hand text-lg text-soft">
        A song for {partnerName ?? "your other half"}
      </p>
      <TextInput
        placeholder="Paste the song link"
        value={url}
        inputMode="url"
        onChange={(e) => setUrl(e.target.value)}
      />
      {needsTitle && (
        <TextInput
          placeholder="Song title (we couldn't read the link)"
          value={title}
          maxLength={140}
          onChange={(e) => setTitle(e.target.value)}
        />
      )}
      <textarea
        placeholder="A lyric that reminds you of them…"
        value={lyric}
        maxLength={500}
        onChange={(e) => setLyric(e.target.value)}
        className="min-h-20 w-full rounded-md border border-line bg-surface px-4 py-3 text-[15px] text-ink
          placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
      />
      <div>
        <p className="mb-1.5 text-xs font-semibold text-soft">The cassette label (optional)</p>
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
    </Panel>
  );
}
