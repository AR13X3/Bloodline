// Hero: masked word reveal, floating product cards with pointer parallax, and a
// heartbeat line that draws in and then pulses while the hero is on screen.
import { gsap, ScrollTrigger, SplitText } from "./gsap.js";
import { assemble } from "./mark.js";

// Builds the heartbeat path in real pixels so DrawSVG lengths stay exact at any width.
function pulsePath(width, height) {
  const base = height * 0.62;
  const s = Math.min(1, height / 170);
  const x0 = Math.max(width * 0.64, width - 560);
  const beat = [
    [0, 0], [16, -20], [34, 26], [60, -86], [86, 50], [106, -14], [124, 0],
    [190, 0], [206, -8], [222, 0],
  ];
  const points = beat.map(([dx, dy]) => `L${(x0 + dx * s).toFixed(1)} ${(base + dy * s).toFixed(1)}`).join(" ");
  return `M0 ${base.toFixed(1)} L${x0.toFixed(1)} ${base.toFixed(1)} ${points} L${width} ${base.toFixed(1)}`;
}

export function initHero({ reduced }) {
  const hero = document.querySelector(".hero");
  const inner = hero.querySelector(".hero__inner");
  const pre = hero.querySelector("[data-hero-pre]");
  const title = hero.querySelector("[data-hero-title]");
  const fades = hero.querySelectorAll("[data-hero-fade]");
  const float = hero.querySelector(".hero__float");
  const cards = gsap.utils.toArray(".hcard", hero);
  const svg = hero.querySelector(".hero__pulse");
  const base = svg.querySelector(".hero__pulse-base");
  const glow = svg.querySelector(".hero__pulse-glow");
  const cue = hero.querySelector(".hero__scroll");
  const nav = document.querySelector("[data-nav]");
  const navMark = nav.querySelector(".mark");

  let introDone = false;
  const layoutPulse = () => {
    const { width, height } = svg.getBoundingClientRect();
    if (!width || !height) return;
    svg.setAttribute("viewBox", `0 0 ${Math.round(width)} ${Math.round(height)}`);
    const d = pulsePath(width, height);
    base.setAttribute("d", d);
    glow.setAttribute("d", d);
    if (introDone || reduced) gsap.set(base, { drawSVG: "100%" });
  };
  layoutPulse();
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutPulse, 150);
  });

  if (reduced) return { play() {} };

  const preSplit = SplitText.create(pre, { type: "words", mask: "words", wordsClass: "wd" });
  const titleSplit = SplitText.create(title, { type: "words", mask: "words", wordsClass: "wd" });

  gsap.set([...preSplit.words, ...titleSplit.words], { yPercent: 118 });
  gsap.set(fades, { autoAlpha: 0, y: 26 });
  gsap.set(cards, { autoAlpha: 0, yPercent: 40, rotate: (i) => (i ? -5 : 5) });
  gsap.set(base, { drawSVG: "0%" });
  gsap.set(cue, { autoAlpha: 0 });
  gsap.set(nav, { yPercent: -170 });

  // A bright segment travels the line; it only runs while the hero is visible.
  const beat = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.4 });
  beat
    .set(glow, { opacity: 1 })
    .fromTo(glow, { drawSVG: "0% 0%" }, { drawSVG: "88% 100%", duration: 3.4, ease: "power1.inOut" })
    .to(glow, { opacity: 0, duration: 0.5, ease: "power1.out" }, "-=0.5");

  ScrollTrigger.create({
    trigger: hero,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => introDone && (self.isActive ? beat.play() : beat.pause()),
  });

  const intro = gsap.timeline({
    paused: true,
    onComplete: () => {
      introDone = true;
      beat.play(0);
    },
  });
  intro
    .to(preSplit.words, { yPercent: 0, duration: 1.1, stagger: 0.035 })
    .to(titleSplit.words, { yPercent: 0, duration: 1.45, stagger: 0.075 }, 0.15)
    .to(base, { drawSVG: "100%", duration: 2.4, ease: "glide" }, 0.1)
    .to(fades, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.12 }, 0.75)
    .to(cards, { autoAlpha: 1, yPercent: 0, rotate: 0, duration: 1.7, stagger: 0.16 }, 0.7)
    .to(nav, { yPercent: 0, duration: 1.1 }, 0.9)
    .add(assemble(navMark, { duration: 1, stagger: 0.05 }), 1.05)
    .to(cue, { autoAlpha: 1, duration: 0.8 }, 1.4);

  // Scrolling away: copy lifts and fades, cards drift up faster for depth.
  gsap
    .timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 1 } })
    .to(inner, { yPercent: -16, opacity: 0, scale: 0.97, transformOrigin: "0% 100%", ease: "none" }, 0)
    .to(float, { y: -220, opacity: 0, ease: "none" }, 0)
    .to(svg, { y: 60, opacity: 0, ease: "none" }, 0)
    .to(cue, { opacity: 0, duration: 0.2, ease: "none" }, 0);

  // Pointer parallax on the cards, eased so it never snaps.
  if (window.matchMedia("(pointer: fine)").matches) {
    const movers = cards.map((card) => ({
      depth: Number(card.dataset.depth) || 1,
      x: gsap.quickTo(card, "x", { duration: 1.4, ease: "power3.out" }),
      y: gsap.quickTo(card, "y", { duration: 1.4, ease: "power3.out" }),
    }));
    hero.addEventListener("pointermove", (event) => {
      const nx = event.clientX / window.innerWidth - 0.5;
      const ny = event.clientY / window.innerHeight - 0.5;
      movers.forEach((m) => {
        m.x(nx * 26 * m.depth);
        m.y(ny * 20 * m.depth);
      });
    });
  }

  return { play: () => intro.play() };
}
