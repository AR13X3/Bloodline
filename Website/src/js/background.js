// The fixed video stage. Sections declare how much they darken it (data-veil),
// and the whole page scroll gives it a slow push-in for depth.
import { gsap, ScrollTrigger } from "./gsap.js";

const PAUSE_KEY = "bloodline:bg-paused";

function readPaused(reduced) {
  try {
    const saved = localStorage.getItem(PAUSE_KEY);
    if (saved !== null) return saved === "1";
  } catch {
    /* storage can be unavailable; fall through */
  }
  return reduced;
}

function savePaused(paused) {
  try {
    localStorage.setItem(PAUSE_KEY, paused ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function initBackground({ reduced }) {
  const video = document.querySelector(".stage-bg__video");
  const veil = document.querySelector(".stage-bg__veil");
  const toggle = document.querySelector("[data-bg-toggle]");

  let paused = readPaused(reduced);

  // Autoplay can be refused (iOS Low Power Mode, data saver). The poster stays in that case.
  const play = () => video.play().catch(() => {});
  const apply = () => {
    if (paused) video.pause();
    else play();
    toggle.setAttribute("aria-pressed", String(paused));
    toggle.setAttribute("aria-label", paused ? "Play background video" : "Pause background video");
  };
  apply();

  toggle.addEventListener("click", () => {
    paused = !paused;
    savePaused(paused);
    apply();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !paused) play();
  });

  if (reduced) return;

  // Veil follows whichever section owns the middle of the screen.
  gsap.utils.toArray("[data-veil]").forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: "top 55%",
      end: "bottom 55%",
      onToggle: (self) => {
        if (!self.isActive) return;
        gsap.to(veil, { opacity: Number(section.dataset.veil), duration: 1.2, ease: "power2.out", overwrite: true });
      },
    });
  });

  // A slow push-in across the whole page.
  gsap.fromTo(
    video,
    { scale: 1.02 },
    { scale: 1.16, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 1.5 } },
  );
}
