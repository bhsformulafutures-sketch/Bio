"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AlbumDTO, ChallengeDTO, SessionDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { Header } from "@/components/Header";
import { Button, Spinner, TextInput } from "@/components/ui";
import { Modal, PageTransition, Reveal, Skeleton } from "@/components/motion";
import { albumTilt } from "@/components/AlbumCover";
import { formatDate } from "@/components/GalleryCard";
import { toast } from "@/components/Toast";

export default function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [album, setAlbum] = useState<AlbumDTO | null>(null);
  const [memories, setMemories] = useState<ChallengeDTO[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [me, albumsRes, challengesRes] = await Promise.all([
        api.me(),
        api.listAlbums(),
        api.listChallenges(),
      ]);
      setSession(me);
      const found = albumsRes.albums.find((a) => a.id === id);
      if (!found) {
        setNotFound(true);
        return;
      }
      setAlbum(found);
      const byId = new Map(challengesRes.challenges.map((c) => [c.id, c]));
      setMemories(found.memoryIds.map((mid) => byId.get(mid)).filter(Boolean) as ChallengeDTO[]);
    } catch (error) {
      if ((error as { status?: number }).status === 401) router.replace("/");
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const rename = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const { album: updated } = await api.renameAlbum(id, name);
      setAlbum((a) => (a ? { ...a, name: updated.name } : a));
      setRenaming(false);
      toast("Album renamed ✏️");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't rename.", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteAlbum(id);
      toast("Album deleted");
      router.replace("/home");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't delete.", "error");
      setBusy(false);
    }
  };

  const removeMemory = async (challengeId: string) => {
    setRemoving(challengeId);
    try {
      await api.removeFromAlbum(id, challengeId);
      setMemories((list) => (list ? list.filter((c) => c.id !== challengeId) : list));
      setAlbum((a) =>
        a ? { ...a, memoryIds: a.memoryIds.filter((m) => m !== challengeId), count: a.count - 1 } : a
      );
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't remove.", "error");
    } finally {
      setRemoving(null);
    }
  };

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-4xl">📭</span>
        <p className="text-soft">This album doesn&apos;t exist anymore.</p>
        <Link href="/home">
          <Button variant="soft">Back home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-16">
      <Header session={session} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-5">
        <Link
          href="/home"
          className="w-fit text-sm font-medium text-faint transition-colors hover:text-soft"
        >
          ← Home
        </Link>

        {!album || !memories ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-52" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="aspect-[4/3]" />
              <Skeleton className="aspect-[4/3]" />
              <Skeleton className="aspect-[4/3]" />
              <Skeleton className="aspect-[4/3]" />
            </div>
          </div>
        ) : (
          <>
            <PageTransition className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-2xl shadow-card"
                  style={{ transform: `rotate(${albumTilt(album.id)}deg)` }}
                >
                  📔
                </span>
                <div>
                  <h1 className="font-display text-2xl font-bold leading-tight">{album.name}</h1>
                  <p className="mt-0.5 text-sm text-soft">
                    {album.count} {album.count === 1 ? "memory" : "memories"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => {
                    setNewName(album.name);
                    setRenaming(true);
                  }}
                  className="flex size-9 items-center justify-center rounded-full border border-line bg-surface
                    text-soft transition-all hover:border-faint hover:text-ink active:scale-90"
                  aria-label="Rename album"
                  title="Rename"
                >
                  ✏️
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex size-9 items-center justify-center rounded-full border border-line bg-surface
                    text-soft transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-90"
                  aria-label="Delete album"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </PageTransition>

            {memories.length === 0 ? (
              <div className="dotted flex flex-col items-center gap-3 rounded-3xl border border-line py-16 text-center">
                <span className="animate-float text-3xl">🖼️</span>
                <p className="max-w-64 text-sm text-soft">
                  This album is empty. Open a memory and tap{" "}
                  <span className="font-semibold text-ink">Add to album</span> to slip it in here.
                </p>
                <Link href="/home">
                  <Button variant="soft" size="sm">Browse memories</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {memories.map((c, i) => (
                  <Reveal key={c.id} delay={i * 40}>
                    <div className="group relative">
                      <Link
                        href={`/challenge/${c.id}`}
                        className="block overflow-hidden rounded-2xl bg-surface shadow-card transition-all
                          duration-200 hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]"
                      >
                        <div
                          className="relative w-full overflow-hidden bg-line"
                          style={{ aspectRatio: `${c.width} / ${c.height}` }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={c.mergedUrl ?? c.visibleUrl}
                            alt="Memory"
                            loading="lazy"
                            draggable={false}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <p className="truncate text-[13px] text-soft">
                            📸 {c.creator.name}
                            {c.solver && <> · ✏️ {c.solver.name}</>}
                          </p>
                          <span className="shrink-0 text-xs text-faint">
                            {formatDate(c.completedAt ?? c.createdAt)}
                          </span>
                        </div>
                      </Link>
                      <button
                        onClick={() => removeMemory(c.id)}
                        disabled={removing === c.id}
                        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full
                          bg-ink/65 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-ink
                          active:scale-90 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Remove from album"
                        title="Remove from album"
                      >
                        {removing === c.id ? <Spinner className="size-3.5" /> : "✕"}
                      </button>
                    </div>
                  </Reveal>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* rename */}
      <Modal open={renaming} onClose={() => !busy && setRenaming(false)} labelledBy="rename-title">
        <div className="flex flex-col gap-4">
          <h3 id="rename-title" className="text-center font-display text-xl font-bold">
            Rename album
          </h3>
          <TextInput
            autoFocus
            value={newName}
            maxLength={60}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rename()}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRenaming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={rename} disabled={busy}>
              {busy ? <Spinner className="size-4" /> : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* delete */}
      <Modal open={confirmDelete} onClose={() => !busy && setConfirmDelete(false)} labelledBy="delete-title">
        <div className="flex flex-col gap-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
            🗑️
          </div>
          <div>
            <h3 id="delete-title" className="font-display text-xl font-bold">
              Delete this album?
            </h3>
            <p className="mt-1 text-sm text-soft">
              The album disappears, but your memories stay safe in the gallery.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Keep it
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={remove}
              disabled={busy}
            >
              {busy ? <Spinner className="size-4" /> : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
