// "Why now": the section pins and its cards travel sideways with the scroll.
import { gsap, PIN_AHEAD } from "./gsap.js";

export function initWhy({ reduced }) {
  if (reduced) return;
  const section = document.querySelector(".why");
  const track = section.querySelector("[data-why-track]");
  const bar = section.querySelector(".why__progress span");
  const cards = gsap.utils.toArray(".wcard", track);

  const distance = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);

  const travel = gsap.to(track, {
    x: () => -distance(),
    ease: "none",
    scrollTrigger: {
      trigger: section,
      start: "top top",
      // A little longer than the travel, so the cards move slightly slower than the scroll.
      end: () => `+=${Math.round(distance() * 1.25 + window.innerHeight * 0.3)}`,
      pin: true,
      anticipatePin: PIN_AHEAD,
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
    },
  });

  cards.forEach((card) => {
    gsap.from(card, {
      y: 60,
      rotate: 3,
      opacity: 0.25,
      ease: "none",
      scrollTrigger: { trigger: card, containerAnimation: travel, start: "left 100%", end: "left 62%", scrub: true },
    });
    gsap.from(card.querySelectorAll(".wcard__art > *"), {
      drawSVG: "0%",
      ease: "none",
      stagger: 0.1,
      scrollTrigger: { trigger: card, containerAnimation: travel, start: "left 90%", end: "left 30%", scrub: true },
    });
  });
}
