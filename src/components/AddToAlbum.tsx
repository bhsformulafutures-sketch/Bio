"use client";

import { useEffect, useState } from "react";
import type { AlbumDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { Modal } from "./motion";
import { Spinner, TextInput } from "./ui";
import { toast } from "./Toast";

/**
 * "Add to album" control for a completed memory. Opens a sheet listing
 * every album with a checkbox for membership, plus quick album creation.
 * Filing a memory plays a little stamp animation.
 */
export function AddToAlbum({
  challengeId,
  className = "",
}: {
  challengeId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [albums, setAlbums] = useState<AlbumDTO[] | null>(null);
  const [member, setMember] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [stamped, setStamped] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAlbums(null);
    api
      .listAlbums()
      .then(({ albums }) => {
        setAlbums(albums);
        setMember(
          new Set(albums.filter((a) => a.memoryIds.includes(challengeId)).map((a) => a.id))
        );
      })
      .catch(() => setAlbums([]));
  }, [open, challengeId]);

  const toggle = async (album: AlbumDTO) => {
    if (pending) return;
    const isIn = member.has(album.id);
    setPending(album.id);
    try {
      if (isIn) {
        await api.removeFromAlbum(album.id, challengeId);
        setMember((s) => {
          const next = new Set(s);
          next.delete(album.id);
          return next;
        });
      } else {
        await api.addToAlbum(album.id, challengeId);
        setMember((s) => new Set(s).add(album.id));
        setStamped(album.id);
        setTimeout(() => setStamped((c) => (c === album.id ? null : c)), 700);
      }
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't update the album.", "error");
    } finally {
      setPending(null);
    }
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { album } = await api.createAlbum(name);
      await api.addToAlbum(album.id, challengeId);
      setAlbums((list) => [album, ...(list ?? [])]);
      setMember((s) => new Set(s).add(album.id));
      setStamped(album.id);
      setTimeout(() => setStamped((c) => (c === album.id ? null : c)), 700);
      setNewName("");
      toast(`Filed into “${name}” 📔`);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't create the album.", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2
          text-sm font-semibold text-ink shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift
          active:scale-95 ${className}`}
      >
        <span className="text-base">📔</span>
        Add to album
      </button>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="add-album-title">
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <h3 id="add-album-title" className="font-display text-xl font-bold">
              File this memory
            </h3>
            <p className="mt-1 text-sm text-soft">Tap an album to add or remove it.</p>
          </div>

          {albums === null ? (
            <div className="flex flex-col gap-2">
              <div className="skeleton h-12 rounded-2xl" />
              <div className="skeleton h-12 rounded-2xl" />
              <div className="skeleton h-12 rounded-2xl" />
            </div>
          ) : (
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {albums.map((album) => {
                const isIn = member.has(album.id);
                const wasIn = album.memoryIds.includes(challengeId);
                const count = album.count + (isIn ? 1 : 0) - (wasIn ? 1 : 0);
                return (
                  <button
                    key={album.id}
                    onClick={() => toggle(album)}
                    disabled={pending === album.id}
                    className={`relative flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all
                      active:scale-[0.98] ${
                        isIn
                          ? "border-accent/40 bg-accent-soft"
                          : "border-line bg-paper hover:border-faint"
                      }`}
                  >
                    <span className="text-lg">{isIn ? "📗" : "📔"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{album.name}</span>
                      <span className="block text-xs text-soft">
                        {count} {count === 1 ? "memory" : "memories"}
                      </span>
                    </span>
                    {pending === album.id ? (
                      <Spinner className="size-4 text-accent" />
                    ) : (
                      <span
                        className={`flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                          isIn
                            ? "border-accent bg-accent text-white"
                            : "border-line text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    )}
                    {stamped === album.id && (
                      <span
                        aria-hidden
                        className="animate-stamp pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                          rounded-md border-[2.5px] border-accent/70 bg-surface/70 px-2 py-0.5 text-[11px] font-black uppercase
                          tracking-[0.2em] text-accent/80"
                      >
                        Filed
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-line pt-3">
            <TextInput
              value={newName}
              maxLength={60}
              placeholder="New album…"
              className="h-11"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
            />
            <button
              onClick={createAndAdd}
              disabled={creating || !newName.trim()}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-accent px-4 text-sm font-semibold
                text-white transition-all hover:bg-accent-deep active:scale-95 disabled:opacity-50"
            >
              {creating ? <Spinner className="size-4" /> : "Create"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
