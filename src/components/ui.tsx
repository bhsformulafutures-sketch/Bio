"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { spring } from "@/lib/motion";

type ButtonVariant = "primary" | "soft" | "ghost" | "outline" | "dusk";

/* Colour/shadow only — the lift + press are driven by Framer Motion below so
   the whole app shares one spring feel. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-card hover:bg-accent-deep hover:shadow-lift disabled:hover:bg-accent",
  soft: "bg-accent-soft text-accent-deep hover:bg-[#fbe1e7]",
  dusk: "bg-dusk-soft text-dusk hover:bg-[#e5e2f7]",
  ghost: "text-soft hover:bg-line/60 hover:text-ink",
  outline: "border border-line bg-surface text-ink hover:border-faint",
};

/* Motion's own drag/animation handlers collide with the DOM ones, so drop them. */
type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | "onAnimationStart"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragLeave"
  | "onDragOver"
  | "onDrop"
> & {
  variant?: ButtonVariant;
  size?: "md" | "lg" | "sm";
  loading?: boolean;
};

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
  const isDisabled = disabled || loading;
  return (
    <motion.button
      {...(props as HTMLMotionProps<"button">)}
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { scale: 1.025, y: -1.5 }}
      whileTap={isDisabled ? undefined : { scale: 0.96, y: 0 }}
      transition={spring.snappy}
      className={`relative inline-flex items-center justify-center gap-2 rounded-full font-semibold
        transition-colors duration-200 disabled:opacity-50
        ${VARIANTS[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </motion.button>
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

type CardProps = HTMLMotionProps<"div"> & {
  /** Hover lift + shadow, for cards that act like buttons/links. */
  interactive?: boolean;
  /** Slow "breathing" loop for hero containers. */
  breathe?: boolean;
  children?: ReactNode;
};

export function Card({
  children,
  className = "",
  interactive = false,
  breathe = false,
  ...rest
}: CardProps) {
  return (
    <motion.div
      {...rest}
      whileHover={interactive ? { y: -4, scale: 1.006 } : undefined}
      transition={spring.gentle}
      className={`rounded-3xl bg-surface shadow-card ${
        interactive ? "cursor-pointer hover:shadow-lift" : ""
      } ${breathe ? "animate-breathe" : ""} ${className}`}
    >
      {children}
    </motion.div>
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
