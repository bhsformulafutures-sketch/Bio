"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Soft, blurred colour washes that drift slowly behind the page.
 * Purely decorative and pointer-transparent — sets a warm, alive mood
 * without competing with content or costing much to paint.
 */
export function FloatingAccents() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="animate-drift absolute -left-16 top-24 size-64 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(217,111,78,0.18), transparent 70%)" }}
      />
      <div
        className="animate-drift absolute -right-20 top-1/3 size-72 rounded-full opacity-50 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(234,242,234,0.9), transparent 70%)",
          animationDelay: "-6s",
        }}
      />
      <div
        className="animate-drift absolute bottom-10 left-1/4 size-56 rounded-full opacity-50 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(251,237,230,0.9), transparent 70%)",
          animationDelay: "-11s",
        }}
      />
    </div>
  );
}

/**
 * Fades and lifts its children in on mount — a gentle page transition
 * that makes every route feel like it settles into place.
 */
export function PageTransition({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`animate-fade-up ${className}`}>{children}</div>;
}

/**
 * A centered modal sheet with a soft backdrop. Closes on backdrop tap or
 * Escape. Content springs in; the whole thing is rendered in a portal so
 * it floats above sticky headers and bottom bars.
 */
export function Modal({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center"
      style={{ background: "rgb(34 28 21 / 0.42)", backdropFilter: "blur(3px)" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="animate-pop w-full max-w-sm rounded-3xl bg-surface p-5 shadow-lift"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/** A warm shimmer placeholder block — our stand-in for spinners. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-2xl ${className}`} />;
}

/**
 * Reveals its children with a fade-up the first time they scroll into
 * view, so galleries assemble themselves as you move down the page.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(16px)",
        transition: `opacity 0.55s var(--ease-soft) ${delay}ms, transform 0.55s var(--ease-soft) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
