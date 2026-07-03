"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "soft" | "ghost" | "outline";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-card hover:bg-accent-deep disabled:hover:bg-accent",
  soft: "bg-accent-soft text-accent-deep hover:bg-[#f6e0d5]",
  ghost: "text-soft hover:bg-line/60 hover:text-ink",
  outline: "border border-line bg-surface text-ink hover:border-faint",
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
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-semibold
        transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        hover:-translate-y-px active:translate-y-0 active:scale-[0.97]
        disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100
        ${VARIANTS[variant]} ${sizes[size]} ${className}`}
    >
      {/* subtle sheen that sweeps on hover for the filled variant */}
      {variant === "primary" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r
            from-transparent via-white/25 to-transparent transition-transform duration-700
            group-hover:translate-x-full"
        />
      )}
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {loading && <Spinner className="size-4" />}
        {children}
      </span>
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
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl bg-surface shadow-card ${className}`}>
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
