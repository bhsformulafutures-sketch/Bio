"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { preparePhoto, photoToBlob, type PickedPhoto } from "@/lib/games/whereami/image";
import { Header } from "@/components/Header";
import { Button, Card, TextInput } from "@/components/ui";
import { toast } from "@/components/Toast";

const MAX_ANSWER = 80;
const MAX_HINT = 120;

const HINT_FIELDS = [
  { label: "Barely a clue", placeholder: "Something only a detective would use…" },
  { label: "Warmer…", placeholder: "Narrow it down a little." },
  { label: "Basically telling them", placeholder: "Alright, practically spell it out." },
] as const;

export default function NewWhereAmIPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [answer, setAnswer] = useState("");
  const [hints, setHints] = useState<[string, string, string]>(["", "", ""]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .me()
      .then(setSession)
      .catch(() => router.replace("/"));
  }, [router]);

  const partnerName = session?.partner?.name ?? "your partner";

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("That doesn't look like an image.", "error");
      return;
    }
    try {
      setPhoto(await preparePhoto(file));
    } catch {
      toast("Couldn't read that image — try another one.", "error");
    }
  };

  const setHint = (index: number, value: string) => {
    setHints((current) => {
      const next = [...current] as [string, string, string];
      next[index] = value;
      return next;
    });
  };

  const ready =
    photo !== null &&
    answer.trim().length > 0 &&
    hints.every((h) => h.trim().length > 0);

  const send = async () => {
    if (!photo || !ready) return;
    setSending(true);
    try {
      const blob = await photoToBlob(photo);
      const form = new FormData();
      form.append("photo", blob, "photo.jpg");
      form.append("width", String(photo.width));
      form.append("height", String(photo.height));
      form.append("answer", answer.trim());
      for (const hint of hints) form.append("hints", hint.trim());
      const { round } = await api.createWhereAmI(form);
      toast("Round sent — let the guessing begin 🎉");
      router.replace(`/whereami/${round.id}`);
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
          <Link
            href="/home"
            className="text-sm font-medium text-faint transition-colors hover:text-soft"
          >
            ← Home
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold">Where am I?</h1>
          <p className="mt-1 text-[15px] text-soft">
            Snap where you are right now — {partnerName} gets four guesses to
            name the place.
          </p>
        </div>

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
            className="dotted animate-fade-up flex flex-col items-center justify-center gap-3 rounded-3xl
              border-2 border-dashed border-line bg-surface/50 py-20 transition-all
              hover:border-accent/50 hover:bg-accent-soft/30 active:scale-[0.99]"
          >
            <span className="animate-float text-4xl">📍</span>
            <span className="font-semibold text-ink">Snap your spot</span>
            <span className="text-sm text-faint">Camera or camera roll</span>
          </button>
        ) : (
          <>
            <div
              className="animate-pop relative w-full overflow-hidden rounded-2xl shadow-card"
              style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt="Where you are"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute right-2.5 top-2.5 rounded-full bg-ink/70 px-3 py-1.5 text-xs
                  font-semibold text-white backdrop-blur-sm transition-transform active:scale-95"
              >
                Retake
              </button>
            </div>

            <Card className="animate-fade-up flex flex-col gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-soft">The secret answer</p>
                <p className="text-xs text-faint">
                  The place name {partnerName} has to land on — close counts.
                </p>
              </div>
              <TextInput
                placeholder="e.g. the coffee shop on 5th"
                value={answer}
                maxLength={MAX_ANSWER}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </Card>

            <Card className="animate-fade-up flex flex-col gap-4 p-4">
              <div>
                <p className="text-sm font-semibold text-soft">Three hints</p>
                <p className="text-xs text-faint">
                  One unlocks after each wrong guess — start vague, end generous.
                </p>
              </div>
              {HINT_FIELDS.map((field, index) => (
                <label key={field.label} className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-ink">
                    <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded-full bg-dusk-soft text-[11px] font-bold text-dusk">
                      {index + 1}
                    </span>
                    {field.label}
                  </span>
                  <TextInput
                    placeholder={field.placeholder}
                    value={hints[index]}
                    maxLength={MAX_HINT}
                    onChange={(e) => setHint(index, e.target.value)}
                  />
                </label>
              ))}
            </Card>

            <Button size="lg" onClick={send} loading={sending} disabled={!ready}>
              {sending ? "Sending…" : "Send the mystery"}
            </Button>
            <p className="text-center text-xs text-faint">
              {partnerName} sees only the photo — hints unlock one wrong guess
              at a time 🤫
            </p>
          </>
        )}
      </main>
    </div>
  );
}
