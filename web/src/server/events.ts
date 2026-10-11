// In-process event stream for the live dashboard (sent to browsers as
// Server-Sent Events). One server process, so a simple emitter is enough.
import { EventEmitter } from "node:events";

export type PipelineStep = "received" | "duplicate" | "reading" | "read" | "checked" | "alerted" | "notified" | "done" | "failed";

export type LiveEvent =
  | { type: "pipeline"; step: PipelineStep; sourceMessageId: string; reportId: string | null; detail?: Record<string, unknown>; at: string }
  | { type: "alert.created"; alertId: string; recipientId: string; reasons: string[]; at: string }
  | { type: "alert.seen"; alertId: string; at: string }
  | { type: "notification"; alertId: string; channel: string; status: string; recipient: string | null; detail: string | null; at: string }
  | { type: "rules.changed"; patientId: string; at: string }
  | { type: "settings.changed"; at: string }
  | { type: "demo.reset"; at: string };

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

const globalForBus = globalThis as unknown as { __bloodlineBus?: EventEmitter };
const bus = (globalForBus.__bloodlineBus ??= new EventEmitter().setMaxListeners(200));

export function emit(event: DistributiveOmit<LiveEvent, "at">): void {
  bus.emit("event", { ...event, at: new Date().toISOString() } as LiveEvent);
}

export function subscribe(listener: (event: LiveEvent) => void): () => void {
  bus.on("event", listener);
  return () => bus.off("event", listener);
}
