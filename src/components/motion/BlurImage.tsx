"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { motion } from "motion/react";
import { tween } from "@/lib/motion";

type BlurImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  | "onLoad"
  | "src"
  | "onAnimationStart"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
> & {
  src: string;
  /** Extra classes for the wrapping frame (aspect ratio, rounding, etc). */
  wrapperClassName?: string;
};

/**
 * Blur-to-sharp image. Starts slightly scaled + blurred and softly resolves
 * once decoded — no abrupt pop-in. Falls back gracefully for cached images
 * (they simply fade in near-instantly).
 */
export function BlurImage({
  src,
  className = "",
  wrapperClassName = "",
  alt = "",
  ...rest
}: BlurImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <span
      className={`relative block overflow-hidden bg-line ${wrapperClassName}`}
    >
      {/* Shimmer placeholder while the pixels arrive */}
      {!loaded && (
        <span
          className="animate-shimmer absolute inset-0 block"
          style={{
            backgroundImage:
              "linear-gradient(100deg, transparent 20%, rgb(255 255 255 / 0.45) 50%, transparent 80%)",
            backgroundSize: "200% 100%",
          }}
        />
      )}
      <motion.img
        {...rest}
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        initial={false}
        animate={
          loaded
            ? { opacity: 1, scale: 1, filter: "blur(0px)" }
            : { opacity: 0, scale: 1.04, filter: "blur(12px)" }
        }
        transition={tween.slow}
        className={className}
        draggable={false}
      />
    </span>
  );
}
