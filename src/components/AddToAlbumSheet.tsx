"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AlbumSummaryDTO, MemoryKind } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { Button, Spinner, TextInput } from "@/components/ui";
import { toast } from "@/components/Toast";
import { spring, tween } from "@/lib/motion";
import { useAmbientGate } from "@/lib/ambient";

/**
 * A bottom sheet for filing one memory into albums. Toggle existing albums or
 * spin up a new one — changes apply immediately (optimistic, with rollback).
 */
export function AddToAlbumSheet({
  kind,
  memoryId,
  open,
  onClose,
  onChanged,
}: {
  kind: MemoryKind;
  memoryId: string;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [albums, setAlbums] = useState<AlbumSummaryDTO[] | null>(null);
  const [inAlbums, setInAlbums] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useAmbientGate(open);

  useEffect(() => {
    if (!open) return;
    setAlbums(null);
    Promise.all([api.listAlbums(), api.albumsForMemory(kind, memoryId)])
      .then(([list, membership]) => {
        setAlbums(list.albums);
        setInAlbums(new Set(membership.albumIds));
      })
      .catch(() => toast("Couldn't load albums.", "error"));
  }, [open, kind, memoryId]);

  const toggle = async (album: AlbumSummaryDTO) => {
    const has = inAlbums.has(album.id);
    setBusy((b) => new Set(b).add(album.id));
    // Optimistic flip.
    setInAlbums((prev) => {
      const next = new Set(prev);
      if (has) next.delete(album.id);
      else next.add(album.id);
      return next;
    });
    try {
      if (has) await api.removeFromAlbum(album.id, kind, memoryId);
      else await api.addToAlbum(album.id, kind, memoryId);
      onChanged?.();
    } catch (error) {
      // Roll back.
      setInAlbums((prev) => {
        const next = new Set(prev);
        if (has) next.add(album.id);
        else next.delete(album.id);
        return next;
      });
      toast(error instanceof ApiError ? error.message : "Couldn't update the album.", "error");
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(album.id);
        return next;
      });
    }
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { album } = await api.createAlbum(name);
      await api.addToAlbum(album.id, kind, memoryId);
      setAlbums((prev) => [{ ...album, count: 1 }, ...(prev ?? [])]);
      setInAlbums((prev) => new Set(prev).add(album.id));
      setNewName("");
      onChanged?.();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't create the album.", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={tween.fast}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative z-10 flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface shadow-lift sm:rounded-3xl"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={spring.gentle}
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <h3 className="font-display text-lg font-bold">Add to album</h3>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full text-soft hover:bg-line/60"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {albums === null ? (
                <div className="flex justify-center py-8 text-soft">
                  <Spinner />
                </div>
              ) : albums.length === 0 ? (
                <p className="py-4 text-center text-sm text-soft">
                  No albums yet — create your first below.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {albums.map((album) => {
                    const checked = inAlbums.has(album.id);
                    return (
                      <li key={album.id}>
                        <button
                          onClick={() => toggle(album)}
                          disabled={busy.has(album.id)}
                          className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors
                            ${checked ? "border-accent/40 bg-accent-soft/60" : "border-line bg-surface hover:border-faint"}`}
                        >
                          <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs text-white transition-colors
                              ${checked ? "border-accent bg-accent" : "border-line bg-transparent"}`}
                          >
                            {checked && "✓"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-ink">{album.name}</span>
                            <span className="block text-xs text-soft">
                              {album.count} {album.count === 1 ? "memory" : "memories"}
                            </span>
                          </span>
                          {busy.has(album.id) && <Spinner className="size-4 text-soft" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-line bg-surface/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2">
                <TextInput
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New album name"
                  maxLength={40}
                  onKeyDown={(e) => e.key === "Enter" && create()}
                  className="h-11 flex-1"
                />
                <Button onClick={create} loading={creating} disabled={!newName.trim()} size="md">
                  Create
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
