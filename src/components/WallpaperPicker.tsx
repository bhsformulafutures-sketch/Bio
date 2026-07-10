"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, PaletteIcon } from "./icons";

const STORAGE_KEY = "oh-wallpaper";

type Wallpaper = { id: string; label: string; swatch: string };

/** Keep in sync with the body[data-wallpaper] rules in globals.css. */
const WALLPAPERS: Wallpaper[] = [
  { id: "paper", label: "Paper", swatch: "#faf6f0" },
  {
    id: "linen",
    label: "Linen",
    swatch: "radial-gradient(#ece3d6 1.5px, #faf6f0 1.5px) 0 0 / 8px 8px",
  },
  { id: "blush", label: "Blush", swatch: "linear-gradient(150deg,#fdeadf,#f7efe6)" },
  { id: "sky", label: "Sky", swatch: "linear-gradient(150deg,#e8f1fb,#faf6f0)" },
  { id: "sage", label: "Sage", swatch: "linear-gradient(150deg,#e7f1e6,#faf6f0)" },
  { id: "lavender", label: "Lavender", swatch: "linear-gradient(150deg,#efe9fb,#faf6f0)" },
  { id: "dawn", label: "Dawn", swatch: "linear-gradient(150deg,#fbe9ec,#eef3fb)" },
];

/** Apply a wallpaper to <body> (paper is the bare default, no attribute). */
function apply(id: string) {
  if (id === "paper") delete document.body.dataset.wallpaper;
  else document.body.dataset.wallpaper = id;
}

export function WallpaperPicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("paper");
  const panelRef = useRef<HTMLDivElement>(null);

  /* Reflect whatever the no-flash script already applied on load. */
  useEffect(() => {
    setCurrent(document.body.dataset.wallpaper || "paper");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const choose = (id: string) => {
    setCurrent(id);
    apply(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* private mode — the choice just won't persist */
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change wallpaper"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-full border border-line bg-surface
          text-soft transition-all hover:border-faint hover:text-ink active:scale-95"
        title="Wallpaper"
      >
        <PaletteIcon className="size-4.5" />
      </button>

      {open && (
        <div className="animate-pop absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-3 shadow-lift">
          <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-faint">
            Wallpaper
          </p>
          <div className="grid grid-cols-4 gap-2">
            {WALLPAPERS.map((w) => (
              <button
                key={w.id}
                onClick={() => choose(w.id)}
                aria-label={w.label}
                title={w.label}
                className={`relative flex aspect-square items-center justify-center rounded-xl border transition-all active:scale-95 ${
                  current === w.id
                    ? "border-ink ring-2 ring-ink/15"
                    : "border-line hover:border-faint"
                }`}
                style={{ background: w.swatch }}
              >
                {current === w.id && (
                  <span className="rounded-full bg-white/85 p-0.5 text-ink shadow-card">
                    <CheckIcon className="size-4" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
