// Closing call to action: the video brightens (data-veil), the mark opens and starts
// to beat, and the title rises in.
import { gsap, ScrollTrigger, SplitText } from "./gsap.js";
import { assemble, heartbeat } from "./mark.js";

export function initClosing({ reduced }) {
  if (reduced) return;
  const section = document.querySelector(".closing");
  const title = section.querySelector("[data-closing-title]");
  const fades = section.querySelectorAll("[data-closing-fade]");
  const mark = section.querySelector("[data-closing-mark]");
  const pulse = heartbeat(mark);
  let opened = false;
  gsap.set(mark.querySelectorAll(".mark__bar"), { scaleY: 0.04, opacity: 0, svgOrigin: "17.5 16" });
  ScrollTrigger.create({
    trigger: mark,
    start: "top 85%",
    end: "bottom top",
    onEnter: () => {
      if (opened) return pulse.play();
      opened = true;
      assemble(mark, { duration: 1.4, stagger: 0.09 }).then(() => pulse.play(0));
    },
    onEnterBack: () => opened && pulse.play(),
    onLeave: () => pulse.pause(),
    onLeaveBack: () => pulse.pause(),
  });

  const split = SplitText.create(title, { type: "words,chars", mask: "words", wordsClass: "wd", charsClass: "ch" });

  gsap
    .timeline({ scrollTrigger: { trigger: title, start: "top 80%", once: true } })
    .from(split.chars, { yPercent: 110, rotate: 4, duration: 1.3, stagger: 0.03 }, 0.35)
    .from(fades, { y: 24, autoAlpha: 0, duration: 1.1, stagger: 0.12 }, 0.85);

  // A slow scale as the section scrolls through gives the type some depth.
  gsap.fromTo(
    title,
    { scale: 0.94 },
    { scale: 1.03, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 1 } },
  );
}
