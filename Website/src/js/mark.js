// Motion for the BloodLine mark: nine bars that open out of a flat line, beat like
// a heart (the green bar hardest), and ripple like a level meter on hover.
import { gsap } from "./gsap.js";

// User-space points inside the mark's viewBox (0 4 35 34.5).
const LINE = "17.5 16"; // the flat line the bars grow out of
const CORE = "17.5 22"; // centre of the heart, for the beat

const barsOf = (svg) => svg.querySelectorAll(".mark__bar");
const accentOf = (svg) => svg.querySelector(".mark__bar--accent");

/** Bars open out of a flat line, left to right, like a pulse passing through. */
export function assemble(svg, { duration = 1.2, stagger = 0.075 } = {}) {
  const bars = barsOf(svg);
  return gsap
    .timeline()
    .fromTo(
      bars,
      { scaleY: 0.04, opacity: 0, svgOrigin: LINE },
      { scaleY: 1, opacity: 1, svgOrigin: LINE, duration, stagger, ease: "expo.out" },
    );
}

/** One "lub-dub". */
export function beat(svg) {
  const bars = barsOf(svg);
  const accent = accentOf(svg);
  const others = [...bars].filter((bar) => bar !== accent);
  return gsap
    .timeline()
    .to(others, { scaleY: 1.06, svgOrigin: CORE, duration: 0.14, stagger: { each: 0.012, from: "center" }, ease: "power2.out" }, 0)
    .to(accent, { scaleY: 1.13, svgOrigin: CORE, duration: 0.14, ease: "power2.out" }, 0)
    .to(bars, { scaleY: 1, svgOrigin: CORE, duration: 0.22, ease: "power2.inOut" }, 0.16)
    .to(others, { scaleY: 1.03, svgOrigin: CORE, duration: 0.12, ease: "power2.out" }, 0.4)
    .to(accent, { scaleY: 1.07, svgOrigin: CORE, duration: 0.12, ease: "power2.out" }, 0.4)
    .to(bars, { scaleY: 1, svgOrigin: CORE, duration: 0.4, ease: "power2.out" }, 0.54);
}

/** A heartbeat every few seconds; returns a timeline to play/pause with visibility. */
export function heartbeat(svg, { every = 2.4 } = {}) {
  return gsap.timeline({ paused: true, repeat: -1, repeatDelay: every }).add(beat(svg));
}

/** A small level-meter ripple across the bars. */
export function ripple(svg) {
  return gsap.to(barsOf(svg), {
    keyframes: { y: [0, -2.2, 0.6, 0], ease: "sine.inOut" },
    duration: 0.9,
    stagger: 0.045,
    overwrite: "auto",
  });
}

export function bindHoverRipple(scope = document) {
  scope.querySelectorAll("[data-mark-hover]").forEach((svg) => {
    const host = svg.closest("a, button, div") || svg;
    let running = null;
    host.addEventListener("pointerenter", () => {
      if (running?.isActive()) return;
      running = ripple(svg);
    });
  });
}
