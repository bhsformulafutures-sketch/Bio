"use client";

import { useEffect, useState } from "react";

interface ToastItem {
  id: number;
  message: string;
  kind: "info" | "error";
  leaving: boolean;
}

const EVENT = "oh:toast";
let nextId = 1;

/** Fire a toast from anywhere — no context plumbing needed. */
export function toast(message: string, kind: "info" | "error" = "info"): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind } }));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const { message, kind } = (event as CustomEvent).detail;
      const id = nextId++;
      setItems((current) => [...current, { id, message, kind, leaving: false }]);
      setTimeout(() => {
        setItems((current) => current.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
        setTimeout(() => {
          setItems((current) => current.filter((t) => t.id !== id));
        }, 250);
      }, 2950);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {items.map((item) => (
        <div
          key={item.id}
          className={`${item.leaving ? "animate-pop-out" : "animate-pop"} rounded-md px-4 py-2.5 text-sm font-medium shadow-lift ${
            item.kind === "error"
              ? "bg-ink text-red-200"
              : "bg-ink text-paper"
          }`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
