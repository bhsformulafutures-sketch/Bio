"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { AlbumDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { BlurImage } from "@/components/motion/BlurImage";
import { Spinner } from "@/components/ui";
import { toast } from "@/components/Toast";
import { spring } from "@/lib/motion";

/**
 * The Albums shelf on the home screen — a horizontally scrolling row of
 * scrapbook-style album covers, plus a tile to start a new one.
 */
export function AlbumStrip() {
  const router = useRouter();
  const [albums, setAlbums] = useState<AlbumDTO[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .listAlbums()
      .then(({ albums }) => setAlbums(albums))
      .catch(() => setAlbums([]));
  }, []);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const { album } = await api.createAlbum(trimmed);
      router.push(`/albums/${album.id}`);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't create album.", "error");
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-soft">Albums 📚</h2>
        {albums && albums.length > 0 && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="text-xs font-semibold text-accent transition-colors hover:text-accent-deep"
          >
            + New
          </button>
        )}
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence initial={false}>
          {creating && (
            <motion.div
              key="new-form"
              initial={{ opacity: 0, width: 0, scale: 0.9 }}
              animate={{ opacity: 1, width: 144, scale: 1 }}
              exit={{ opacity: 0, width: 0, scale: 0.9 }}
              transition={spring.gentle}
              className="flex shrink-0 flex-col justify-between gap-2 overflow-hidden rounded-2xl border border-accent/40 bg-surface p-3 shadow-card"
              style={{ width: 144 }}
            >
              <input
                autoFocus
                value={name}
                maxLength={40}
                placeholder="Album name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                  if (e.key === "Escape") setCreating(false);
                }}
                className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink
                  placeholder:text-faint focus:border-accent focus:outline-none"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={create}
                  disabled={busy}
                  className="flex h-8 flex-1 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-60"
                >
                  {busy ? <Spinner className="size-3.5" /> : "Create"}
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="flex h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold text-faint hover:text-soft"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {albums === null ? (
          <div className="flex h-32 w-full items-center justify-center">
            <Spinner className="size-5 text-accent" />
          </div>
        ) : albums.length === 0 && !creating ? (
          <button
            onClick={() => setCreating(true)}
            className="dotted flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line text-center transition-colors hover:border-accent/50"
          >
            <span className="text-2xl">📔</span>
            <span className="text-sm font-semibold text-ink">Start an album</span>
            <span className="max-w-[16rem] text-xs text-soft">
              Gather your favourite memories into collections
            </span>
          </button>
        ) : (
          albums.map((album, i) => (
            <AlbumCover key={album.id} album={album} index={i} />
          ))
        )}
      </div>
    </section>
  );
}

const TILTS = [-2, 1.5, -1, 2, -1.5];

function AlbumCover({ album, index }: { album: AlbumDTO; index: number }) {
  const tilt = TILTS[index % TILTS.length];
  return (
    <motion.div
      className="shrink-0"
      initial={{ opacity: 0, y: 12, rotate: tilt }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      whileHover={{ rotate: 0, y: -4, scale: 1.03, zIndex: 5 }}
      transition={{ ...spring.gentle, delay: index * 0.04 }}
    >
      <Link href={`/albums/${album.id}`} className="group block w-36">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-br from-accent-soft to-dusk-soft p-1.5 shadow-card transition-shadow group-hover:shadow-lift">
          {album.coverUrl ? (
            <BlurImage
              src={album.coverUrl}
              alt=""
              wrapperClassName="h-full w-full rounded-xl"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center rounded-xl text-4xl">
              📸
            </span>
          )}
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
            {album.count}
          </span>
        </div>
        <p className="mt-1.5 truncate px-1 font-display text-sm font-bold text-ink">
          {album.name}
        </p>
      </Link>
    </motion.div>
  );
}
