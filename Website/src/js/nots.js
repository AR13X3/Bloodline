// "What it doesn't do": big rows drift in opposite directions with the scroll,
// then the one thing it does do rises into place.
import { gsap, SplitText } from "./gsap.js";

export function initNots({ reduced }) {
  const section = document.querySelector(".nots");
  const rows = gsap.utils.toArray(".nots__row", section);
  const title = section.querySelector("[data-nots-title]");
  if (reduced) return;

  rows.forEach((row) => {
    const leftward = Number(row.dataset.rowDir) < 0;
    gsap.fromTo(
      row,
      { xPercent: leftward ? 0 : -22 },
      {
        xPercent: leftward ? -22 : 0,
        ease: "none",
        scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 1.2 },
      },
    );
  });

  // The rows dim as the answer arrives, so it reads as the conclusion.
  gsap.to(rows, {
    opacity: 0.35,
    ease: "none",
    scrollTrigger: { trigger: title, start: "top 85%", end: "top 45%", scrub: 1 },
  });

  const split = SplitText.create(title, { type: "words,chars", mask: "words", wordsClass: "wd", charsClass: "ch" });
  gsap.from(split.chars, {
    yPercent: 110,
    duration: 1.2,
    stagger: 0.025,
    scrollTrigger: { trigger: title, start: "top 80%", once: true },
  });
}
