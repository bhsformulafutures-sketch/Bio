"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RoomSummaryDTO, SessionDTO } from "@/lib/types";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Avatar, Spinner } from "./ui";
import { toast } from "./Toast";

export function Logo({ className = "text-xl" }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight text-ink ${className}`}>
      The Other <span className="text-accent">Half</span>
    </span>
  );
}

export function Header({ session }: { session: SessionDTO | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/home" aria-label="Home">
          <Logo />
        </Link>
        {session && <RoomSwitcher session={session} />}
      </div>
    </header>
  );
}

/** The header chip: shows the active room, opens the room menu. */
function RoomSwitcher({ session }: { session: SessionDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomSummaryDTO[] | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // action in flight
  const [confirmDelete, setConfirmDelete] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Load the room list lazily, each time the menu opens. */
  useEffect(() => {
    if (!open) return;
    setRooms(null);
    setJoining(false);
    setJoinCode("");
    setConfirmDelete(false);
    api
      .listRooms()
      .then(({ rooms }) => setRooms(rooms))
      .catch(() => setRooms([]));
  }, [open]);

  /* Close on tap/click outside. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const goHome = () => window.location.assign("/home");

  const switchTo = async (room: RoomSummaryDTO) => {
    if (room.active) {
      setOpen(false);
      return;
    }
    setBusy(room.id);
    try {
      await api.switchRoom(room.id);
      goHome();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't switch rooms.", "error");
      setBusy(null);
    }
  };

  const createRoom = async () => {
    setBusy("create");
    try {
      await api.createRoom();
      goHome();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't create a room.", "error");
      setBusy(null);
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      toast("That room code looks too short.", "error");
      return;
    }
    setBusy("join");
    try {
      await api.joinRoom(code);
      goHome();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't join that room.", "error");
      setBusy(null);
    }
  };

  const signOut = async () => {
    setBusy("signout");
    try {
      await api.logout();
    } catch {
      /* sign out locally regardless */
    }
    router.replace("/");
  };

  const deleteActive = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    setBusy("delete");
    try {
      const { hasRooms } = await api.deleteRoom(session.room.id);
      window.location.assign(hasRooms ? "/home" : "/");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't delete the room.", "error");
      setBusy(null);
      setConfirmDelete(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(session.room.code);
      toast("Room code copied");
    } catch {
      toast(`Room code: ${session.room.code}`);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3
          text-xs font-semibold tracking-widest text-soft transition-all hover:border-faint active:scale-95"
        title="Rooms & profile"
      >
        <Avatar avatar={session.user.avatar} name={session.user.name} className="size-6 text-xs" />
        {session.room.code}
        <svg
          viewBox="0 0 24 24"
          className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="animate-pop absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden
            rounded-2xl border border-line bg-surface shadow-lift"
        >
          <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-faint">
            Your rooms
          </p>

          {rooms === null ? (
            <div className="flex justify-center py-4">
              <Spinner className="size-5 text-accent" />
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => switchTo(room)}
                  disabled={busy !== null}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors
                    hover:bg-paper disabled:opacity-60 ${room.active ? "bg-paper/70" : ""}`}
                >
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      room.active ? "bg-accent" : "bg-line"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {room.partnerName
                        ? `You & ${room.partnerName}`
                        : "Waiting for your partner"}
                    </span>
                    <span className="block font-mono text-xs tracking-widest text-faint">
                      {room.code}
                    </span>
                  </span>
                  {busy === room.id && <Spinner className="size-4 text-accent" />}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-line/70 p-2">
            {joining ? (
              <div className="flex items-center gap-2 p-1">
                <input
                  autoFocus
                  value={joinCode}
                  maxLength={8}
                  placeholder="CODE"
                  autoCapitalize="characters"
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3
                    text-center font-mono text-sm uppercase tracking-[0.3em] text-ink
                    placeholder:tracking-normal placeholder:text-faint focus:border-accent focus:outline-none"
                />
                <button
                  onClick={joinRoom}
                  disabled={busy !== null}
                  className="flex h-10 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm
                    font-semibold text-white transition-all hover:bg-accent-deep active:scale-95 disabled:opacity-60"
                >
                  {busy === "join" ? <Spinner className="size-4" /> : "Join"}
                </button>
              </div>
            ) : (
              <>
                <MenuItem onClick={createRoom} busy={busy === "create"} disabled={busy !== null}>
                  ➕ New room
                </MenuItem>
                <MenuItem onClick={() => setJoining(true)} disabled={busy !== null}>
                  🔑 Join with a code
                </MenuItem>
                <MenuItem onClick={copyCode} disabled={busy !== null}>
                  📋 Copy this room&apos;s code
                </MenuItem>
                <MenuItem
                  onClick={deleteActive}
                  busy={busy === "delete"}
                  disabled={busy !== null}
                  danger
                >
                  {confirmDelete
                    ? "Really delete? Every memory goes, for both of you"
                    : "🗑️ Delete this room"}
                </MenuItem>
                <div className="my-1 border-t border-line/70" />
                <MenuItem onClick={signOut} busy={busy === "signout"} disabled={busy !== null}>
                  👋 Sign out
                </MenuItem>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  disabled,
  busy = false,
  danger = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium
        transition-colors disabled:opacity-60 ${
          danger ? "text-red-600 hover:bg-red-50" : "text-ink hover:bg-paper"
        }`}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {busy && <Spinner className="size-4" />}
    </button>
  );
}
