// Shared motion used by several sections.
import { gsap, SplitText } from "./gsap.js";

// Headings rise word by word out of a mask the first time they come into view.
export function revealTitle(el) {
  const split = SplitText.create(el, { type: "words", mask: "words", wordsClass: "wd" });
  gsap.from(split.words, {
    yPercent: 115,
    duration: 1.3,
    stagger: 0.06,
    scrollTrigger: { trigger: el, start: "top 86%", once: true },
  });
}

// Floating panels settle into place as they slide up over the video.
export function sheetIn(el) {
  gsap.fromTo(
    el,
    { scale: 0.94, yPercent: 4 },
    {
      scale: 1,
      yPercent: 0,
      ease: "none",
      scrollTrigger: { trigger: el, start: "top bottom", end: "top 25%", scrub: 1 },
    },
  );
}

const finePointer = () => window.matchMedia("(pointer: fine)").matches;

// Buttons lean gently toward the cursor. Eased follow, no spring.
export function initMagnetic() {
  if (!finePointer()) return;
  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    const toX = gsap.quickTo(el, "x", { duration: 0.8, ease: "power3.out" });
    const toY = gsap.quickTo(el, "y", { duration: 0.8, ease: "power3.out" });
    el.addEventListener("pointermove", (event) => {
      const box = el.getBoundingClientRect();
      toX((event.clientX - (box.left + box.width / 2)) * 0.22);
      toY((event.clientY - (box.top + box.height / 2)) * 0.3);
    });
    el.addEventListener("pointerleave", () => {
      toX(0);
      toY(0);
    });
  });
}

// Soft spotlight that follows the cursor across a card.
export function initSpotlight(selector) {
  if (!finePointer()) return;
  document.querySelectorAll(selector).forEach((el) => {
    el.addEventListener("pointermove", (event) => {
      const box = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${event.clientX - box.left}px`);
      el.style.setProperty("--my", `${event.clientY - box.top}px`);
    });
  });
}

export function formatNumber(value, decimals) {
  return value.toLocaleString("en-AU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
