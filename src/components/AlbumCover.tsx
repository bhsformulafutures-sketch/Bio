"use client";

import Link from "next/link";
import type { AlbumDTO } from "@/lib/types";

/** A stable-per-album pseudo-random tilt so covers feel hand-placed. */
export function albumTilt(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const tilts = [-2.5, -1.5, -1, 1, 1.5, 2.5];
  return tilts[Math.abs(hash) % tilts.length];
}

/**
 * A scrapbook album cover: a taped-down card with a few printed memories
 * peeking out from inside. Tapping opens the album.
 */
export function AlbumCover({
  album,
  thumbs,
  className = "",
  style,
}: {
  album: AlbumDTO;
  /** preview image urls for the first few memories */
  thumbs: string[];
  className?: string;
  style?: React.CSSProperties;
}) {
  const tilt = albumTilt(album.id);
  const peek = thumbs.slice(0, 3);

  return (
    <Link
      href={`/album/${album.id}`}
      className={`group block ${className}`}
      style={style}
      aria-label={`Open album ${album.name}`}
    >
      <div
        className="relative rounded-[14px] border border-line bg-surface p-3 shadow-polaroid
          transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.5,1)]
          group-hover:-translate-y-1.5 group-hover:rotate-0 group-active:scale-[0.97]"
        style={{ transform: `rotate(${tilt}deg)`, ["--tilt" as string]: `${tilt}deg` }}
      >
        {/* tape strip */}
        <span className="tape absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 -rotate-1 rounded-[3px]" />

        {/* the memories peeking out of the cover */}
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-paper">
          {peek.length === 0 ? (
            <div className="dotted flex h-full w-full flex-col items-center justify-center gap-1 text-faint">
              <span className="text-2xl transition-transform duration-300 group-hover:scale-110">🖼️</span>
              <span className="text-[11px] font-medium">Empty album</span>
            </div>
          ) : (
            peek.map((src, i) => {
              const spread = [-9, 0, 9][i] ?? 0;
              const lift = i === 1 ? -4 : 0;
              return (
                <div
                  key={i}
                  className="absolute h-[74%] w-[58%] overflow-hidden rounded-md border-2 border-white bg-line shadow-card
                    transition-all duration-300 ease-[cubic-bezier(0.34,1.4,0.5,1)]"
                  style={{
                    transform: `translate(${spread}%, ${lift}px) rotate(${spread * 0.5}deg)`,
                    zIndex: i === 1 ? 3 : 2 - Math.abs(i - 1),
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                </div>
              );
            })
          )}
        </div>

        <div className="mt-2.5 px-0.5">
          <p className="truncate font-display text-[15px] font-bold leading-tight text-ink">
            {album.name}
          </p>
          <p className="mt-0.5 text-[12px] text-soft">
            {album.count} {album.count === 1 ? "memory" : "memories"}
          </p>
        </div>
      </div>
    </Link>
  );
}
