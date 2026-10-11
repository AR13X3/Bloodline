// Lenis smooths wheel scrolling; GSAP's ticker drives it so ScrollTrigger and
// Lenis update on the same frame (no jitter between scrubbed motion and scroll).
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "./gsap.js";

export function createSmoothScroll() {
  const lenis = new Lenis({
    lerp: 0.085,
    wheelMultiplier: 0.95,
    touchMultiplier: 1.2,
  });

  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

// In-page links glide to their section (or jump, with reduced motion).
export function bindAnchors(lenis) {
  document.querySelectorAll("[data-scroll-to]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const hash = link.getAttribute("href");
      const target = hash && document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: easeOutQuart });
      else target.scrollIntoView();
      history.replaceState(null, "", hash === "#top" ? location.pathname : hash);
    });
  });
}
