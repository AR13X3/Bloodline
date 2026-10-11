// Opening sequence: the mark's bars open out of a flat line and beat once while fonts
// and the video load, then the curtain lifts. Never waits long on a slow connection.
import { gsap } from "./gsap.js";
import { assemble, beat } from "./mark.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function videoReady(video) {
  if (!video || video.readyState >= 3) return Promise.resolve();
  return new Promise((resolve) => {
    video.addEventListener("canplay", resolve, { once: true });
    video.addEventListener("error", resolve, { once: true });
  });
}

export function runLoader({ video, reduced }) {
  const loader = document.querySelector(".loader");
  if (!loader) return Promise.resolve();
  if (reduced) {
    loader.remove();
    return Promise.resolve();
  }

  // JS is in charge now; push the CSS failsafe back.
  loader.style.animationDelay = "10s";

  const logo = loader.querySelector(".loader__logo");
  const word = loader.querySelector(".loader__word");
  const num = loader.querySelector(".loader__num");
  const count = { value: 0 };
  const render = () => (num.textContent = Math.round(count.value));

  const ready = Promise.race([Promise.all([document.fonts.ready, videoReady(video)]), wait(2600)]);

  return new Promise((resolve) => {
    gsap.set(loader, { clipPath: "inset(0% 0% 0% 0%)" });

    const draw = gsap.timeline();
    draw
      .add(assemble(logo), 0)
      .fromTo(word, { clipPath: "inset(0% 100% 0% 0%)", x: -8 }, { clipPath: "inset(0% 0% 0% 0%)", x: 0, duration: 1 }, 0.45)
      .add(beat(logo), 1.25);

    gsap.to(count, { value: 86, duration: 1.6, ease: "power1.out", onUpdate: render });

    const exit = () => {
      gsap
        .timeline({ onComplete: () => loader.remove() })
        .to([".loader__mark", ".loader__count"], { y: -24, autoAlpha: 0, duration: 0.55, ease: "power2.in" })
        .to(loader, { clipPath: "inset(0% 0% 100% 0%)", duration: 1.15, ease: "glide" }, "-=0.1")
        // Start the hero while the curtain is still lifting, so the hand-off feels continuous.
        .add(resolve, "-=0.8");
    };

    ready.then(() => {
      const finish = () =>
        gsap.to(count, { value: 100, duration: 0.45, ease: "power1.out", onUpdate: render, onComplete: exit });
      if (draw.progress() === 1) finish();
      else draw.eventCallback("onComplete", finish);
    });
  });
}
