"use client";

import { useState } from "react";
import type { AlbumDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { AlbumCover } from "./AlbumCover";
import { Modal } from "./motion";
import { Button, Spinner, TextInput } from "./ui";
import { toast } from "./Toast";

const SUGGESTIONS = ["Trips", "Us", "Silly ones", "Favourites", "Firsts"];

/**
 * The shelf of scrapbook albums on the home screen: a row of taped-down
 * covers plus a "New album" tile. Handles creation inline.
 */
export function AlbumShelf({
  albums,
  previews,
  onChanged,
}: {
  albums: AlbumDTO[];
  /** challengeId → preview image url, for cover thumbnails */
  previews: Record<string, string>;
  onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Give your album a name.", "error");
      return;
    }
    setBusy(true);
    try {
      await api.createAlbum(trimmed);
      toast(`“${trimmed}” created 📔`);
      setCreating(false);
      setName("");
      onChanged();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't create the album.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-soft">
          Albums 📔
        </h2>
        {albums.length > 0 && (
          <button
            onClick={() => setCreating(true)}
            className="text-sm font-semibold text-accent transition-transform active:scale-95 hover:text-accent-deep"
          >
            + New
          </button>
        )}
      </div>

      {albums.length === 0 ? (
        <button
          onClick={() => setCreating(true)}
          className="dotted group flex items-center gap-4 rounded-3xl border border-line bg-surface/50 p-5 text-left
            transition-all hover:border-accent/50 hover:bg-accent-soft/30 active:scale-[0.99]"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-2xl
            transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
            📔
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-ink">Start an album</span>
            <span className="block text-sm text-soft">
              Gather your favourite memories like a scrapbook.
            </span>
          </span>
        </button>
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {albums.map((album, i) => (
            <AlbumCover
              key={album.id}
              album={album}
              thumbs={album.memoryIds.map((id) => previews[id]).filter(Boolean)}
              className="w-[46%] shrink-0 snap-start animate-fade-up sm:w-40"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
          <button
            onClick={() => setCreating(true)}
            className="flex w-[46%] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[14px]
              border-2 border-dashed border-line bg-surface/40 py-8 text-soft transition-all
              hover:border-accent/50 hover:text-accent active:scale-[0.97] sm:w-40"
          >
            <span className="text-2xl transition-transform duration-300 hover:scale-110">➕</span>
            <span className="text-sm font-semibold">New album</span>
          </button>
        </div>
      )}

      <Modal open={creating} onClose={() => !busy && setCreating(false)} labelledBy="new-album-title">
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-2xl">
              📔
            </div>
            <h3 id="new-album-title" className="font-display text-xl font-bold">
              New album
            </h3>
            <p className="mt-1 text-sm text-soft">Name it anything at all.</p>
          </div>
          <TextInput
            autoFocus
            value={name}
            maxLength={60}
            placeholder="e.g. Summer in Lisbon"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setName(s)}
                className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-soft
                  transition-all hover:border-accent/40 hover:text-accent active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={create} disabled={busy}>
              {busy ? <Spinner className="size-4" /> : "Create album"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
