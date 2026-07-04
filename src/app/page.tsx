"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Avatar, Button, Card, Skeleton, TextInput } from "@/components/ui";
import { Logo } from "@/components/Header";
import { toast } from "@/components/Toast";
import {
  CODE_SUGGESTIONS,
  ROOM_CODE_MAX,
  normalizeRoomCode,
  roomCodeError,
} from "@/lib/room-code";

type Step = "welcome" | "profile" | "room";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [checking, setChecking] = useState(true);

  // Resume wherever this device left off — no repeated sign-in.
  useEffect(() => {
    api
      .authState()
      .then((state) => {
        if (state.hasRoom) return router.replace("/home");
        if (state.authenticated) setStep("room");
        else setStep("welcome");
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <Hero />
      {/* key remounts on step change so each panel plays its entrance */}
      <div key={step} className="animate-rise">
        {step === "welcome" && <Welcome onNext={() => setStep("profile")} />}
        {step === "profile" && <ProfileStep onNext={() => setStep("room")} />}
        {step === "room" && <RoomStep onHome={() => router.replace("/home")} />}
      </div>

      <Dots step={step} />
    </main>
  );
}

function Hero() {
  return (
    <div className="text-center">
      <Logo className="text-4xl" />
      <p className="mt-4 text-balance text-[15px] leading-relaxed text-soft">
        A tiny, private world for two — little photo games, shared moments,
        <span className="font-semibold text-ink"> just the two of you.</span>
      </p>
      {/* two hearts drifting toward each other */}
      <div className="mx-auto mt-6 flex w-40 items-center justify-center gap-1" aria-hidden>
        <span className="animate-float text-2xl" style={{ animationDelay: "0ms" }}>💌</span>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-line to-transparent" />
        <span className="animate-heartbeat text-xl text-accent">♥</span>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-line to-transparent" />
        <span className="animate-float text-2xl" style={{ animationDelay: "600ms" }}>📸</span>
      </div>
    </div>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" onClick={onNext}>
        Get started
      </Button>
      <p className="text-center text-xs text-faint">
        No email, no passwords — just a name and a secret room.
      </p>
    </div>
  );
}

function ProfileStep({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState("");
  const [avatars, setAvatars] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getAvatars().then(({ avatars }) => {
      setAvatars(avatars);
      setAvatar(avatars[Math.floor(Math.random() * avatars.length)] ?? null);
    });
  }, []);

  const submit = async () => {
    if (!name.trim()) {
      toast("What should we call you?", "error");
      return;
    }
    setBusy(true);
    try {
      await api.saveAccount(name.trim(), avatar);
      onNext();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't save your profile.", "error");
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col items-center gap-2">
        <Avatar avatar={avatar} name={name} className="size-16 animate-pop text-3xl" />
        <p className="font-semibold">Make it yours</p>
      </div>
      <TextInput
        placeholder="Your name"
        value={name}
        autoFocus
        maxLength={30}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Pick a look</p>
        <div className="grid grid-cols-8 gap-1.5">
          {avatars.map((a) => (
            <button
              key={a}
              onClick={() => setAvatar(a)}
              className={`flex aspect-square items-center justify-center rounded-xl text-xl transition-all active:scale-90 ${
                avatar === a
                  ? "bg-accent-soft ring-2 ring-accent"
                  : "bg-paper hover:bg-line"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <Button size="lg" onClick={submit} loading={busy}>
        Continue
      </Button>
    </Card>
  );
}

function RoomStep({ onHome }: { onHome: () => void }) {
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  const create = async () => {
    const normalized = normalizeRoomCode(code);
    const problem = roomCodeError(normalized);
    if (problem) {
      toast(problem, "error");
      return;
    }
    setBusy("create");
    try {
      await api.createRoom(normalized);
      onHome();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't create the room.", "error");
      setBusy(null);
    }
  };

  const join = async () => {
    const normalized = normalizeRoomCode(code);
    if (normalized.length < 4) {
      toast("That room code looks too short.", "error");
      return;
    }
    setBusy("join");
    try {
      await api.joinRoom(normalized);
      onHome();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't join that room.", "error");
      setBusy(null);
    }
  };

  if (mode === "create") {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <div className="text-center">
          <p className="font-semibold">Name your room</p>
          <p className="mt-1 text-xs text-faint">
            Pick a secret word you&apos;ll both remember. They&apos;ll type it to join.
          </p>
        </div>
        <TextInput
          placeholder="SUNFLOWERS"
          value={code}
          autoFocus
          maxLength={ROOM_CODE_MAX}
          autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && create()}
          className="text-center font-mono text-lg uppercase tracking-[0.25em]"
        />
        <div className="flex flex-wrap justify-center gap-1.5">
          {CODE_SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setCode(s)}
              className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-soft transition-colors hover:bg-accent-soft hover:text-accent-deep"
            >
              {s}
            </button>
          ))}
        </div>
        <Button size="lg" onClick={create} loading={busy === "create"}>
          Create our room
        </Button>
        <button
          className="py-1 text-sm font-medium text-faint transition-colors hover:text-soft"
          onClick={() => setMode("menu")}
        >
          Back
        </button>
      </Card>
    );
  }

  if (mode === "join") {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <p className="text-center font-semibold">Join your other half</p>
        <TextInput
          placeholder="ROOM CODE"
          value={code}
          autoFocus
          maxLength={ROOM_CODE_MAX}
          autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && join()}
          className="text-center font-mono text-lg uppercase tracking-[0.25em]"
        />
        <Button size="lg" onClick={join} loading={busy === "join"}>
          Join room
        </Button>
        <button
          className="py-1 text-sm font-medium text-faint transition-colors hover:text-soft"
          onClick={() => setMode("menu")}
        >
          Back
        </button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" onClick={() => setMode("create")}>
        Create our room
      </Button>
      <Button size="lg" variant="outline" onClick={() => setMode("join")}>
        I have a room code
      </Button>
      <p className="text-center text-xs text-faint">
        One room links the two of you — forever.
      </p>
    </div>
  );
}

function Dots({ step }: { step: Step }) {
  const order: Step[] = ["welcome", "profile", "room"];
  const active = order.indexOf(step);
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden>
      {order.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === active ? "w-6 bg-accent" : i < active ? "w-1.5 bg-accent/40" : "w-1.5 bg-line"
          }`}
        />
      ))}
    </div>
  );
}
