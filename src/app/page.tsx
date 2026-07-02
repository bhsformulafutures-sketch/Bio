"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Avatar, Button, Card, Spinner, TextInput } from "@/components/ui";
import { Logo } from "@/components/Header";
import { toast } from "@/components/Toast";

type Step = "welcome" | "phone" | "code" | "profile" | "room";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [checking, setChecking] = useState(true);

  // Resume wherever this browser left off.
  useEffect(() => {
    api
      .authState()
      .then((state) => {
        if (state.hasRoom) return router.replace("/home");
        if (state.authenticated && state.needsProfile) setStep("profile");
        else if (state.authenticated) setStep("room");
        else setStep("welcome");
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7 text-accent" />
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <Hero />
      {/* key remounts on step change so each panel plays its entrance */}
      <div key={step} className="animate-rise">
        {step === "welcome" && <Welcome onNext={() => setStep("phone")} />}
        {step === "phone" && <PhoneStep onNext={() => setStep("code")} phoneRef={phoneStore} />}
        {step === "code" && (
          <CodeStep
            phoneRef={phoneStore}
            onProfile={() => setStep("profile")}
            onRoom={() => setStep("room")}
            onHome={() => router.replace("/home")}
            onBack={() => setStep("phone")}
          />
        )}
        {step === "profile" && <ProfileStep onNext={() => setStep("room")} />}
        {step === "room" && <RoomStep onHome={() => router.replace("/home")} />}
      </div>

      <Dots step={step} />
    </main>
  );
}

/* A tiny shared holder so the phone survives between the two auth steps
   without threading state through props or re-fetching. */
const phoneStore = { current: "" };

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
        We&apos;ll text you a code — your number is just for notifications.
      </p>
    </div>
  );
}

function PhoneStep({
  onNext,
  phoneRef,
}: {
  onNext: () => void;
  phoneRef: { current: string };
}) {
  const [phone, setPhone] = useState(phoneRef.current);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (phone.replace(/\D/g, "").length < 7) {
      toast("Enter your phone number, including area code.", "error");
      return;
    }
    setBusy(true);
    try {
      const { devCode } = await api.requestCode(phone);
      phoneRef.current = phone;
      if (devCode) toast(`Dev mode — your code is ${devCode}`);
      onNext();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't send a code.", "error");
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-5">
      <p className="text-center font-semibold">What&apos;s your number?</p>
      <TextInput
        type="tel"
        inputMode="tel"
        placeholder="+1 (555) 123-4567"
        value={phone}
        autoFocus
        maxLength={20}
        onChange={(e) => setPhone(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="text-center text-lg tracking-wide"
      />
      <Button size="lg" onClick={submit} loading={busy}>
        Send my code
      </Button>
    </Card>
  );
}

function CodeStep({
  phoneRef,
  onProfile,
  onRoom,
  onHome,
  onBack,
}: {
  phoneRef: { current: string };
  onProfile: () => void;
  onRoom: () => void;
  onHome: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    setBusy(true);
    try {
      const state = await api.verifyCode(phoneRef.current, value);
      if (state.hasRoom) onHome();
      else if (state.needsProfile) onProfile();
      else onRoom();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't verify that code.", "error");
      setCode("");
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      const { devCode } = await api.requestCode(phoneRef.current);
      toast(devCode ? `Dev mode — your code is ${devCode}` : "New code sent.");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't resend.", "error");
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-5">
      <p className="text-center font-semibold">Enter your code</p>
      <p className="-mt-1 text-center text-xs text-faint">
        Sent to {phoneRef.current || "your phone"}
      </p>
      <TextInput
        inputMode="numeric"
        placeholder="••••••"
        value={code}
        autoFocus
        maxLength={6}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, 6);
          setCode(next);
          if (next.length === 6) submit(next);
        }}
        className="text-center font-mono text-2xl tracking-[0.5em]"
      />
      <Button size="lg" onClick={() => submit(code)} loading={busy} disabled={code.length !== 6}>
        Verify
      </Button>
      <div className="flex items-center justify-between px-1 text-sm">
        <button className="font-medium text-faint hover:text-soft" onClick={onBack}>
          ← Change number
        </button>
        <button className="font-medium text-accent hover:text-accent-deep" onClick={resend}>
          Resend
        </button>
      </div>
    </Card>
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
      await api.saveProfile(name.trim(), avatar);
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
  const [mode, setMode] = useState<"menu" | "join">("menu");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  const create = async () => {
    setBusy("create");
    try {
      await api.createRoom();
      onHome();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't create the room.", "error");
      setBusy(null);
    }
  };

  const join = async () => {
    if (code.trim().length < 4) {
      toast("That room code looks too short.", "error");
      return;
    }
    setBusy("join");
    try {
      await api.joinRoom(code.trim());
      onHome();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't join that room.", "error");
      setBusy(null);
    }
  };

  if (mode === "join") {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <p className="text-center font-semibold">Join your other half</p>
        <TextInput
          placeholder="ROOM CODE"
          value={code}
          autoFocus
          maxLength={8}
          autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && join()}
          className="text-center font-mono text-lg uppercase tracking-[0.3em]"
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
      <Button size="lg" onClick={create} loading={busy === "create"}>
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
  const order: Step[] = ["welcome", "phone", "code", "profile", "room"];
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
