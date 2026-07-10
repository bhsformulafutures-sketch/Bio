"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BoothDTO, SessionDTO } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { captureVideoFrame, compositeBoothStrip } from "@/lib/image-client";
import { Header } from "@/components/Header";
import { Button, Spinner } from "@/components/ui";
import { toast } from "@/components/Toast";
import { CameraIcon } from "@/components/icons";

/* Synchronized timing — both devices count down from booth.startAt. */
const SHOT_WINDOW_MS = 3600; // per shot: 3s countdown + ~0.6s flash/review
const CAPTURE_AT_MS = 3000; // capture at this offset within each window
const POLL_MS = 1500;

type Phase = "camera" | "waiting" | "countdown" | "processing" | "done" | "error";

export default function BoothPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [session, setSession] = useState<SessionDTO | null>(null);
  const [booth, setBooth] = useState<BoothDTO | null>(null);
  const [phase, setPhase] = useState<Phase>("camera");
  const [errorMsg, setErrorMsg] = useState("");

  // Live countdown display.
  const [shotIndex, setShotIndex] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [shotsTaken, setShotsTaken] = useState(0);

  // Server-clock offset (serverNow - Date.now()); both devices align to it.
  const offsetRef = useRef(0);
  const capturedRef = useRef<Set<number>>(new Set());
  const readySentRef = useRef(false);
  const stripSentRef = useRef(false);

  /* ---- camera ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setPhase("waiting");
      } catch {
        setErrorMsg(
          "We need camera access for the photobooth. Enable it and reload."
        );
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /* Tell the server my camera is ready (once). */
  useEffect(() => {
    if (phase !== "waiting" || readySentRef.current) return;
    readySentRef.current = true;
    (async () => {
      try {
        const { booth: b } = await api.readyBooth(id);
        if (b) setBooth(b);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          setErrorMsg("This photobooth has ended.");
          setPhase("error");
        }
      }
    })();
  }, [phase, id]);

  /* ---- poll booth state + sync clock ---- */
  const poll = useCallback(async () => {
    try {
      const [me, res] = await Promise.all([api.me(), api.getBooth(id)]);
      setSession(me);
      if (res.serverNow) offsetRef.current = res.serverNow - Date.now();
      if (res.booth) setBooth(res.booth);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setErrorMsg("This photobooth has ended.");
        setPhase("error");
      }
    }
  }, [id]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  /* React to booth status changes. */
  useEffect(() => {
    if (!booth) return;
    if (booth.status === "cancelled") {
      if (phase !== "error") {
        toast("The photobooth was cancelled.");
        router.replace("/home");
      }
    } else if (booth.status === "completed") {
      setPhase("done");
    } else if (
      booth.status === "live" &&
      booth.startAt !== null &&
      (phase === "waiting" || phase === "camera")
    ) {
      setPhase("countdown");
    }
  }, [booth, phase, router]);

  /* ---- synchronized capture loop ---- */
  const captureShot = useCallback(
    async (idx: number) => {
      if (capturedRef.current.has(idx) || !videoRef.current) return;
      capturedRef.current.add(idx);
      setFlash(true);
      setTimeout(() => setFlash(false), 220);
      setShotsTaken((n) => n + 1);
      try {
        const blob = await captureVideoFrame(videoRef.current);
        await api.uploadBoothFrame(id, idx, blob);
      } catch {
        /* a dropped frame becomes a placeholder cell in the strip */
      }
    },
    [id]
  );

  useEffect(() => {
    if (phase !== "countdown" || !booth || booth.startAt === null) return;
    const startAt = booth.startAt;
    const shots = booth.shots;

    const tick = () => {
      const serverNow = Date.now() + offsetRef.current;
      const elapsed = serverNow - startAt;

      if (elapsed < 0) {
        setShotIndex(0);
        setCount(null);
        return;
      }
      const idx = Math.floor(elapsed / SHOT_WINDOW_MS);
      if (idx >= shots) {
        setCount(null);
        setPhase("processing");
        return;
      }
      setShotIndex(idx);
      const inWindow = elapsed - idx * SHOT_WINDOW_MS;
      if (inWindow < CAPTURE_AT_MS) {
        setCount(Math.max(1, Math.ceil((CAPTURE_AT_MS - inWindow) / 1000)));
      } else {
        setCount(null);
        captureShot(idx);
      }
    };

    const interval = setInterval(tick, 100);
    tick();
    return () => clearInterval(interval);
  }, [phase, booth, captureShot]);

  /* ---- initiator composites the strip once frames land ---- */
  useEffect(() => {
    if (phase !== "processing" || !booth || !booth.mine || stripSentRef.current) {
      return;
    }
    const partnerId = booth.frames
      .map((f) => f.participantId)
      .find((pid) => pid !== booth.initiatorId);

    const tryBuild = async () => {
      if (stripSentRef.current) return;
      const left: (string | undefined)[] = [];
      const right: (string | undefined)[] = [];
      for (let i = 0; i < booth.shots; i++) {
        left[i] = booth.frames.find(
          (f) => f.participantId === booth.initiatorId && f.idx === i
        )?.url;
        right[i] = partnerId
          ? booth.frames.find((f) => f.participantId === partnerId && f.idx === i)?.url
          : undefined;
      }
      const mineComplete = left.every(Boolean);
      const partnerComplete = right.every(Boolean);

      const deadlinePassed =
        booth.startAt !== null &&
        Date.now() + offsetRef.current > booth.startAt + booth.shots * SHOT_WINDOW_MS + 9000;

      if ((mineComplete && partnerComplete) || (mineComplete && deadlinePassed)) {
        stripSentRef.current = true;
        try {
          const caption = new Date().toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          });
          const blob = await compositeBoothStrip(left, right, caption);
          const { booth: done } = await api.uploadBoothStrip(id, blob);
          setBooth(done);
          setPhase("done");
        } catch {
          stripSentRef.current = false; // let a later poll retry
        }
      }
    };

    tryBuild();
    const interval = setInterval(tryBuild, 1200);
    return () => clearInterval(interval);
  }, [phase, booth, id]);

  const leave = async () => {
    try {
      if (booth && booth.status !== "completed") await api.cancelBooth(id);
    } catch {
      /* ignore */
    }
    router.replace("/home");
  };

  /* ---- render ---- */
  const partnerName = session?.partner?.name ?? "your partner";
  const stripUrl = booth?.stripUrl ?? null;

  return (
    <div className="min-h-dvh pb-10">
      <Header session={session} />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Photobooth</h1>
          <button
            onClick={leave}
            className="text-sm font-medium text-faint transition-colors hover:text-soft"
          >
            {phase === "done" ? "Close" : "Leave"}
          </button>
        </div>

        {phase === "error" ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface p-8 text-center">
            <p className="text-soft">{errorMsg}</p>
            <Link href="/home">
              <Button variant="soft">Back home</Button>
            </Link>
          </div>
        ) : phase === "done" && stripUrl ? (
          <div className="animate-fade-up flex flex-col items-center gap-4">
            <p className="text-sm text-soft">Here&apos;s your strip.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stripUrl}
              alt="Your photobooth strip"
              className="w-full max-w-xs rounded-2xl shadow-lift"
            />
            <div className="flex w-full max-w-xs flex-col gap-2">
              <a href={stripUrl} download="otherhalf-booth.jpg">
                <Button className="w-full">Save the strip</Button>
              </a>
              <Link href="/home">
                <Button variant="soft" className="w-full">
                  Back home
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* live camera */}
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-ink shadow-card">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full -scale-x-100 object-cover"
              />
              {flash && <div className="absolute inset-0 bg-white/85" />}

              {/* status / countdown overlay */}
              {phase === "camera" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/50 text-white">
                  <Spinner className="size-7" />
                  <p className="text-sm">Starting the camera…</p>
                </div>
              )}
              {phase === "waiting" && (
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-gradient-to-t from-ink/80 to-transparent px-4 pb-5 pt-10 text-white">
                  <Spinner className="size-5" />
                  <p className="text-sm font-medium">
                    Waiting for {partnerName} to join…
                  </p>
                </div>
              )}
              {phase === "countdown" && count !== null && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    key={`${shotIndex}-${count}`}
                    className="animate-count font-display text-8xl font-bold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
                  >
                    {count}
                  </span>
                </div>
              )}
              {(phase === "countdown" || phase === "processing") && booth && (
                <div className="absolute right-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  {Math.min(shotsTaken, booth.shots)} / {booth.shots}
                </div>
              )}
            </div>

            {phase === "processing" && (
              <div className="flex items-center justify-center gap-2 text-sm text-soft">
                <Spinner className="size-4 text-accent" />
                {booth?.mine
                  ? "Merging your strip…"
                  : `Waiting for ${partnerName}'s shots…`}
              </div>
            )}
            {phase === "waiting" && (
              <p className="flex items-center justify-center gap-1.5 text-center text-sm text-soft">
                <CameraIcon className="size-4" />
                Both cameras on, then it counts you both in together.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
