"use client";

// Follows the server's live event stream and keeps the state of the most
// recent pipeline run, so the console can animate each step as it happens.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useRef, useState } from "react";
import type { LiveEvent, PipelineStep } from "@/server/events";

export type ChannelKey = "app" | "email" | "sms" | "voice";
export type ChannelStatus = "sent" | "simulated" | "failed";

export interface LiveRun {
  sourceMessageId: string;
  reportId: string | null;
  startedAt: number;
  steps: Partial<Record<PipelineStep, { at: number; detail?: Record<string, unknown> }>>;
  channels: Partial<Record<ChannelKey, { status: ChannelStatus; recipient: string | null; detail: string | null }>>;
  alerts: { alertId: string; reasons: string[] }[];
}

type Action = { event: LiveEvent } | { reset: true };

function reducer(run: LiveRun | null, action: Action): LiveRun | null {
  if ("reset" in action) return null;
  const e = action.event;
  const at = new Date(e.at).getTime();

  if (e.type === "pipeline") {
    const current = run && run.sourceMessageId === e.sourceMessageId ? run : null;
    if (!current && e.step !== "received") return run;
    const base: LiveRun = current ?? { sourceMessageId: e.sourceMessageId, reportId: null, startedAt: at, steps: {}, channels: {}, alerts: [] };
    return { ...base, reportId: e.reportId ?? base.reportId, steps: { ...base.steps, [e.step]: { at, detail: e.detail } } };
  }
  if (!run) return run;
  if (e.type === "alert.created") return { ...run, alerts: [...run.alerts, { alertId: e.alertId, reasons: e.reasons }] };
  if (e.type === "notification" && (e.sourceMessageId === null || e.sourceMessageId === run.sourceMessageId)) {
    return { ...run, channels: { ...run.channels, [e.channel]: { status: e.status as ChannelStatus, recipient: e.recipient, detail: e.detail } } };
  }
  return run;
}

export function useLiveRun() {
  const queryClient = useQueryClient();
  const [run, dispatch] = useReducer(reducer, null);
  const [connected, setConnected] = useState(false);
  const refresh = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/dashboard/stream");
    const scheduleRefresh = () => {
      if (refresh.current) clearTimeout(refresh.current);
      refresh.current = setTimeout(() => queryClient.invalidateQueries(), 250);
    };

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as LiveEvent | { type: "hello" };
      if (event.type === "hello") return setConnected(true);
      if (event.type === "demo.reset") dispatch({ reset: true });
      else dispatch({ event });
      scheduleRefresh();
    };
    return () => {
      source.close();
      if (refresh.current) clearTimeout(refresh.current);
    };
  }, [queryClient]);

  return { run, connected };
}
