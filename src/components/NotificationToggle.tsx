"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  disablePush,
  enablePush,
  getPushInfo,
  isPushEnabled,
  pushSupported,
} from "@/lib/push-client";
import { toast } from "@/components/Toast";
import { Spinner } from "@/components/ui";
import { tween } from "@/lib/motion";

type State = "loading" | "unsupported" | "pending" | "off" | "on";

/**
 * A quiet home-screen affordance to turn browser notifications on/off. It only
 * appears where it can do something: hidden on unsupported browsers, shown in a
 * muted "almost ready" state until VAPID keys are configured server-side, and
 * fully interactive once they are.
 */
export function NotificationToggle() {
  const [state, setState] = useState<State>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) {
      setState("unsupported");
      return;
    }
    (async () => {
      const info = await getPushInfo();
      if (!info.configured || !info.publicKey) {
        setState("pending");
        return;
      }
      setPublicKey(info.publicKey);
      setState((await isPushEnabled()) ? "on" : "off");
    })();
  }, []);

  const turnOn = async () => {
    if (!publicKey) return;
    setBusy(true);
    const result = await enablePush(publicKey);
    setBusy(false);
    if (result === "enabled") {
      setState("on");
      toast("Notifications on 🔔");
    } else if (result === "denied") {
      toast("Notifications are blocked in your browser settings.", "error");
    } else {
      toast("Couldn't turn on notifications.", "error");
    }
  };

  const turnOff = async () => {
    setBusy(true);
    await disablePush();
    setBusy(false);
    setState("off");
    toast("Notifications off");
  };

  if (state === "loading" || state === "unsupported") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tween.base}
        className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 px-4 py-3"
      >
        <span className="text-xl" aria-hidden>
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Notifications</p>
          <p className="text-xs text-soft">
            {state === "pending"
              ? "Almost ready — we'll ping you about new challenges soon."
              : state === "on"
                ? "You'll hear about new challenges and reveals."
                : "Get a nudge when it's your turn."}
          </p>
        </div>
        {state === "pending" ? (
          <span className="shrink-0 rounded-full bg-line px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-soft">
            Soon
          </span>
        ) : (
          <button
            onClick={state === "on" ? turnOff : turnOn}
            disabled={busy}
            className={`flex h-8 w-14 shrink-0 items-center rounded-full px-1 transition-colors disabled:opacity-60 ${
              state === "on" ? "justify-end bg-accent" : "justify-start bg-line"
            }`}
            aria-pressed={state === "on"}
            aria-label={state === "on" ? "Turn notifications off" : "Turn notifications on"}
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
              className="flex size-6 items-center justify-center rounded-full bg-white shadow-sm"
            >
              {busy && <Spinner className="size-3 text-soft" />}
            </motion.span>
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
