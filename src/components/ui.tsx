"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { spring } from "@/lib/motion";

type ButtonVariant = "primary" | "soft" | "ghost" | "outline" | "dusk";

/* Colour/shadow only — the lift + press are driven by Framer Motion below so
   the whole app shares one spring feel. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-[#fff8f0] border border-accent-deep/50 shadow-card hover:bg-accent-deep disabled:hover:bg-accent",
  soft: "bg-accent-soft text-accent-deep border border-accent/15 hover:bg-[#f0d5c9]",
  dusk: "bg-dusk-soft text-dusk border border-dusk/20 hover:bg-[#d7dae8]",
  ghost: "text-soft hover:bg-line/50 hover:text-ink",
  outline: "border border-line bg-surface text-ink shadow-card hover:border-faint",
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
      className={`relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold
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

/** A sheet of paper on the desk: hairline border, hard offset shadow. */
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
      whileHover={interactive ? { y: -3, scale: 1.004 } : undefined}
      transition={spring.gentle}
      className={`rounded-lg border border-line bg-surface shadow-card ${
        interactive ? "cursor-pointer hover:shadow-lift" : ""
      } ${breathe ? "animate-breathe" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}

type PanelProps = CardProps & {
  /** Sawtooth torn-paper top edge — use at most once per viewport. */
  torn?: boolean;
};

/** The default scrapbook container. `Card` with an optional torn top edge. */
export function Panel({ torn = false, className = "", ...rest }: PanelProps) {
  return (
    <Card
      {...rest}
      className={`${torn ? "torn-top rounded-t-none border-t-0 pt-3" : ""} ${className}`}
    />
  );
}

/** A punched admission ticket — the game-entry surface. */
export function Ticket({
  children,
  className = "",
  tilt = 0,
  ...rest
}: CardProps & { tilt?: number }) {
  return (
    <motion.div
      {...rest}
      whileHover={{ y: -3, rotate: 0, scale: 1.01 }}
      transition={spring.gentle}
      style={{ rotate: tilt, ...(rest.style as CSSProperties) }}
      className={`relative cursor-pointer rounded-lg border border-line bg-surface shadow-card
        hover:shadow-lift ${className}`}
    >
      {/* punched notches */}
      <span
        aria-hidden
        className="absolute -left-[7px] top-1/2 size-3.5 -translate-y-1/2 rounded-full border-r border-line bg-paper"
      />
      <span
        aria-hidden
        className="absolute -right-[7px] top-1/2 size-3.5 -translate-y-1/2 rounded-full border-l border-line bg-paper"
      />
      {children}
    </motion.div>
  );
}

const TAPE_COLORS = {
  pink: "var(--color-tape-pink)",
  blue: "var(--color-tape-blue)",
  mint: "var(--color-tape-mint)",
  gold: "var(--color-tape-gold)",
} as const;

/**
 * A translucent washi-tape strip, for "taping" photos and notes to the page.
 * Decorative only — absolutely position it over the corner/top of its parent.
 */
export function TapeStrip({
  color = "pink",
  className = "",
  angle = -4,
}: {
  color?: keyof typeof TAPE_COLORS;
  className?: string;
  angle?: number;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-10 block h-6 w-16 opacity-60 ${className}`}
      style={{
        transform: `rotate(${angle}deg)`,
        background: `linear-gradient(100deg, transparent 0.5%, ${TAPE_COLORS[color]} 1.5%, ${TAPE_COLORS[color]} 98.5%, transparent 99.5%)`,
        clipPath:
          "polygon(0 12%, 4% 0, 100% 4%, 96% 46%, 100% 88%, 3% 100%, 6% 55%)",
        boxShadow: "0 1px 2px rgb(59 47 39 / 0.10)",
      }}
    />
  );
}

/** A white-framed instant photo with a handwritten caption strip. */
export function Polaroid({
  children,
  caption,
  tilt = 0,
  className = "",
  ...rest
}: CardProps & { caption?: ReactNode; tilt?: number }) {
  return (
    <motion.div
      {...rest}
      initial={false}
      whileHover={{ rotate: 0, y: -5, scale: 1.02, zIndex: 5 }}
      transition={spring.gentle}
      style={{ rotate: tilt, ...(rest.style as CSSProperties) }}
      className={`border border-line/70 bg-[#fffef9] p-1.5 pb-1 shadow-card
        transition-shadow duration-200 hover:shadow-lift ${className}`}
    >
      {children}
      {caption !== undefined && (
        <div className="flex min-h-7 items-center px-1 py-0.5 font-hand text-[15px] leading-tight text-soft">
          {caption}
        </div>
      )}
    </motion.div>
  );
}

/** A small tilted paper label — the scrapbook Badge. */
export function Sticker({
  children,
  tone = "soft",
  tilt = 0,
  className = "",
}: {
  children: ReactNode;
  tone?: "soft" | "dusk" | "gold" | "line";
  tilt?: number;
  className?: string;
}) {
  const tones = {
    soft: "bg-accent-soft text-accent-deep border-accent/20",
    dusk: "bg-dusk-soft text-dusk border-dusk/20",
    gold: "bg-[#f4e5c6] text-[#8c6516] border-gold/40",
    line: "bg-paper text-soft border-line",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-hand text-sm ${tones[tone]} ${className}`}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      {children}
    </span>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`h-12 w-full rounded-md border border-line bg-surface px-4 text-[16px] text-ink
        placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15
        transition-colors ${className}`}
    />
  );
}

/** A person's emoji avatar on a paper disc. Falls back to their initial. */
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full border
        border-line bg-kraft/60 font-semibold text-ink ${className}`}
      aria-hidden
    >
      {avatar || (name ? name.charAt(0).toUpperCase() : "·")}
    </span>
  );
}

/** A shimmering placeholder block used while content loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

/** A small squared label. */
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
    soft: "bg-accent-soft text-accent-deep border-accent/15",
    dusk: "bg-dusk-soft text-dusk border-dusk/15",
    gold: "bg-[#f4e5c6] text-[#8c6516] border-gold/30",
    line: "bg-paper text-soft border-line",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
