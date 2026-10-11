"use client";

import { BellRing, Check, FileText, Route, ScanText, ShieldCheck, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ChannelKey, LiveRun } from "@/hooks/use-live-run";
import { cn } from "@/lib/utils";
import { CHANNELS, SectionTitle } from "./bits";

type NodeState = "idle" | "active" | "done" | "warn" | "alert" | "muted" | "error";

const NODE_STYLES: Record<NodeState, string> = {
  idle: "bg-card text-muted-foreground ring-border",
  active: "bg-brand-soft text-brand ring-brand",
  done: "bg-brand text-brand-foreground ring-brand",
  warn: "bg-review-soft text-review-foreground ring-review",
  alert: "bg-review text-white ring-review",
  muted: "bg-muted text-muted-foreground ring-border",
  error: "bg-destructive/10 text-destructive ring-destructive",
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
      <motion.div
        ref={nodeRef}
        layout
        animate={{ scale: state === "active" ? [1, 1.06, 1] : 1 }}
        transition={state === "active" ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 260, damping: 18 }}
        className={cn(
          "relative grid place-items-center shadow-sm ring-2 transition-colors duration-500",
          small ? "size-10 rounded-xl" : "size-16 rounded-2xl",
          NODE_STYLES[state],
        )}
      >
        <Icon className={small ? "size-4.5" : "size-6"} />
        {state === "active" ? (
          <motion.span
            className={cn("absolute inset-0 ring-2 ring-brand", small ? "rounded-xl" : "rounded-2xl")}
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 1.45 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          />
        ) : null}
        <AnimatePresence>
          {state === "done" && !small ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -right-1.5 -bottom-1.5 grid size-5 place-items-center rounded-full bg-success text-white ring-2 ring-card"
            >
              <Check className="size-3" strokeWidth={3} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.div>
      <div className={cn("leading-tight", small ? "min-w-20" : "")}>
        <div className="text-xs font-semibold">{label}</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={sub}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            className="text-[11px] whitespace-nowrap text-muted-foreground"
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
  const aiRef = useRef<HTMLDivElement>(null);
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
  const aiState: NodeState = s.read ? (read?.source === "failed" || read?.source === "fallback" ? "warn" : "done") : s.reading ? "active" : "idle";
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

  const aiSub = !run
    ? "Waiting"
    : s.read
      ? read?.source === "ai"
        ? `${(((s.read.at ?? 0) - (s.reading?.at ?? 0)) / 1000).toFixed(1)} s · $${Number(read.costUsd ?? 0).toFixed(4)}`
        : read?.source === "cache"
          ? "Already read · instant"
          : read?.source === "fallback"
            ? "AI unavailable"
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

  const beam = (reached: boolean, warn = false) =>
    reached
      ? { gradientStartColor: warn ? "#f5a524" : "#14b8a6", gradientStopColor: warn ? "#d97706" : "#0f2a4a", pathOpacity: 0.35 }
      : { gradientStartColor: "transparent", gradientStopColor: "transparent", pathOpacity: 0.18 };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <SectionTitle icon={Route} title="Live pipeline" />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {run ? (
            <motion.span key={run.sourceMessageId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-mono">
              {run.sourceMessageId}
            </motion.span>
          ) : null}
          {elapsed ? (
            <span className={cn("rounded-full px-2 py-0.5 font-mono font-medium ring-1 ring-inset", finished ? "bg-success-soft text-[oklch(0.42_0.11_155)] ring-success/25" : "bg-brand-soft text-accent-foreground ring-brand/25")}>
              {finished ? (s.duplicate ? "Duplicate · " : "Done · ") : ""}
              {elapsed}
            </span>
          ) : (
            <span>{connected ? "Waiting for a report" : "Connecting…"}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div ref={container} className="relative grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-4 px-2 py-6">
          <div className="flex justify-center">
            <Node nodeRef={reportRef} icon={FileText} label="Lab report" sub={!run ? "Waiting" : s.duplicate ? "Duplicate ignored" : run.steps.received?.detail?.origin === "upload" ? "Uploaded" : "From simulator"} state={reportState} />
          </div>
          <div className="flex justify-center">
            <Node nodeRef={aiRef} icon={ScanText} label="AI reading" sub={aiSub} state={aiState} />
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

          <AnimatedBeam containerRef={container} fromRef={reportRef} toRef={aiRef} duration={1.6} {...beam(Boolean(s.reading))} />
          <AnimatedBeam containerRef={container} fromRef={aiRef} toRef={checksRef} duration={1.6} {...beam(Boolean(s.read), aiState === "warn")} />
          <AnimatedBeam containerRef={container} fromRef={checksRef} toRef={alertRef} duration={1.6} {...beam(Boolean(s.checked))} />
          {CHANNELS.map((c, i) => {
            const state = channelState(c.key);
            return (
              <AnimatedBeam
                key={c.key}
                containerRef={container}
                fromRef={alertRef}
                toRef={channelRefs[c.key]}
                curvature={(1.5 - i) * 28}
                duration={1.4}
                delay={i * 0.12}
                {...beam(Boolean(s.alerted && alertsCount > 0) && state !== "muted" && state !== "idle", state === "error")}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
