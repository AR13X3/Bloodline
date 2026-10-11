// The problem statement holds on screen while its words light up with the scroll.
import { gsap, SplitText, PIN_AHEAD } from "./gsap.js";

export function initStatement({ reduced }) {
  if (reduced) return;
  const section = document.querySelector(".statement");
  const text = section.querySelector("[data-statement]");

  // Words only (no lines), so the split survives any resize.
  const split = SplitText.create(text, { type: "words", wordsClass: "sw" });
  const emphasis = split.words.filter((word) => word.closest("em"));

  gsap.set(split.words, { opacity: 0.13 });

  gsap
    .timeline({
      scrollTrigger: { trigger: section, start: "top top", end: "+=150%", pin: true, anticipatePin: PIN_AHEAD, scrub: 1 },
    })
    .to(split.words, { opacity: 1, stagger: 0.1, duration: 0.5, ease: "none" })
    .fromTo(emphasis, { y: 0 }, { y: -4, stagger: 0.04, duration: 0.4, ease: "none" }, ">-0.2")
    .to({}, { duration: 0.6 });
}
