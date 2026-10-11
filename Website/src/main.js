import "lenis/dist/lenis.css";
import "./css/base.css";
import "./css/sections.css";

import { ScrollTrigger } from "./js/gsap.js";
import { createSmoothScroll, bindAnchors } from "./js/smooth.js";
import { runLoader } from "./js/loader.js";
import { initBackground } from "./js/background.js";
import { initNav } from "./js/nav.js";
import { revealTitle, sheetIn, initMagnetic } from "./js/common.js";
import { bindHoverRipple } from "./js/mark.js";
import { initToTop } from "./js/totop.js";
import { initHero } from "./js/hero.js";
import { initStatement } from "./js/statement.js";
import { initEvidence } from "./js/evidence.js";
import { initHow } from "./js/how.js";
import { initTriggers } from "./js/triggers.js";
import { initApp } from "./js/app-showcase.js";
import { initNots } from "./js/nots.js";
import { initWhy } from "./js/why.js";
import { initPractice } from "./js/practice.js";
import { initClosing } from "./js/closing.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
document.documentElement.classList.toggle("is-reduced", reduced);

// Always start at the top (or the linked section) so pinned sections measure cleanly.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
const startHash = location.hash && document.querySelector(location.hash) ? location.hash : null;
window.scrollTo(0, 0);

const lenis = reduced ? null : createSmoothScroll();
lenis?.stop();

const ctx = { reduced };
const video = document.querySelector(".stage-bg__video");

initBackground(ctx);

// Sections are set up in page order, so each pin accounts for the ones above it.
const hero = initHero(ctx);
initStatement(ctx);

const sectionInits = new Map([
  ["evidence", initEvidence],
  ["how", initHow],
  ["triggers", initTriggers],
  ["app", initApp],
  ["nots", initNots],
  ["why", initWhy],
  ["practice", initPractice],
  ["closing", initClosing],
]);

for (const section of document.querySelectorAll("main > section")) {
  const name = [...sectionInits.keys()].find((key) => section.classList.contains(key));
  if (!name) continue;
  if (!reduced) {
    if (section.classList.contains("sheet")) sheetIn(section);
    section.querySelectorAll("[data-reveal-title]").forEach(revealTitle);
  }
  sectionInits.get(name)(ctx);
}

initNav(ctx);
bindAnchors(lenis);
initMagnetic();
initToTop({ reduced, lenis });
if (!reduced) bindHoverRipple();

document.fonts.ready.then(() => ScrollTrigger.refresh());

runLoader({ video, reduced }).then(() => {
  lenis?.start();
  hero.play();
  if (startHash) {
    const target = document.querySelector(startHash);
    if (lenis) lenis.scrollTo(target, { immediate: true });
    else target.scrollIntoView();
  }
});
