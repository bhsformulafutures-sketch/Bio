"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RandomDTO, SessionDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { canvasToBlob, downscale, fileToImage, JPEG_QUALITY } from "@/lib/image-client";
import { CATEGORY_META, type PromptCategory } from "@/lib/games/random/prompts";
import { Header } from "@/components/Header";
import { Avatar, Badge, Button, Card, Skeleton, Spinner, TextInput } from "@/components/ui";
import { Countdown } from "@/components/Countdown";
import { toast } from "@/components/Toast";
import { BlurImage } from "@/components/motion/BlurImage";

const POLL_MS = 8_000;

export default function RandomChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [random, setRandom] = useState<RandomDTO | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Local pick before submitting.
  const [photo, setPhoto] = useState<{ canvas: HTMLCanvasElement; url: string; width: number; height: number } | null>(null);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [me, data] = await Promise.all([api.me(), api.getRandom(id)]);
      setSession(me);
      setRandom((current) => {
        // Celebrate the moment it flips to a full reveal.
        if (current && current.status === "open" && data.random.status === "completed") {
          setJustRevealed(true);
        }
        return data.random;
      });
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 401) router.replace("/");
      else if (status === 404) setNotFound(true);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while the challenge is live and we're waiting on the other person.
  const waiting = random?.status === "open" && random.mineSubmitted && !random.partnerSubmitted;
  useEffect(() => {
    if (!waiting) return;
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [waiting, load]);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("That doesn't look like an image.", "error");
      return;
    }
    try {
      const img = await fileToImage(file);
      const { canvas, width, height } = downscale(img);
      setPhoto({ canvas, url: canvas.toDataURL("image/jpeg", 0.8), width, height });
    } catch {
      toast("Couldn't read that image — try another one.", "error");
    }
  };

  const submit = async () => {
    if (!photo) return;
    setSending(true);
    try {
      const blob = await canvasToBlob(photo.canvas, "image/jpeg", JPEG_QUALITY);
      const { random: updated } = await api.submitRandom(
        id,
        blob,
        photo.width,
        photo.height,
        caption.trim()
      );
      if (updated.status === "completed") setJustRevealed(true);
      setRandom(updated);
      setPhoto(null);
      toast("Answer sent 🎉");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't send — try again.", "error");
      setSending(false);
    }
  };

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-4xl">🫥</span>
        <p className="text-soft">This challenge doesn&apos;t exist (or isn&apos;t yours).</p>
        <Link href="/home">
          <Button variant="soft">Back home</Button>
        </Link>
      </div>
    );
  }

  if (!random) {
    return (
      <div className="min-h-dvh pb-12">
        <Header session={session} />
        <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-5">
          <Skeleton className="h-4 w-16" />
          <div className="flex flex-col gap-3 rounded-3xl bg-line/40 p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  const meta = CATEGORY_META[random.category as PromptCategory];
  const partnerName = session?.partner?.name ?? "your partner";
  const revealed = random.status !== "open";
  const bothIn = random.submissions.length >= 2;

  return (
    <div className="min-h-dvh pb-12">
      <Header session={session} />
      <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-5">
        <Link
          href="/home"
          className="w-fit text-sm font-medium text-faint transition-colors hover:text-soft"
        >
          ← Home
        </Link>

        {/* Prompt card */}
        <Card className="animate-fade-up overflow-hidden">
          <div className="flex flex-col gap-3 bg-gradient-to-br from-dusk-soft to-accent-soft p-5">
            <div className="flex items-center justify-between">
              <Badge tone="dusk">
                {meta?.emoji} {meta?.label ?? "Prompt"}
              </Badge>
              {random.status === "open" ? (
                <span className="text-sm font-semibold text-soft">
                  ⏳ <Countdown expiresAt={random.expiresAt} onExpire={load} /> left
                </span>
              ) : random.status === "expired" ? (
                <Badge tone="line">Time&apos;s up</Badge>
              ) : (
                <Badge tone="soft">💞 Complete</Badge>
              )}
            </div>
            <p className="font-display text-2xl font-bold leading-snug text-ink">
              {random.prompt}
            </p>
            <p className="text-xs text-soft">
              {random.starter.name} started this · you both have 24 hours to snap it.
            </p>
          </div>
        </Card>

        {/* Reveal — both photos side by side */}
        {revealed && bothIn && (
          <section
            className={`flex flex-col gap-3 ${justRevealed ? "animate-rise" : "animate-fade-up"}`}
          >
            {justRevealed && (
              <p className="text-center font-display text-lg font-bold text-accent">
                ✨ You both saw the same world today ✨
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {random.submissions.map((s) => (
                <figure
                  key={s.participant.id}
                  className="overflow-hidden rounded-2xl bg-surface shadow-card"
                >
                  <BlurImage
                    src={s.photoUrl}
                    alt={`${s.participant.name}'s answer`}
                    wrapperClassName="relative aspect-square w-full"
                    className="h-full w-full object-cover"
                  />
                  <figcaption className="flex flex-col gap-0.5 px-3 py-2">
                    <span className="text-[13px] font-semibold text-ink">
                      {s.mine ? "You" : s.participant.name}
                    </span>
                    {s.caption && <span className="text-xs text-soft">{s.caption}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
            {justRevealed && (
              <Link href="/home">
                <Button variant="soft" className="w-full">
                  Saved to your memories — back home
                </Button>
              </Link>
            )}
          </section>
        )}

        {/* Expired with only one (or no) answer */}
        {random.status === "expired" && !bothIn && (
          <Card className="animate-fade-up flex flex-col items-center gap-3 p-8 text-center">
            <span className="text-4xl">🌙</span>
            <p className="text-sm text-soft">
              The 24 hours ran out. {random.mineSubmitted
                ? `${partnerName} didn't get to answer this time.`
                : "Neither of you answered — catch the next one!"}
            </p>
            <Button variant="soft" onClick={() => router.push("/home")}>
              Back home
            </Button>
          </Card>
        )}

        {/* Your move — upload */}
        {random.status === "open" && !random.mineSubmitted && (
          <div className="animate-fade-up flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {!photo ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="dotted flex flex-col items-center justify-center gap-3 rounded-3xl
                  border-2 border-dashed border-line bg-surface/50 py-16 transition-all
                  hover:border-accent/50 hover:bg-accent-soft/30 active:scale-[0.99]"
              >
                <span className="animate-float text-4xl">📸</span>
                <span className="font-semibold text-ink">Snap your answer</span>
                <span className="text-sm text-faint">Camera or camera roll</span>
              </button>
            ) : (
              <>
                <div className="relative overflow-hidden rounded-2xl shadow-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="Your answer" className="w-full" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute right-2.5 top-2.5 rounded-full bg-ink/70 px-3 py-1.5 text-xs
                      font-semibold text-white backdrop-blur-sm transition-transform active:scale-95"
                  >
                    Retake
                  </button>
                </div>
                <TextInput
                  placeholder="Add a little caption (optional)"
                  value={caption}
                  maxLength={140}
                  onChange={(e) => setCaption(e.target.value)}
                />
                <Button size="lg" onClick={submit} loading={sending}>
                  {sending ? "Sending…" : "Send my answer"}
                </Button>
                <p className="text-center text-xs text-faint">
                  {partnerName}&apos;s photo stays hidden until you&apos;ve both answered 🤫
                </p>
              </>
            )}
          </div>
        )}

        {/* Submitted, waiting for partner */}
        {random.status === "open" && random.mineSubmitted && !random.partnerSubmitted && (
          <div className="animate-fade-up flex flex-col gap-4">
            {random.submissions
              .filter((s) => s.mine)
              .map((s) => (
                <div key={s.participant.id} className="overflow-hidden rounded-2xl shadow-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.photoUrl} alt="Your answer" className="w-full" draggable={false} />
                </div>
              ))}
            <Card className="flex items-center gap-3 p-4">
              <Avatar avatar={session?.partner?.avatar} name={partnerName} className="size-10" />
              <div className="flex-1">
                <p className="font-semibold text-ink">Waiting on {partnerName}…</p>
                <p className="text-sm text-soft">
                  We&apos;ll reveal both the moment they answer.
                </p>
              </div>
              <Spinner className="size-5 text-dusk" />
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
