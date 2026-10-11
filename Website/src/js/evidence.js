// Evidence: stat cards rise in together, numbers count up, each with a small graphic.
import { gsap } from "./gsap.js";
import { formatNumber } from "./common.js";

export function initEvidence({ reduced }) {
  const section = document.querySelector(".evidence");
  const grid = section.querySelector(".stats");
  const stats = gsap.utils.toArray("[data-stat]", section);

  // 100 dots, filled column by column so the lit share reads like a bar.
  const dots = section.querySelector(".stat__viz--dots");
  for (let i = 0; i < 100; i++) {
    const dot = document.createElement("i");
    if (i < 76) dot.className = "on";
    dots.append(dot);
  }

  if (reduced) return;

  gsap.from(stats, {
    y: 70,
    autoAlpha: 0,
    duration: 1.3,
    stagger: 0.12,
    scrollTrigger: { trigger: grid, start: "top 82%", once: true },
  });

  stats.forEach((stat, index) => {
    const tl = gsap.timeline({
      delay: index * 0.12 + 0.25,
      scrollTrigger: { trigger: grid, start: "top 82%", once: true },
    });

    stat.querySelectorAll("[data-count]").forEach((el) => {
      const target = Number(el.dataset.count);
      const decimals = Number(el.dataset.decimals || 0);
      const counter = { value: 0 };
      el.textContent = formatNumber(0, decimals);
      tl.to(
        counter,
        {
          value: target,
          duration: 1.8,
          ease: "power3.out",
          onUpdate: () => (el.textContent = formatNumber(counter.value, decimals)),
        },
        0,
      );
    });

    const band = stat.querySelector(".stat__band");
    if (band) tl.from(band, { scaleX: 0, duration: 1.6, ease: "glide" }, 0.1);

    const line = stat.querySelector(".stat__line");
    if (line) {
      tl.from(line, { drawSVG: "0%", duration: 1.8, ease: "glide" }, 0.1);
      tl.from(stat.querySelector(".stat__area"), { opacity: 0, duration: 1.2, ease: "power2.out" }, 0.8);
    }

    const lit = stat.querySelectorAll(".stat__viz--dots i.on");
    if (lit.length) tl.from(lit, { opacity: 0.12, duration: 0.5, stagger: 0.012, ease: "power2.out" }, 0.1);
  });
}
