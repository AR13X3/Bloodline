// Back-to-top button. While the page is scrolling, a bubble pulls away from the
// button (a gooey SVG filter makes the two read as one liquid shape that splits)
// and says what it does; when scrolling stops, the bubble flows back in.
import { gsap, ScrollTrigger } from "./gsap.js";

const IDLE_MS = 650;
const GAP = 10; // space between the button and the bubble once they've split

export function initToTop({ reduced, lenis }) {
  const btn = document.querySelector("[data-totop]");
  if (!btn) return;
  const ball = btn.querySelector(".totop__ball");
  const blob = btn.querySelector(".totop__blob");
  const label = btn.querySelector(".totop__label");

  if (window.matchMedia("(hover: none)").matches) label.textContent = "Tap to go back to the top";

  let visible = false;
  let returning = false;
  let idleTimer;

  gsap.set(btn, { autoAlpha: 0, scale: 0.6 });

  // The split, built from measured sizes so it fits whatever the label says.
  let split = gsap.timeline({ paused: true });
  const build = () => {
    const progress = split.progress();
    split.kill();
    const size = ball.offsetWidth;
    const width = label.offsetWidth;
    const shift = -(size + GAP);
    gsap.set(blob, { width: size, x: 0 });
    gsap.set(label, { x: shift, autoAlpha: 0 });
    split = gsap
      .timeline({ paused: true, onReverseComplete: gulp })
      // The bubble starts to pull away; the filter stretches a neck between them.
      .to(blob, { x: -size * 0.45, duration: 0.24, ease: "power2.in" }, 0)
      .to(ball, { scaleX: 0.94, duration: 0.24, ease: "power2.in" }, 0)
      // It snaps free and opens out into the label's pill.
      .to(blob, { x: shift, width, duration: 0.6, ease: "power3.out" }, 0.2)
      .to(ball, { scaleX: 1, duration: 0.4, ease: "power2.out" }, 0.2)
      .fromTo(label, { x: shift + 14, autoAlpha: 0 }, { x: shift, autoAlpha: 1, duration: 0.4, ease: "power2.out" }, 0.42);
    split.progress(progress);
  };
  const merge = () => split.progress() > 0 && split.reverse();
  // When the bubble flows back in, the button swallows it with a small pulse.
  const gulp = () => gsap.fromTo(ball, { scale: 1 }, { scale: 1.08, duration: 0.16, yoyo: true, repeat: 1, ease: "sine.inOut" });

  if (!reduced) {
    build();
    document.fonts.ready.then(build);
    window.addEventListener("resize", build);
  }

  const show = (on) => {
    visible = on;
    if (!on) {
      clearTimeout(idleTimer);
      if (!reduced) merge();
    }
    gsap.to(btn, {
      autoAlpha: on ? 1 : 0,
      scale: on ? 1 : 0.6,
      duration: reduced ? 0 : on ? 0.6 : 0.4,
      ease: on ? "silk" : "power2.in",
      overwrite: "auto",
    });
  };

  ScrollTrigger.create({
    start: () => window.innerHeight * 0.6,
    end: "max",
    onToggle: (self) => show(self.isActive),
  });

  if (!reduced) {
    window.addEventListener(
      "scroll",
      () => {
        if (!visible || returning) return;
        split.play();
        clearTimeout(idleTimer);
        idleTimer = setTimeout(merge, IDLE_MS);
      },
      { passive: true },
    );
  }

  btn.addEventListener("click", () => {
    returning = true;
    clearTimeout(idleTimer);
    if (!reduced) merge();
    const done = () => {
      returning = false;
      history.replaceState(null, "", location.pathname);
    };
    if (lenis) lenis.scrollTo(0, { duration: 1.8, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), onComplete: done });
    else {
      window.scrollTo(0, 0);
      done();
    }
  });
}
