"use client";

import { BellRing, Check, FileText, Route, ScanText, ShieldCheck, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ChannelKey, LiveRun } from "@/hooks/use-live-run";
import { fade, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { CHANNELS, SectionTitle } from "./bits";

type NodeState = "idle" | "active" | "done" | "warn" | "alert" | "muted" | "error";

const NODE_STYLES: Record<NodeState, string> = {
  idle: "bg-secondary text-muted-foreground ring-transparent",
  active: "bg-brand-soft text-primary ring-ring",
  done: "bg-primary text-primary-foreground ring-primary",
  warn: "bg-review-soft text-review-foreground ring-review/60",
  alert: "bg-review text-white ring-review",
  muted: "bg-secondary text-muted-foreground ring-transparent",
  error: "bg-destructive/10 text-destructive ring-destructive/60",
};

function Node({
  nodeRef,
  icon: Icon,
  label,
  sub,
  state,
  small,
}: {
  nodeRef: RefObject<HTMLDivElement | null>;
  icon: LucideIcon;
  label: string;
  sub: string;
  state: NodeState;
  small?: boolean;
}) {
  return (
    <div className={cn("relative z-10 flex items-center gap-3", small ? "flex-row" : "flex-col text-center")}>
      {/* State shows as a colour change only: no pulse. */}
      <div
        ref={nodeRef}
        className={cn(
          "relative grid place-items-center rounded-full ring-2 transition-colors duration-200 ease-out",
          small ? "size-10" : "size-16",
          NODE_STYLES[state],
        )}
      >
        <Icon className={small ? "size-4.5" : "size-6"} strokeWidth={1.75} />
        <AnimatePresence>
          {state === "done" && !small ? (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={fade()}
              className="absolute -right-1.5 -bottom-1.5 grid size-5 place-items-center rounded-full bg-success text-white ring-2 ring-card"
            >
              <Check className="size-3" strokeWidth={3} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      {/* Big nodes keep room for two lines, so a longer label doesn't shift the row. */}
      <div className={cn("leading-tight", small ? "min-w-20" : "min-h-11")}>
        <div className="text-sm font-medium">{label}</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={sub}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={fade(0, 0.15)}
            className={cn("text-[11px] text-muted-foreground", small ? "whitespace-nowrap" : "text-balance")}
          >
            {sub}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function num(detail: Record<string, unknown> | undefined, key: string): number {
  const v = detail?.[key];
  return typeof v === "number" ? v : 0;
}

function useElapsed(run: LiveRun | null): string | null {
  const [now, setNow] = useState(0);
  const running = Boolean(run && !run.steps.done && !run.steps.duplicate);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);
  if (!run) return null;
  const end = run.steps.done?.at ?? run.steps.duplicate?.at ?? Math.max(now, run.startedAt);
  const ms = Math.max(0, end - run.startedAt);
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function PipelineCard({ run, connected }: { run: LiveRun | null; connected: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const ocrRef = useRef<HTMLDivElement>(null);
  const checksRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const channelRefs = {
    app: useRef<HTMLDivElement>(null),
    email: useRef<HTMLDivElement>(null),
    sms: useRef<HTMLDivElement>(null),
    voice: useRef<HTMLDivElement>(null),
  } satisfies Record<ChannelKey, RefObject<HTMLDivElement | null>>;
  const elapsed = useElapsed(run);

  const s = run?.steps ?? {};
  const read = s.read?.detail;
  const alertsCount = num(s.alerted?.detail, "alerts");
  const finished = Boolean(s.done || s.duplicate);

  const reportState: NodeState = !run ? "idle" : s.duplicate ? "warn" : "done";
  const ocrState: NodeState = s.read ? (read?.source === "failed" || read?.source === "fallback" ? "warn" : "done") : s.reading ? "active" : "idle";
  const checksState: NodeState = s.checked ? (num(s.checked.detail, "couldntCheck") > 0 ? "warn" : "done") : s.read ? "active" : "idle";
  const alertState: NodeState = s.alerted ? (alertsCount > 0 ? "alert" : "done") : s.checked ? "active" : "idle";

  const channelState = (key: ChannelKey): NodeState => {
    const c = run?.channels[key];
    if (c) return c.status === "sent" ? "done" : c.status === "failed" ? "error" : "muted";
    if (s.alerted && alertsCount > 0 && !finished) return "active";
    return "idle";
  };
  const channelSub = (key: ChannelKey): string => {
    const c = run?.channels[key];
    if (c) return c.status === "sent" ? (key === "app" ? "Alert in app" : "Sent") : c.status === "failed" ? "Failed" : key === "app" ? "Ready" : "Simulated";
    if (s.alerted && alertsCount > 0 && !finished) return "Sending…";
    if (finished && alertsCount > 0) return "Not chosen";
    return "—";
  };

  const ocrSub = !run
    ? "Waiting"
    : s.read
      ? read?.source === "ocr"
        ? `${(((s.read.at ?? 0) - (s.reading?.at ?? 0)) / 1000).toFixed(1)} s · $${Number(read.costUsd ?? 0).toFixed(4)}`
        : read?.source === "cache"
          ? "Already read · instant"
          : read?.source === "fallback"
            ? "OCR unavailable"
            : "Couldn't read"
      : s.reading
        ? "Reading…"
        : s.duplicate
          ? "Skipped"
          : "Waiting";

  const checksSub = s.checked
    ? `${num(s.checked.detail, "results")} result${num(s.checked.detail, "results") === 1 ? "" : "s"}${num(s.checked.detail, "couldntCheck") ? ` · ${num(s.checked.detail, "couldntCheck")} unclear` : ""}`
    : s.read
      ? "Checking…"
      : "Lab flag · range · rules";
  const alertSub = s.alerted ? (alertsCount > 0 ? `${alertsCount} alert${alertsCount > 1 ? "s" : ""}` : "No alert needed") : s.checked ? "Routing…" : "To the right GP";

  // Each beam sweeps once when its step is reached, then the path stays tinted.
  const beam = (reached: boolean, warn = false) => ({
    active: reached,
    sweepKey: run?.sourceMessageId,
    repeat: 0,
    duration: 0.8,
    ...(reached
      ? { gradientStartColor: warn ? "#e0a23f" : "#8ec4d4", gradientStopColor: warn ? "#b07a1e" : "#0f3b4b", pathColor: warn ? "#e0a23f" : "#2e869e", pathOpacity: 0.45 }
      : { gradientStartColor: "transparent", gradientStopColor: "transparent", pathColor: "#a2b1b8", pathOpacity: 0.35 }),
  });

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <SectionTitle icon={Route} title="Live pipeline" />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {run ? (
            <motion.span key={run.sourceMessageId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade()} className="font-mono">
              {run.sourceMessageId}
            </motion.span>
          ) : null}
          {elapsed ? (
            <span className={cn("rounded-full px-2.5 py-1 font-mono font-medium", finished ? "bg-success-soft text-success" : "bg-brand-soft text-primary")}>
              {finished ? (s.duplicate ? "Duplicate · " : "Done · ") : ""}
              {elapsed}
            </span>
          ) : (
            <span>{connected ? "Waiting for a report" : "Connecting…"}</span>
          )}
        </div>
      </CardHeader>
      {/* On narrow screens the pipeline scrolls sideways rather than squashing the nodes together. */}
      <CardContent className="overflow-x-auto">
        <div ref={container} className="relative grid min-w-[33rem] grid-cols-[repeat(4,minmax(0,1fr))_auto] items-center gap-4 px-2 py-6">
          <div className="flex justify-center">
            <Node nodeRef={reportRef} icon={FileText} label="Lab report" sub={!run ? "Waiting" : s.duplicate ? "Duplicate ignored" : run.steps.received?.detail?.origin === "upload" ? "Uploaded" : "From simulator"} state={reportState} />
          </div>
          <div className="flex justify-center">
            <Node nodeRef={ocrRef} icon={ScanText} label="OCR" sub={ocrSub} state={ocrState} />
          </div>
          <div className="flex justify-center">
            <Node nodeRef={checksRef} icon={ShieldCheck} label="Checks" sub={checksSub} state={checksState} />
          </div>
          <div className="flex justify-center">
            <Node nodeRef={alertRef} icon={BellRing} label="Alert" sub={alertSub} state={alertState} />
          </div>
          <div className="flex flex-col gap-3 pl-6">
            {CHANNELS.map((c) => (
              <Node key={c.key} nodeRef={channelRefs[c.key]} icon={c.icon} label={c.label} sub={channelSub(c.key)} state={channelState(c.key)} small />
            ))}
          </div>

          <AnimatedBeam containerRef={container} fromRef={reportRef} toRef={ocrRef} {...beam(Boolean(s.reading))} />
          <AnimatedBeam containerRef={container} fromRef={ocrRef} toRef={checksRef} {...beam(Boolean(s.read), ocrState === "warn")} />
          <AnimatedBeam containerRef={container} fromRef={checksRef} toRef={alertRef} {...beam(Boolean(s.checked))} />
          {CHANNELS.map((c, i) => {
            const state = channelState(c.key);
            return (
              <AnimatedBeam
                key={c.key}
                containerRef={container}
                fromRef={alertRef}
                toRef={channelRefs[c.key]}
                curvature={(1.5 - i) * 28}
                delay={stagger(i)}
                {...beam(Boolean(s.alerted && alertsCount > 0) && state !== "muted" && state !== "idle", state === "error")}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
