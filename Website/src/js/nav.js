// Nav: a full-width bar at the top that draws in to a pill once you scroll; tucks away
// while reading down and returns on the way up. Highlights the current section and
// draws the reading-progress line along the top.
import { gsap, ScrollTrigger } from "./gsap.js";

export function initNav({ reduced }) {
  const nav = document.querySelector("[data-nav]");
  const bar = document.querySelector(".progress span");

  gsap.to(bar, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: reduced ? true : 0.4 } });

  ScrollTrigger.create({
    start: 40,
    end: "max",
    onToggle: (self) => nav.classList.toggle("is-pill", self.isActive),
  });

  document.querySelectorAll(".nav__links a").forEach((link) => {
    const href = link.getAttribute("href");
    // On other pages the links point back to the home page ("/#how"); nothing to track.
    const section = href.startsWith("#") && document.querySelector(href);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: "top 50%",
      end: "bottom 50%",
      onToggle: (self) => link.classList.toggle("is-current", self.isActive),
    });
  });

  if (reduced) return;

  let hidden = false;
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      const hide = self.direction === 1 && self.scroll() > 320;
      if (hide === hidden) return;
      hidden = hide;
      gsap.to(nav, {
        yPercent: hide ? -170 : 0,
        duration: hide ? 0.5 : 0.8,
        ease: hide ? "power2.in" : "silk",
        overwrite: true,
      });
    },
  });
}
