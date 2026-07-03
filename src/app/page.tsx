"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button, Card, TextInput } from "@/components/ui";
import { Logo } from "@/components/Header";
import { toast } from "@/components/Toast";

type Mode = "menu" | "create" | "join";

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("menu");
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  /* Returning visitors skip straight to their room. */
  useEffect(() => {
    api
      .me()
      .then(() => router.replace("/home"))
      .catch(() => setChecking(false));
  }, [router]);

  const submit = async () => {
    if (!name.trim()) {
      toast("What should we call you?", "error");
      return;
    }
    if (mode === "join" && code.trim().length < 4) {
      toast("That room code looks too short.", "error");
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") await api.createRoom(name.trim());
      else await api.joinRoom(code.trim(), name.trim());
      router.replace("/home");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Something went wrong.", "error");
      setBusy(false);
    }
  };

  if (checking) {
    return <div className="min-h-dvh bg-paper" />;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="animate-fade-up text-center">
        <Logo className="text-4xl" />
        <p className="mt-4 text-balance text-lg leading-relaxed text-soft">
          One of you shares half a photo.
          <br />
          The other imagines the missing half.
          <br />
          <span className="font-semibold text-ink">Then the truth comes out.</span>
        </p>
      </div>

      {/* playful hero: a torn photo */}
      <div className="animate-fade-up" style={{ animationDelay: "80ms" }} aria-hidden>
        <div
          className="animate-float-slow mx-auto flex w-56 -rotate-2 overflow-hidden rounded-2xl border-4 border-white shadow-polaroid"
          style={{ aspectRatio: "4 / 3" }}
        >
          <div className="relative w-1/2 bg-gradient-to-br from-sky-200 to-emerald-200">
            <div className="absolute bottom-2 left-2 size-8 rounded-full bg-amber-300" />
            <div className="absolute right-0 top-0 h-full w-px border-r-2 border-dashed border-white/80" />
          </div>
          <div className="dotted relative w-1/2 bg-surface">
            <svg viewBox="0 0 60 45" className="absolute inset-0 h-full w-full text-accent">
              <path
                d="M8 36 C 18 12, 26 10, 34 24 S 48 30, 54 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="16" cy="14" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>

      {mode === "menu" ? (
        <div className="animate-fade-up flex flex-col gap-3" style={{ animationDelay: "160ms" }}>
          <Button size="lg" onClick={() => setMode("create")}>
            Create our room
          </Button>
          <Button size="lg" variant="outline" onClick={() => setMode("join")}>
            I have a room code
          </Button>
        </div>
      ) : (
        <Card className="animate-pop flex flex-col gap-3 p-5">
          <p className="text-center font-semibold">
            {mode === "create" ? "Start your shared room" : "Join your partner"}
          </p>
          <TextInput
            placeholder="Your name"
            value={name}
            maxLength={30}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && mode === "create" && submit()}
          />
          {mode === "join" && (
            <TextInput
              placeholder="Room code"
              value={code}
              maxLength={8}
              autoCapitalize="characters"
              className="text-center font-mono text-lg tracking-[0.3em] uppercase"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          )}
          <Button size="lg" onClick={submit} loading={busy}>
            {mode === "create" ? "Create room" : "Join room"}
          </Button>
          <button
            className="py-1 text-sm font-medium text-faint transition-colors hover:text-soft"
            onClick={() => setMode("menu")}
          >
            Back
          </button>
        </Card>
      )}

      <p className="text-center text-xs text-faint">
        No accounts. No feeds. Just the two of you.
      </p>
    </main>
  );
}
