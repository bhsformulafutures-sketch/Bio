"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { AlbumDetailDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { Header } from "@/components/Header";
import { Button, Skeleton, Spinner, TextInput } from "@/components/ui";
import { GalleryCard } from "@/components/GalleryCard";
import { RandomCard } from "@/components/RandomCard";
import { toast } from "@/components/Toast";
import { tween } from "@/lib/motion";

export default function AlbumPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const albumId = params.id;

  const [album, setAlbum] = useState<AlbumDetailDTO | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { album } = await api.getAlbum(albumId);
      setAlbum(album);
      setName(album.name);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) setMissing(true);
      else if (error instanceof ApiError && error.status === 401) router.replace("/");
      else toast("Couldn't load the album.", "error");
    }
  }, [albumId, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === album?.name) {
      setEditing(false);
      setName(album?.name ?? "");
      return;
    }
    setSaving(true);
    try {
      const { album: updated } = await api.renameAlbum(albumId, trimmed);
      setAlbum((prev) => (prev ? { ...prev, name: updated.name } : prev));
      setEditing(false);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't rename the album.", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    setDeleting(true);
    try {
      await api.deleteAlbum(albumId);
      toast("Album deleted");
      router.replace("/home");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't delete the album.", "error");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (missing) {
    return (
      <div className="min-h-dvh">
        <Header session={null} />
        <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 pt-24 text-center">
          <span className="text-5xl">🕳️</span>
          <p className="text-soft">This album isn&apos;t here anymore.</p>
          <Button onClick={() => router.replace("/home")}>Back home</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-16">
      <Header session={null} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-6">
        <button
          onClick={() => router.back()}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-soft transition-colors hover:text-ink"
        >
          <span className="text-base">←</span> Back
        </button>

        {!album ? (
          <>
            <Skeleton className="h-9 w-56" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </>
        ) : (
          <>
            <header className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                {editing ? (
                  <div className="flex flex-1 items-center gap-2">
                    <TextInput
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={40}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName();
                        if (e.key === "Escape") {
                          setEditing(false);
                          setName(album.name);
                        }
                      }}
                      className="h-11 flex-1"
                    />
                    <Button onClick={saveName} loading={saving} size="sm">
                      Save
                    </Button>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="font-display text-3xl font-bold leading-tight">
                        {album.name}
                      </h1>
                      <button
                        onClick={() => setEditing(true)}
                        className="shrink-0 text-lg text-faint transition-colors hover:text-accent"
                        aria-label="Rename album"
                      >
                        ✎
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-soft">
                      {album.memories.length}{" "}
                      {album.memories.length === 1 ? "memory" : "memories"}
                    </p>
                  </div>
                )}

                <button
                  onClick={remove}
                  disabled={deleting}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors
                    ${confirmDelete ? "bg-red-50 text-red-600" : "text-soft hover:bg-line/60 hover:text-ink"}`}
                >
                  {deleting ? <Spinner className="size-4" /> : confirmDelete ? "Confirm?" : "🗑️"}
                </button>
              </div>
            </header>

            {album.memories.length === 0 ? (
              <div className="dotted flex flex-col items-center gap-3 rounded-lg border border-line py-16 text-center">
                <span className="animate-float text-4xl">🖼️</span>
                <p className="max-w-64 text-sm text-soft">
                  This album is empty. Open any memory and tap{" "}
                  <span className="font-semibold text-ink">Add to album</span> to start filling it.
                </p>
                <Button variant="soft" onClick={() => router.push("/home")}>
                  Browse memories
                </Button>
              </div>
            ) : (
              <motion.div layout className="grid grid-cols-2 gap-3">
                <AnimatePresence mode="popLayout">
                  {album.memories.map((m, i) => (
                    <motion.div
                      key={`${m.kind}:${m.id}`}
                      layout
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={tween.base}
                    >
                      {m.kind === "challenge" && m.challenge ? (
                        <GalleryCard challenge={m.challenge} index={i} delayMs={Math.min(i, 5) * 60} />
                      ) : m.random ? (
                        <RandomCard random={m.random} index={i} delayMs={Math.min(i, 5) * 60} />
                      ) : null}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
