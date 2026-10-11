// One place to register GSAP plugins and set the site's motion defaults.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin, ScrambleTextPlugin, CustomEase);

// "silk": quick start, long settle, no overshoot. Matches --ease in CSS.
CustomEase.create("silk", "0.22, 1, 0.36, 1");
// "glide": symmetrical in-out for things that travel across the screen.
CustomEase.create("glide", "0.65, 0, 0.35, 1");

gsap.defaults({ ease: "silk", duration: 1 });

// Touch scrolling is native and runs off the main thread, so pins need to engage a
// touch early or they jump. With Lenis (mouse and trackpad) that same head start
// causes a glitch, so it's only used on touch screens.
export const PIN_AHEAD = window.matchMedia("(hover: none) and (pointer: coarse)").matches ? 1 : 0;

// Mobile address bars resize the viewport constantly; don't recalculate for that.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, SplitText };
