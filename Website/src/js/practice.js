// For practices: tiles rise in, and the integration diagram draws itself and then
// sends results along the line while it's on screen.
import { gsap, ScrollTrigger } from "./gsap.js";
import { initSpotlight } from "./common.js";

export function initPractice({ reduced }) {
  const section = document.querySelector(".practice");
  const tiles = gsap.utils.toArray("[data-tile]", section);
  const flow = section.querySelector(".flow");
  const line = flow.querySelector(".flow__line");
  const nodes = gsap.utils.toArray(".flow__node", flow);
  const packets = gsap.utils.toArray(".flow__packet", flow);

  initSpotlight("[data-tile]");
  if (reduced) return;

  gsap.from(tiles, {
    y: 60,
    autoAlpha: 0,
    duration: 1.2,
    stagger: 0.1,
    scrollTrigger: { trigger: section.querySelector(".bento"), start: "top 82%", once: true },
  });

  // Packets: soft green on the way in, amber once BloodLine has spotted something.
  const runs = packets.map((packet, i) =>
    gsap
      .timeline({ paused: true, repeat: -1, delay: i * 1.7 })
      .set(packet, { fill: "#b9d3a8" })
      .to(packet, { opacity: 1, duration: 0.3, ease: "none" }, 0)
      .to(packet, { motionPath: { path: line, align: line, alignOrigin: [0.5, 0.5] }, duration: 3.4, ease: "none" }, 0)
      .to(packet, { fill: "#e9ad4c", duration: 0.2, ease: "none" }, 3.4 * 0.69)
      .to(packet, { opacity: 0, duration: 0.3, ease: "none" }, 3.1),
  );

  const intro = gsap
    .timeline({ paused: true, onComplete: () => runs.forEach((run) => run.play()) })
    .fromTo(line, { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.6, ease: "glide" })
    .from(nodes, { scale: 0.5, autoAlpha: 0, transformOrigin: "50% 50%", duration: 0.8, stagger: 0.2, ease: "power3.out" }, 0.1);

  ScrollTrigger.create({
    trigger: flow,
    start: "top 80%",
    end: "bottom top",
    onEnter: () => (intro.progress() < 1 ? intro.play() : runs.forEach((run) => run.play())),
    onEnterBack: () => intro.progress() === 1 && runs.forEach((run) => run.play()),
    onLeave: () => runs.forEach((run) => run.pause()),
    onLeaveBack: () => runs.forEach((run) => run.pause()),
  });
}
