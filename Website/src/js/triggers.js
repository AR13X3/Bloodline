// "Exactly three things": cards pin in a stack. Each new card slides over the last,
// which eases back and dims. Every card plays its own small motion graphic.
import { gsap, ScrollTrigger, PIN_AHEAD } from "./gsap.js";

const isNarrow = () => window.matchMedia("(max-width: 900px)").matches;
const stickTop = (i) => (isNarrow() ? 76 + i * 12 : 96 + i * 18);

function flagViz(viz) {
  const row = viz.querySelector(".vrow");
  const flag = viz.querySelector(".vflag");
  const rings = viz.querySelectorAll(".vflag i");
  const line = viz.querySelector(".vline path");
  const alert = viz.querySelector(".valert");
  return gsap
    .timeline({ paused: true })
    .from(row, { y: 24, autoAlpha: 0, duration: 0.8 })
    .from(flag, { scale: 0.4, autoAlpha: 0, duration: 0.6, ease: "power3.out" }, 0.35)
    .fromTo(rings, { scale: 1, autoAlpha: 0.9 }, { scale: 2.6, autoAlpha: 0, duration: 1.3, stagger: 0.35, ease: "power2.out" }, 0.6)
    .fromTo(line, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.6, ease: "power2.inOut" }, 0.8)
    .from(alert, { y: 18, autoAlpha: 0, scale: 0.96, duration: 0.8 }, 1.2);
}

function rangeViz(viz) {
  const num = viz.querySelector("[data-range-val]");
  const dot = viz.querySelector("[data-range-dot]");
  const value = { v: 142 };
  const at = (v) => (v - 100); // the ruler spans 100–200 g/L, so xPercent = v − 100
  const render = () => {
    const v = Math.round(value.v);
    num.textContent = v;
    viz.classList.toggle("is-out", v < 130);
  };
  gsap.set(dot, { x: 0, xPercent: at(142) });
  render();
  return gsap
    .timeline({ paused: true })
    .from(viz.querySelector(".ruler__band"), { scaleX: 0, duration: 0.9, ease: "glide" })
    .to(dot, { xPercent: at(118), duration: 1.9, ease: "power2.inOut" }, 0.5)
    .to(value, { v: 118, duration: 1.9, ease: "power2.inOut", onUpdate: render }, 0.5);
}

function ruleViz(viz) {
  return gsap
    .timeline({ paused: true })
    .from(viz.querySelector(".vrule"), { x: -30, autoAlpha: 0, duration: 0.9 })
    .from(viz.querySelector(".vincoming"), { y: -26, autoAlpha: 0, duration: 0.9 }, 0.45)
    .from(viz.querySelectorAll(".vincoming .chip"), { autoAlpha: 0, y: 8, duration: 0.5, stagger: 0.1 }, 0.9)
    .from(viz.querySelector(".vmatch .chip"), { scale: 0.7, autoAlpha: 0, duration: 0.7, ease: "power3.out" }, 1.5)
    .to(viz.querySelector(".vrule"), { borderColor: "rgba(233, 173, 76, 0.75)", duration: 0.6, ease: "power1.out" }, 1.5);
}

function cantViz(viz) {
  const val = viz.querySelector("[data-scramble]");
  const text = val.textContent;
  return gsap
    .timeline({ paused: true })
    .from(viz.querySelector(".vcant"), { y: 20, autoAlpha: 0, duration: 0.8 })
    .to(val, { duration: 1.3, scrambleText: { text, chars: "0123456789.<>", speed: 0.5, revealDelay: 0.4 }, ease: "none" }, 0.2)
    .from(viz.querySelectorAll(".vcant__q path, .vcant__q circle"), { drawSVG: "0%", duration: 0.9, stagger: 0.15, ease: "power2.inOut" }, 1.1)
    .from(viz.querySelector(".chip"), { y: 10, autoAlpha: 0, duration: 0.7 }, 1.6);
}

const builders = [flagViz, rangeViz, ruleViz, cantViz];

export function initTriggers({ reduced }) {
  const cards = gsap.utils.toArray("[data-tcard]");
  if (reduced) return;

  const last = cards[cards.length - 1];

  cards.forEach((card, i) => {
    // Pin each card at its own offset until the last card has landed.
    ScrollTrigger.create({
      trigger: card,
      start: () => `top top+=${stickTop(i)}`,
      endTrigger: last,
      end: () => `top top+=${stickTop(cards.length - 1)}`,
      pin: true,
      pinSpacing: false,
      anticipatePin: PIN_AHEAD,
      invalidateOnRefresh: true,
    });

    const next = cards[i + 1];
    if (next) {
      gsap.to(card, {
        scale: 0.92,
        "--shade": 0.55,
        ease: "none",
        scrollTrigger: {
          trigger: next,
          start: "top bottom",
          end: () => `top top+=${stickTop(i + 1)}`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
    }

    const viz = card.querySelector(".tcard__viz");
    const play = builders[i](viz);
    ScrollTrigger.create({
      trigger: card,
      start: "top 62%",
      onEnter: () => play.play(),
      onLeaveBack: () => play.reverse(),
    });
  });
}
