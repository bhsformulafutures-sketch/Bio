"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, PaletteIcon } from "./icons";

const STORAGE_KEY = "oh-wallpaper";

type Wallpaper = { id: string; label: string; swatch: string };

/** Paper stocks. Keep in sync with the body[data-wallpaper] rules in globals.css. */
const WALLPAPERS: Wallpaper[] = [
  { id: "paper", label: "Paper", swatch: "#f6f0e4" },
  {
    id: "grid",
    label: "Graph paper",
    swatch:
      "linear-gradient(rgb(59 47 39 / 0.10) 1px, transparent 1px) 0 0 / 8px 8px, linear-gradient(90deg, rgb(59 47 39 / 0.10) 1px, transparent 1px) 0 0 / 8px 8px, #f6f0e4",
  },
  {
    id: "ruled",
    label: "Ruled",
    swatch: "linear-gradient(rgb(85 103 159 / 0.25) 1px, #f8f2e7 1px) 0 0 / 100% 7px",
  },
  {
    id: "kraft",
    label: "Kraft",
    swatch: "radial-gradient(rgb(59 47 39 / 0.10) 1px, #eadfc9 1px) 0 0 / 6px 6px",
  },
  {
    id: "cork",
    label: "Corkboard",
    swatch: "radial-gradient(rgb(140 108 74 / 0.35) 1.5px, #e6d3b4 1.5px) 0 0 / 7px 7px",
  },
  {
    id: "blueprint",
    label: "Blueprint",
    swatch:
      "linear-gradient(rgb(85 103 159 / 0.3) 1px, transparent 1px) 0 0 / 8px 8px, linear-gradient(90deg, rgb(85 103 159 / 0.3) 1px, transparent 1px) 0 0 / 8px 8px, #e0e5f0",
  },
  {
    id: "blush",
    label: "Blush",
    swatch: "radial-gradient(rgb(201 79 79 / 0.15) 1px, #f6e4dc 1px) 0 0 / 6px 6px",
  },
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

  /* Reflect whatever the no-flash script already applied on load. Stored ids
     from the old pastel set (linen/sky/…) fall back to plain paper. */
  useEffect(() => {
    const applied = document.body.dataset.wallpaper || "paper";
    if (WALLPAPERS.some((w) => w.id === applied)) {
      setCurrent(applied);
    } else {
      delete document.body.dataset.wallpaper;
      try {
        localStorage.setItem(STORAGE_KEY, "paper");
      } catch {
        /* fine */
      }
    }
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
        <div className="animate-pop absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-line bg-surface p-3 shadow-lift">
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
                className={`relative flex aspect-square items-center justify-center rounded-md border transition-all active:scale-95 ${
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
