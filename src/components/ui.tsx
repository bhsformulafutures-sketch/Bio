"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "soft" | "ghost" | "outline" | "dusk";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-card hover:bg-accent-deep hover:-translate-y-0.5 hover:shadow-lift disabled:hover:translate-y-0 disabled:hover:bg-accent",
  soft: "bg-accent-soft text-accent-deep hover:bg-[#fbe1e7]",
  dusk: "bg-dusk-soft text-dusk hover:bg-[#e5e2f7]",
  ghost: "text-soft hover:bg-line/60 hover:text-ink",
  outline: "border border-line bg-surface text-ink hover:border-faint hover:-translate-y-0.5",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "lg" | "sm";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const sizes = {
    sm: "h-9 px-3.5 text-sm",
    md: "h-11 px-5 text-[15px]",
    lg: "h-13 px-7 text-base",
  };
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center gap-2 rounded-full font-semibold
        transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100
        ${VARIANTS[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`rounded-3xl bg-surface shadow-card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[16px] text-ink
        placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20
        transition-colors ${className}`}
    />
  );
}

/** A person's emoji avatar in a soft ring. Falls back to their initial. */
export function Avatar({
  avatar,
  name,
  className = "size-10 text-lg",
}: {
  avatar?: string | null;
  name?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full
        bg-gradient-to-br from-accent-soft to-dusk-soft font-semibold text-ink ${className}`}
      aria-hidden
    >
      {avatar || (name ? name.charAt(0).toUpperCase() : "·")}
    </span>
  );
}

/** A shimmering placeholder block used while content loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-2xl ${className}`} />;
}

/** A small rounded label. */
export function Badge({
  children,
  tone = "soft",
  className = "",
}: {
  children: ReactNode;
  tone?: "soft" | "dusk" | "gold" | "line";
  className?: string;
}) {
  const tones = {
    soft: "bg-accent-soft text-accent-deep",
    dusk: "bg-dusk-soft text-dusk",
    gold: "bg-[#fdf1dc] text-[#a9781f]",
    line: "bg-line text-soft",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
