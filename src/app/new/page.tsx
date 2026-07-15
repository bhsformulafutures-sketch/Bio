"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { HiddenSide, SessionDTO } from "@/lib/types";
import { hiddenRect, rollRandomRegion } from "@/lib/region";
import {
  canvasToBlob,
  downscale,
  fileToImage,
  makeVisibleCanvas,
  JPEG_QUALITY,
} from "@/lib/image-client";
import { api, ApiError } from "@/lib/api";
import { Header } from "@/components/Header";
import { Button, Card } from "@/components/ui";
import { toast } from "@/components/Toast";
import { motion } from "motion/react";
import { spring } from "@/lib/motion";

type SideChoice = HiddenSide | "random";
const FIXED_RATIO = 0.45;

const CHOICES: Array<{ id: SideChoice; label: string; icon: string }> = [
  { id: "random", label: "Random", icon: "🎲" },
  { id: "left", label: "Left", icon: "◧" },
  { id: "right", label: "Right", icon: "◨" },
  { id: "top", label: "Top", icon: "⬒" },
  { id: "bottom", label: "Bottom", icon: "⬓" },
];

export default function NewChallengePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [photo, setPhoto] = useState<{
    canvas: HTMLCanvasElement;
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [choice, setChoice] = useState<SideChoice>("random");
  const [region, setRegion] = useState(() => rollRandomRegion());
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .me()
      .then(setSession)
      .catch(() => router.replace("/"));
  }, [router]);

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

  const selectChoice = (next: SideChoice) => {
    setChoice(next);
    if (next === "random") setRegion(rollRandomRegion()); // re-tap re-rolls 🎲
    else setRegion({ side: next, ratio: FIXED_RATIO });
  };

  const rect = useMemo(() => {
    if (!photo) return null;
    return hiddenRect(region.side, region.ratio, photo.width, photo.height);
  }, [photo, region]);

  const send = async () => {
    if (!photo || !rect) return;
    setSending(true);
    try {
      const visibleCanvas = makeVisibleCanvas(photo.canvas, rect);
      const [original, visible] = await Promise.all([
        canvasToBlob(photo.canvas, "image/jpeg", JPEG_QUALITY),
        canvasToBlob(visibleCanvas, "image/jpeg", JPEG_QUALITY),
      ]);
      const form = new FormData();
      form.append("original", original, "original.jpg");
      form.append("visible", visible, "visible.jpg");
      form.append("side", region.side);
      form.append("ratio", String(region.ratio));
      form.append("width", String(photo.width));
      form.append("height", String(photo.height));
      await api.createChallenge(form);
      toast("Challenge sent 🎉");
      router.replace("/home");
    } catch (error) {
      toast(
        error instanceof ApiError ? error.message : "Upload failed — try again.",
        "error"
      );
      setSending(false);
    }
  };

  return (
    <div className="min-h-dvh pb-10">
      <Header session={session} />
      <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-6">
        <div className="animate-fade-up">
          <h1 className="font-display text-2xl font-bold">New challenge</h1>
          <p className="mt-1 text-[15px] text-soft">
            Pick a photo — we&apos;ll hide part of it for{" "}
            {session?.partner?.name ?? "your partner"} to imagine.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />

        {!photo ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="dotted animate-fade-up flex flex-col items-center justify-center gap-3 rounded-lg
              border-2 border-dashed border-line bg-surface/50 py-20 transition-all
              hover:border-accent/50 hover:bg-accent-soft/30 active:scale-[0.99]"
          >
            <span className="animate-float text-4xl">📷</span>
            <span className="font-semibold text-ink">Choose a photo</span>
            <span className="text-sm text-faint">From your camera roll or files</span>
          </button>
        ) : (
          <>
            <div
              className="animate-pop relative w-full overflow-hidden rounded-lg shadow-card"
              style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="Your chosen photo" className="absolute inset-0 h-full w-full" />
              {rect && (
                <div
                  className="absolute flex items-center justify-center bg-ink/60 backdrop-blur-md transition-all duration-300"
                  style={{
                    left: `${(rect.x / photo.width) * 100}%`,
                    top: `${(rect.y / photo.height) * 100}%`,
                    width: `${(rect.w / photo.width) * 100}%`,
                    height: `${(rect.h / photo.height) * 100}%`,
                  }}
                >
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ink">
                    Hidden 🤫
                  </span>
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute right-2.5 top-2.5 rounded-full bg-ink/70 px-3 py-1.5 text-xs
                  font-semibold text-white backdrop-blur-sm transition-transform active:scale-95"
              >
                Change photo
              </button>
            </div>

            <Card className="animate-fade-up flex flex-col gap-3 p-4">
              <p className="text-sm font-semibold text-soft">Which part should we hide?</p>
              <div className="grid grid-cols-5 gap-1.5">
                {CHOICES.map((c) => (
                  <motion.button
                    key={c.id}
                    onClick={() => selectChoice(c.id)}
                    whileTap={{ scale: 0.9 }}
                    animate={choice === c.id ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                    transition={spring.snappy}
                    className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-lg transition-colors ${
                      choice === c.id
                        ? "bg-ink text-white shadow-card"
                        : "bg-paper text-soft hover:bg-line/70"
                    }`}
                  >
                    <span aria-hidden>{c.icon}</span>
                    <span className="text-[11px] font-semibold">{c.label}</span>
                  </motion.button>
                ))}
              </div>
              {choice === "random" && (
                <p className="text-center text-xs text-faint">
                  Tap 🎲 again to re-roll
                </p>
              )}
            </Card>

            <Button size="lg" onClick={send} loading={sending}>
              {sending ? "Sending…" : "Send challenge"}
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
