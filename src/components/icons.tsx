import type { HiddenSide } from "@/lib/types";

/**
 * Quiet line icons — one consistent stroke style (24×24, no fill) shared
 * across the app so the UI reads as hand-made rather than emoji-decorated.
 */

type IconProps = { className?: string };

function Svg({
  className = "size-5",
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function CameraIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.7l1-1.6a1 1 0 0 1 .85-.47h3.9a1 1 0 0 1 .85.47l1 1.6h1.7A1.5 1.5 0 0 1 19.5 8.5v8A1.5 1.5 0 0 1 18 18H6a1.5 1.5 0 0 1-1.5-1.5v-8Z" />
      <circle cx="11.75" cy="12" r="3" />
    </Svg>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14.5 5.5l4 4M4 20l1-4L16 5a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L8 19l-4 1Z" />
    </Svg>
  );
}

export function HeartIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.65 12 20 12 20Z" />
    </Svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function KeyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="8" cy="8" r="3.5" />
      <path d="M10.5 10.5 20 20M17 17l2-2M14 14l2-2" />
    </Svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a1 1 0 0 1 1-1h9" />
    </Svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
    </Svg>
  );
}

export function MusicIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </Svg>
  );
}

export function BoothIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9h16M4 14h16M9 4v16" />
    </Svg>
  );
}

export function NoteIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 5.5C7 4 9 6 11 5s3-2 5-1v11c-2-1-3 0-5 1s-4-1-6 .5V5.5Z" />
      <path d="M5 16.5V21" />
    </Svg>
  );
}

/** A rectangle with the hidden side shaded — the region picker cue. */
export function SideIcon({
  side,
  className = "size-5",
}: {
  side: HiddenSide;
  className?: string;
}) {
  const shade: Record<HiddenSide, { x: number; y: number; w: number; h: number }> = {
    left: { x: 3, y: 4, w: 8.5, h: 16 },
    right: { x: 12.5, y: 4, w: 8.5, h: 16 },
    top: { x: 3, y: 4, w: 18, h: 8.5 },
    bottom: { x: 3, y: 12, w: 18, h: 8.5 },
  };
  const s = shade[side];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
      />
      <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="1.5" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function PaletteIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.5c-4.7 0-8.5 3.6-8.5 8 0 3 2.3 4.6 4.6 4.6 1.4 0 2.1.9 2.1 1.9 0 .9.7 2 1.8 2 4.7 0 8.5-3.8 8.5-8.5S16.7 3.5 12 3.5Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10.5" cy="7.5" r="1" />
      <circle cx="15" cy="7.5" r="1" />
      <circle cx="17" cy="11.5" r="1" />
    </Svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12.5l4 4 10-10" />
    </Svg>
  );
}

