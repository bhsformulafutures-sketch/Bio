"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { AlbumDTO, ChallengeDTO, RandomDTO, SessionDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { Header } from "@/components/Header";
import { Button, Card, Skeleton } from "@/components/ui";
import { GalleryCard } from "@/components/GalleryCard";
import { RandomCard } from "@/components/RandomCard";
import { BlurImage } from "@/components/motion/BlurImage";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { toast } from "@/components/Toast";
import { spring } from "@/lib/motion";

type MemoryKind = "challenge" | "random";

/** A game-agnostic memory tile used inside albums. */
interface Memory {
  kind: MemoryKind;
  id: string;
  key: string;
  coverUrl: string | null;
  width: number;
  height: number;
  challenge?: ChallengeDTO;
  random?: RandomDTO;
}

export default function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [album, setAlbum] = useState<AlbumDTO | null>(null);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [mode, setMode] = useState<"view" | "add">("view");
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, alb, chal, rand] = await Promise.all([
        api.me(),
        api.getAlbum(id),
        api.listChallenges(),
        api.listRandoms(),
      ]);
      setSession(me);
      setAlbum(alb.album);
      setKeys(new Set(alb.album.itemKeys));
      const mem: Memory[] = [
        ...chal.challenges
          .filter((c) => c.status === "completed")
          .map((c) => ({
            kind: "challenge" as const,
            id: c.id,
            key: `challenge:${c.id}`,
            coverUrl: c.mergedUrl ?? c.visibleUrl,
            width: c.width,
            height: c.height,
            challenge: c,
          })),
        ...rand.randoms
          .filter((r) => r.status !== "open")
          .map((r) => ({
            kind: "random" as const,
            id: r.id,
            key: `random:${r.id}`,
            coverUrl: r.submissions[0]?.photoUrl ?? null,
            width: 1,
            height: 1,
            random: r,
          })),
      ];
      setMemories(mem);
    } catch (error) {
      if ((error as { status?: number }).status === 401) router.replace("/");
      else if ((error as { status?: number }).status === 404) router.replace("/home");
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const inAlbum = useMemo(
    () => memories?.filter((m) => keys.has(m.key)) ?? [],
    [memories, keys]
  );

  const toggle = async (m: Memory) => {
    const has = keys.has(m.key);
    // optimistic
    setKeys((prev) => {
      const next = new Set(prev);
      if (has) next.delete(m.key);
      else next.add(m.key);
      return next;
    });
    try {
      if (has) await api.removeFromAlbum(id, m.kind, m.id);
      else await api.addToAlbum(id, m.kind, m.id);
    } catch (error) {
      // revert
      setKeys((prev) => {
        const next = new Set(prev);
        if (has) next.add(m.key);
        else next.delete(m.key);
        return next;
      });
      toast(error instanceof ApiError ? error.message : "Couldn't update album.", "error");
    }
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    setEditing(false);
    if (!trimmed || !album || trimmed === album.name) return;
    const prev = album.name;
    setAlbum({ ...album, name: trimmed });
    try {
      await api.renameAlbum(id, trimmed);
    } catch (error) {
      setAlbum((a) => (a ? { ...a, name: prev } : a));
      toast(error instanceof ApiError ? error.message : "Couldn't rename.", "error");
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    try {
      await api.deleteAlbum(id);
      toast("Album deleted");
      router.replace("/home");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't delete.", "error");
    }
  };

  if (!album || !memories) {
    return (
      <div className="min-h-dvh">
        <Header session={session} />
        <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-8">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-16">
      <Header session={session} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => router.push("/home")}
              className="mb-1 text-sm font-medium text-faint transition-colors hover:text-soft"
            >
              ← Home
            </button>
            {editing ? (
              <input
                autoFocus
                value={nameDraft}
                maxLength={40}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="w-full border-b-2 border-accent bg-transparent font-display text-3xl font-bold text-ink focus:outline-none"
              />
            ) : (
              <button
                onClick={() => {
                  setNameDraft(album.name);
                  setEditing(true);
                }}
                className="group flex items-center gap-2 text-left"
              >
                <h1 className="font-display text-3xl font-bold leading-tight">{album.name}</h1>
                <span className="text-sm text-faint opacity-0 transition-opacity group-hover:opacity-100">
                  ✏️
                </span>
              </button>
            )}
            <p className="mt-1 text-sm text-soft">
              {inAlbum.length} {inAlbum.length === 1 ? "memory" : "memories"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={mode === "add" ? "primary" : "soft"}
            size="sm"
            onClick={() => setMode((m) => (m === "add" ? "view" : "add"))}
          >
            {mode === "add" ? "Done adding" : "＋ Add memories"}
          </Button>
          <Button variant="ghost" size="sm" onClick={remove}>
            {confirmDelete ? "Tap again to delete album" : "🗑️ Delete album"}
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "add" ? (
            <motion.section
              key="picker"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.gentle}
              className="flex flex-col gap-3"
            >
              <p className="text-sm text-soft">
                Tap a memory to add or remove it from <b>{album.name}</b>.
              </p>
              {memories.length === 0 ? (
                <EmptyMemories />
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {memories.map((m) => (
                    <PickerThumb
                      key={m.key}
                      memory={m}
                      selected={keys.has(m.key)}
                      onToggle={() => toggle(m)}
                    />
                  ))}
                </div>
              )}
            </motion.section>
          ) : (
            <motion.section
              key="view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.gentle}
            >
              {inAlbum.length === 0 ? (
                <div className="dotted flex flex-col items-center gap-3 rounded-3xl border border-line py-16 text-center">
                  <span className="animate-float text-4xl">🖼️</span>
                  <p className="max-w-64 text-sm text-soft">
                    This album is empty. Tap <b>＋ Add memories</b> to fill it with your
                    favourite moments.
                  </p>
                </div>
              ) : (
                <RevealGroup className="grid grid-cols-2 gap-3" stagger={0.05}>
                  {inAlbum.map((m, i) => (
                    <RevealItem key={m.key}>
                      {m.challenge ? (
                        <GalleryCard challenge={m.challenge} index={i} />
                      ) : m.random ? (
                        <RandomCard random={m.random} index={i} />
                      ) : null}
                    </RevealItem>
                  ))}
                </RevealGroup>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function EmptyMemories() {
  return (
    <div className="dotted flex flex-col items-center gap-2 rounded-2xl border border-line py-12 text-center">
      <span className="text-3xl">🌱</span>
      <p className="max-w-64 text-sm text-soft">
        No finished memories yet — play a game first, then gather them here.
      </p>
    </div>
  );
}

function PickerThumb({
  memory,
  selected,
  onToggle,
}: {
  memory: Memory;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.94 }}
      transition={spring.snappy}
      className="relative aspect-square overflow-hidden rounded-xl bg-line shadow-card"
    >
      {memory.coverUrl ? (
        <BlurImage
          src={memory.coverUrl}
          alt=""
          wrapperClassName="h-full w-full"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-2xl">📸</span>
      )}
      <motion.span
        initial={false}
        animate={{ opacity: selected ? 1 : 0 }}
        className="absolute inset-0 flex items-center justify-center bg-accent/40"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-white text-accent shadow-lift">
          ✓
        </span>
      </motion.span>
    </motion.button>
  );
}
