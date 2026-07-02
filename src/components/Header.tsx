"use client";

import Link from "next/link";
import type { SessionDTO } from "@/lib/types";
import { toast } from "./Toast";

export function Logo({ className = "text-xl" }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight text-ink ${className}`}>
      other<span className="text-accent">half</span>
    </span>
  );
}

export function Header({ session }: { session: SessionDTO | null }) {
  const copyCode = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.room.code);
      toast("Room code copied");
    } catch {
      toast(`Room code: ${session.room.code}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/home" aria-label="Home">
          <Logo />
        </Link>
        {session && (
          <button
            onClick={copyCode}
            className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5
              text-xs font-semibold tracking-widest text-soft transition-all hover:border-faint active:scale-95"
            title="Copy room code"
          >
            <span className="size-1.5 rounded-full bg-accent" />
            {session.room.code}
          </button>
        )}
      </div>
    </header>
  );
}
