"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "motion/react";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";

/**
 * Reveal-on-scroll wrapper. Children fade + rise into place the first time
 * they enter the viewport, then stay put. Cheap to sprinkle anywhere.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  once = true,
  variants = fadeUp,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
  variants?: Variants;
  as?: keyof typeof motion;
}) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "0px 0px -12% 0px" }}
      transition={{ delay }}
    >
      {children}
    </Comp>
  );
}

/**
 * Staggered group: reveals its direct children one by one as the group scrolls
 * into view. Wrap each child in <RevealItem>.
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.06,
  delay = 0,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer(stagger, delay)}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "0px 0px -10% 0px" }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}
