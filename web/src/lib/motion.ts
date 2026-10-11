import type { Transition } from "motion/react";

// Shared motion presets for the console, matching the GP app: quick, gentle fades with no springs or overshoot.
// MotionConfig reducedMotion="user" (in providers) turns off the transform part when the OS asks for reduced motion.

/** easeOutCubic */
export const EASE_OUT = [0.33, 1, 0.68, 1] as const;

export function fade(delay = 0, duration = 0.2): Transition {
  return { duration, ease: EASE_OUT, delay };
}

/** About 30 ms per item, capped so only the first few items are staggered. In seconds. */
export function stagger(index: number): number {
  return Math.min(index, 3) * 0.03;
}

/** Spread onto a motion element: fade in while rising a few px. */
export function rise(delay = 0) {
  return { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: fade(delay) };
}
