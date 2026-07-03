"use client";

import { useEffect, useState } from "react";
import { formatTimeLeft, msUntil } from "@/lib/games/random/time";

/** A live "time left" readout that ticks down every second. */
export function Countdown({
  expiresAt,
  className = "",
  onExpire,
}: {
  expiresAt: string;
  className?: string;
  onExpire?: () => void;
}) {
  const [label, setLabel] = useState(() => formatTimeLeft(expiresAt));

  useEffect(() => {
    const tick = () => {
      setLabel(formatTimeLeft(expiresAt));
      if (msUntil(expiresAt) === 0) onExpire?.();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const urgent = msUntil(expiresAt) < 60 * 60 * 1000;

  return (
    <span className={`tabular-nums ${urgent ? "animate-breathe text-accent" : ""} ${className}`}>
      {label}
    </span>
  );
}
