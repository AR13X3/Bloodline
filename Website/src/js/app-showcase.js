// The app: the phone tilts up into place, then pins while its screens wipe from
// one to the next and the callouts trade places beside it.
import { gsap, PIN_AHEAD } from "./gsap.js";

export function initApp({ reduced }) {
  const section = document.querySelector(".app");
  const phone = section.querySelector("[data-phone-3d]");
  const frame = section.querySelector(".phone__frame");
  const glow = section.querySelector(".phone__glow");
  const screen = section.querySelector("[data-phone-screen]");
  const screens = gsap.utils.toArray("[data-screen]", section);
  const left = gsap.utils.toArray(".callouts--left li", section);
  const right = gsap.utils.toArray(".callouts--right li", section);
  const dots = gsap.utils.toArray(".app__dots i", section);
  const pairs = screens.map((_, i) => [left[i], right[i]]);

  const setDot = (index) => dots.forEach((dot, i) => dot.classList.toggle("is-on", i === index));

  gsap.set(screens.slice(1), { clipPath: "inset(100% 0% 0% 0%)" });
  gsap.set(screens[0], { clipPath: "inset(0% 0% 0% 0%)" });
  gsap.set(screen, { "--status-bg": screens[0].dataset.status });
  gsap.set([...left, ...right], { autoAlpha: 0 });
  gsap.set(pairs[0], { autoAlpha: 1 });
  setDot(0);

  if (reduced) return;

  gsap.set(pairs[0], { autoAlpha: 0, "--line": 0 });

  // Entrance, before the pin: the phone rises and flattens out of a tilt.
  gsap
    .timeline({ scrollTrigger: { trigger: section, start: "top bottom", end: "top top", scrub: 1 } })
    .fromTo(frame, { rotateX: 24, rotateY: -18, y: 140, scale: 0.84 }, { rotateX: 0, rotateY: 0, y: 0, scale: 1, ease: "none" }, 0)
    .fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, ease: "none" }, 0);

  const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });
  tl.to(pairs[0], { autoAlpha: 1, "--line": 1, duration: 0.7, ease: "power2.out" }, 0.1);

  const step = 1.5;
  const switchAt = [0];
  for (let i = 1; i < screens.length; i++) {
    const at = i * step - 0.6;
    switchAt.push(at + 0.5);
    tl.to(pairs[i - 1], { autoAlpha: 0, y: -14, duration: 0.45, ease: "power2.in" }, at)
      .to(screens[i - 1], { scale: 0.9, yPercent: -3, duration: 1 }, at)
      .fromTo(screens[i], { yPercent: 8 }, { yPercent: 0, duration: 1 }, at)
      .to(screens[i], { clipPath: "inset(0% 0% 0% 0%)", duration: 1 }, at)
      .to(screen, { "--status-bg": screens[i].dataset.status, duration: 0.6, ease: "power1.inOut" }, at + 0.4)
      .to(phone, { rotateY: i % 2 ? 7 : -7, duration: 1 }, at)
      .fromTo(pairs[i], { autoAlpha: 0, y: 16, "--line": 0 }, { autoAlpha: 1, y: 0, "--line": 1, duration: 0.6, ease: "power2.out" }, at + 0.55);
  }
  tl.to(phone, { rotateY: 0, duration: 0.8 }, ">-0.3").to({}, { duration: 0.5 });

  let current = 0;
  tl.eventCallback("onUpdate", () => {
    const time = tl.time();
    let index = 0;
    switchAt.forEach((t, i) => {
      if (time >= t) index = i;
    });
    if (index !== current) {
      current = index;
      setDot(index);
    }
  });

  gsap.to(tl, {
    progress: 1,
    ease: "none",
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: () => `+=${Math.round(window.innerHeight * 3)}`,
      pin: true,
      anticipatePin: PIN_AHEAD,
      scrub: 1,
    },
  });
}
