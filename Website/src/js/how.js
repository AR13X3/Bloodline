// "From report to review": one pinned timeline, scrubbed by scroll, that walks a
// lab report through OCR, the checks, the alert and the "Seen" tap.
import { gsap, PIN_AHEAD } from "./gsap.js";

export function initHow({ reduced }) {
  const section = document.querySelector(".how");
  const steps = gsap.utils.toArray(".step", section);
  const rail = section.querySelector(".steps__rail span");
  const report = section.querySelector("[data-report]");
  const rows = gsap.utils.toArray(".rrow", report);
  const scan = report.querySelector(".report__scan");
  const scanBar = scan.querySelector("i");
  const fields = section.querySelector("[data-fields]");
  const fieldRows = gsap.utils.toArray(".field", fields);
  const verdicts = fieldRows.map((f) => f.querySelector(".field__verdict"));
  const channels = gsap.utils.toArray(".channel", section);
  const phone = section.querySelector("[data-phone]");
  const notif = section.querySelector("[data-notif]");
  const alert = section.querySelector("[data-alert]");
  const reasons = gsap.utils.toArray(".pm__reason", section);
  const seenFill = section.querySelector(".pm__seen-fill");
  const seenLabel = section.querySelector(".pm__seen-label");
  const seenDone = section.querySelector(".pm__seen-done");
  const check = section.querySelector(".pm__check");
  const audit = section.querySelector("[data-audit]");
  const auditText = section.querySelector("[data-audit-text]");

  const flaggedIdx = [0, 4];
  const isFlagged = (_, i) => flaggedIdx.includes(i);
  const flaggedRows = rows.filter(isFlagged);
  const flaggedFields = fieldRows.filter(isFlagged);
  const okFields = fieldRows.filter((f, i) => !isFlagged(f, i));
  const okVerdicts = verdicts.filter((v, i) => !isFlagged(v, i));
  const flagVerdicts = verdicts.filter(isFlagged);

  const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut", duration: 1 } });

  // Starting state.
  tl.set(report, { autoAlpha: 0, y: 70, rotate: -4, scale: 1, xPercent: 0 }, 0)
    .set(rows, { autoAlpha: 0, x: -14, "--row-on": 0 }, 0)
    .set(scan, { autoAlpha: 0 }, 0)
    .set(fields, { autoAlpha: 0, x: 50, scale: 1 }, 0)
    .set(fieldRows, { autoAlpha: 0, x: -26, "--flag-on": 0 }, 0)
    .set(verdicts, { autoAlpha: 0, scale: 0.7, transformOrigin: "0% 50%" }, 0)
    .set(channels, { autoAlpha: 0, y: 18 }, 0)
    .set(phone, { autoAlpha: 0, x: 90, rotate: 5 }, 0)
    .set(notif, { autoAlpha: 0, y: -36, scale: 0.94 }, 0)
    .set(alert, { autoAlpha: 0, y: 34 }, 0)
    .set(reasons, { autoAlpha: 0, y: 14 }, 0)
    .set(seenFill, { scaleX: 0 }, 0)
    .set(seenDone, { autoAlpha: 0, y: 10 }, 0)
    .set(audit, { autoAlpha: 0, y: 16 }, 0)
    .set(auditText, { clipPath: "inset(0% 100% 0% 0%)" }, 0);

  // 1. The report arrives.
  tl.addLabel("s1", 0)
    .to(report, { autoAlpha: 1, y: 0, rotate: 0, duration: 1.3, ease: "power3.out" }, "s1")
    .to(rows, { autoAlpha: 1, x: 0, duration: 0.6, stagger: 0.12, ease: "power2.out" }, "s1+=0.45");

  // 2. OCR copies each value: a scan line passes, each row lifts into the reading.
  // The bar is 34% of the rows' height, so -100% to 294% sweeps the whole list at any size.
  tl.addLabel("s2", 2.1)
    .to(fields, { autoAlpha: 1, x: 0, duration: 0.9, ease: "power3.out" }, "s2")
    .fromTo(scanBar, { yPercent: -100 }, { yPercent: 294, duration: 2.2, ease: "none" }, "s2+=0.15")
    .to(scan, { autoAlpha: 1, duration: 0.2, ease: "none" }, "s2+=0.15")
    .to(scan, { autoAlpha: 0, duration: 0.3, ease: "none" }, "s2+=2.2");
  rows.forEach((row, i) => {
    const t = 0.45 + i * 0.4;
    tl.to(row, { "--row-on": 1, duration: 0.15, ease: "none" }, `s2+=${t}`)
      .to(row, { "--row-on": 0, duration: 0.45, ease: "power1.out" }, `s2+=${t + 0.15}`)
      .to(fieldRows[i], { autoAlpha: 1, x: 0, duration: 0.55, ease: "power3.out" }, `s2+=${t}`);
  });

  // 3. Plain code checks each value against the flag and the printed range.
  tl.addLabel("s3", 4.7)
    .to(okVerdicts, { autoAlpha: 1, scale: 1, duration: 0.5, stagger: 0.14, ease: "power3.out" }, "s3")
    .to(flagVerdicts, { autoAlpha: 1, scale: 1, duration: 0.6, stagger: 0.2, ease: "power3.out" }, "s3+=0.55")
    .to(flaggedFields, { "--flag-on": 1, duration: 0.5, ease: "power2.out" }, "s3+=0.55")
    .to(flaggedRows, { "--row-on": 1, duration: 0.5, ease: "power2.out" }, "s3+=0.55")
    .to(okFields, { opacity: 0.45, duration: 0.6 }, "s3+=1.2");

  // 4. The alert goes out: the app first, then the nudges.
  tl.addLabel("s4", 6.9)
    .to(report, { autoAlpha: 0.22, scale: 0.9, xPercent: -6, duration: 1.1 }, "s4")
    .to(fields, { autoAlpha: 0, x: -50, scale: 0.94, duration: 0.9 }, "s4")
    .to(phone, { autoAlpha: 1, x: 0, rotate: 0, duration: 1.3, ease: "power3.out" }, "s4+=0.2")
    .to(notif, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "power3.out" }, "s4+=0.95")
    .to(channels, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.1, ease: "power3.out" }, "s4+=0.6")
    .to(
      channels,
      {
        color: "#dcebd2",
        borderColor: "rgba(185, 211, 168, 0.6)",
        backgroundColor: "rgba(185, 211, 168, 0.12)",
        duration: 0.35,
        stagger: 0.22,
        ease: "power1.out",
      },
      "s4+=1.1",
    )
    .to(notif, { autoAlpha: 0, y: -70, duration: 0.6, ease: "power2.in" }, "s4+=2.1")
    .to(alert, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" }, "s4+=2.3")
    .to(reasons, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.2, ease: "power3.out" }, "s4+=2.7");

  // 5. The GP marks it seen, and it lands in the audit trail.
  tl.addLabel("s5", 9.6)
    .to(seenFill, { scaleX: 1, duration: 0.9, ease: "glide" }, "s5")
    .to(seenLabel, { autoAlpha: 0, y: -10, duration: 0.35 }, "s5+=0.55")
    .to(seenDone, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out" }, "s5+=0.7")
    .fromTo(check, { scale: 1 }, { scale: 1.2, duration: 0.25, yoyo: true, repeat: 1, ease: "power1.inOut" }, "s5+=0.7")
    .to(audit, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" }, "s5+=1")
    .to(auditText, { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "steps(34)" }, "s5+=1.2")
    .to({}, { duration: 0.9 });

  const marks = ["s1", "s2", "s3", "s4", "s5"].map((label) => tl.labels[label]);
  let active = -1;
  const setActive = () => {
    const time = tl.time();
    let index = 0;
    marks.forEach((mark, i) => {
      if (time >= mark - 0.2) index = i;
    });
    if (index === active) return;
    active = index;
    steps.forEach((step, i) => step.classList.toggle("is-active", i === index));
  };

  if (reduced) {
    tl.progress(1);
    steps.forEach((step) => step.classList.add("is-active"));
    return;
  }

  tl.fromTo(rail, { scaleY: 0 }, { scaleY: 1, ease: "none", duration: tl.duration() }, 0);
  tl.eventCallback("onUpdate", setActive);

  gsap.to(tl, {
    progress: 1,
    ease: "none",
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: () => `+=${Math.round(window.innerHeight * 4.2)}`,
      pin: true,
      anticipatePin: PIN_AHEAD,
      scrub: 1,
      invalidateOnRefresh: true,
    },
  });
  setActive();
}
