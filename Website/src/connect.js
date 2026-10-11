// Connect page: the mark opens and starts to beat, the title rises, and the team
// cards lift in while each avatar ring draws itself.
import "lenis/dist/lenis.css";
import "./css/base.css";
import "./css/connect.css";

import { gsap, ScrollTrigger, SplitText } from "./js/gsap.js";
import { createSmoothScroll } from "./js/smooth.js";
import { initBackground } from "./js/background.js";
import { initNav } from "./js/nav.js";
import { initMagnetic, initSpotlight } from "./js/common.js";
import { assemble, heartbeat, bindHoverRipple } from "./js/mark.js";
import { initToTop } from "./js/totop.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
document.documentElement.classList.toggle("is-reduced", reduced);

const lenis = reduced ? null : createSmoothScroll();
const ctx = { reduced };

initBackground(ctx);
initNav(ctx);
initMagnetic();
initSpotlight("[data-person]");
initToTop({ reduced, lenis });

if (!reduced) {
  bindHoverRipple();

  const section = document.querySelector(".connect");
  const mark = section.querySelector("[data-connect-mark]");
  const title = section.querySelector("[data-connect-title]");
  const fades = section.querySelectorAll("[data-connect-fade]");
  const people = gsap.utils.toArray("[data-person]", section);
  const rings = section.querySelectorAll(".person__ring circle");
  const navMark = document.querySelector(".nav .mark");

  const split = SplitText.create(title, { type: "words,chars", mask: "words", wordsClass: "wd", charsClass: "ch" });
  const pulse = heartbeat(mark);
  let beating = false;

  gsap.set(section, { opacity: 1, animation: "none" });
  gsap.set(people, { autoAlpha: 0, y: 70 });

  gsap
    .timeline({
      delay: 0.1,
      onComplete: () => {
        beating = true;
        pulse.play(0);
      },
    })
    .add(assemble(mark, { duration: 1.4, stagger: 0.08 }), 0)
    .add(assemble(navMark, { duration: 1, stagger: 0.05 }), 0.1)
    .from(split.chars, { yPercent: 110, rotate: 4, duration: 1.3, stagger: 0.03 }, 0.25)
    .from(fades, { y: 24, autoAlpha: 0, duration: 1.1, stagger: 0.25 }, 0.75)
    .to(people, { autoAlpha: 1, y: 0, duration: 1.3, stagger: 0.12 }, 0.85)
    .from(rings, { drawSVG: "0%", duration: 1.5, stagger: 0.12, ease: "glide" }, 1.0);

  // Only beat while the mark is on screen.
  ScrollTrigger.create({
    trigger: mark,
    start: "top bottom",
    end: "bottom top",
    onLeave: () => pulse.pause(),
    onLeaveBack: () => pulse.pause(),
    onEnter: () => beating && pulse.play(),
    onEnterBack: () => beating && pulse.play(),
  });

  document.fonts.ready.then(() => ScrollTrigger.refresh());
}
