"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { AlbumSummaryDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { BlurImage } from "@/components/motion/BlurImage";
import { Button, Spinner, TextInput } from "@/components/ui";
import { toast } from "@/components/Toast";
import { spring, tween } from "@/lib/motion";
import { tiltFor } from "@/components/GalleryCard";

/** Horizontal shelf of shared albums, with an inline "new album" creator. */
export function AlbumStrip({
  albums,
  onCreated,
}: {
  albums: AlbumSummaryDTO[];
  onCreated?: () => void;
}) {
  const [composing, setComposing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await api.createAlbum(trimmed);
      setName("");
      setComposing(false);
      onCreated?.();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't create the album.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-soft">Albums 📚</h2>
        <button
          onClick={() => setComposing((v) => !v)}
          className="text-sm font-semibold text-accent-deep transition-colors hover:text-accent"
        >
          {composing ? "Cancel" : "+ New"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {composing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={tween.base}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 pb-1">
              <TextInput
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Late night calls"
                maxLength={40}
                onKeyDown={(e) => e.key === "Enter" && create()}
                className="h-11 flex-1"
              />
              <Button onClick={create} loading={saving} disabled={!name.trim()}>
                Create
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {albums.length === 0 && !composing ? (
        <button
          onClick={() => setComposing(true)}
          className="dotted flex items-center gap-3 rounded-2xl border border-line px-4 py-4 text-left transition-colors hover:border-faint"
        >
          <span className="text-2xl">🗂️</span>
          <span className="text-sm text-soft">
            Gather your favourite moments into shared albums.
          </span>
        </button>
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {albums.map((album, i) => (
            <AlbumTile key={album.id} album={album} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

function AlbumTile({ album, index }: { album: AlbumSummaryDTO; index: number }) {
  const tilt = tiltFor(index);
  return (
    <motion.div
      className="shrink-0 snap-start"
      initial={{ opacity: 0, y: 14, rotate: tilt }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      whileHover={{ rotate: 0, y: -5, scale: 1.03, zIndex: 5 }}
      transition={{ ...spring.gentle, delay: Math.min(index, 6) * 0.05 }}
    >
      <Link
        href={`/album/${album.id}`}
        className="group block w-36 overflow-hidden rounded-2xl bg-surface p-1.5 shadow-card transition-shadow hover:shadow-lift"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-br from-accent-soft to-dusk-soft">
          {album.coverUrl ? (
            <BlurImage
              src={album.coverUrl}
              alt=""
              loading="lazy"
              wrapperClassName="absolute inset-0 h-full w-full"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-4xl opacity-70">
              🖼️
            </span>
          )}
          {/* Stacked-paper hint behind the cover for depth. */}
          <span className="pointer-events-none absolute -right-1 top-2 h-full w-full rounded-xl border border-line/60 bg-surface/40 -z-10" />
        </div>
        <div className="px-1.5 py-2">
          <p className="truncate text-[13px] font-semibold text-ink">{album.name}</p>
          <p className="text-xs text-soft">
            {album.count} {album.count === 1 ? "memory" : "memories"}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
