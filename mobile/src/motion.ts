// Shared motion presets: quick, gentle fades with no springs or overshoot.
// Only opacity and transform are animated, and the system reduced-motion setting is honoured.
import { useEffect } from "react";
import { Easing, FadeIn, Keyframe, ReduceMotion, useSharedValue, withTiming, type WithTimingConfig } from "react-native-reanimated";

export const DURATION = { press: 100, fast: 150, base: 200, slow: 250 };

/** How far content travels as it fades in, in px. */
export const RISE = 6;

export const easeOut = Easing.out(Easing.cubic);

export function timing(duration = DURATION.base): WithTimingConfig {
  return { duration, easing: easeOut, reduceMotion: ReduceMotion.System };
}

/** About 30 ms per item, capped so only the first few items are staggered. */
export function stagger(index: number): number {
  return Math.min(index, 3) * 30;
}

type Rise = InstanceType<typeof Keyframe>;
const rises = new Map<number, Rise>();

/** Entering animation for content blocks: fade in while rising a few px. */
export function rise(delay = 0): Rise {
  let k = rises.get(delay);
  if (!k) {
    // Keyframe consumes its definitions when built, so each delay gets its own object.
    k = new Keyframe({
      0: { opacity: 0, transform: [{ translateY: RISE }] },
      100: { opacity: 1, transform: [{ translateY: 0 }], easing: easeOut },
    })
      .duration(DURATION.base)
      .delay(delay)
      .reduceMotion(ReduceMotion.System);
    rises.set(delay, k);
  }
  return k;
}

/** Entering animation for things that swap in place, like a status replacing a button. */
export function fade() {
  return FadeIn.duration(DURATION.base).easing(easeOut).reduceMotion(ReduceMotion.System);
}

/**
 * A shared value that goes 0 → 1 while `active`, holds for `holdMs`, then returns to 0.
 * The hold is a JS timer because Reanimated skips withDelay when reduced motion is on.
 */
export function useShowFor(active: boolean, holdMs: number) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    v.value = withTiming(1, timing());
    const hide = setTimeout(() => (v.value = withTiming(0, timing())), DURATION.base + holdMs);
    return () => {
      clearTimeout(hide);
      v.value = withTiming(0, timing());
    };
  }, [active, holdMs, v]);
  return v;
}
