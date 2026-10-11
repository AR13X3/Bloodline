"use client";

import { Activity, BellRing, Eye } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { timeAgo, type DashboardFeed } from "@/lib/api";
import { rise } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ChannelGlyph, ReasonChip, SectionTitle, StatusPill, channelLabel } from "./bits";

type Item =
  | { kind: "alert"; id: string; at: string; alert: DashboardFeed["alerts"][number] }
  | { kind: "message"; id: string; at: string; message: DashboardFeed["notifications"][number] };

export function ActivityCard({ feed }: { feed: DashboardFeed | undefined }) {
  // Read the clock only after mounting, so nothing time-dependent is prerendered.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const items: Item[] = [
    ...(feed?.alerts ?? []).map((a): Item => ({ kind: "alert", id: `a-${a.id}`, at: a.createdAt, alert: a })),
    ...(feed?.notifications ?? []).map((m): Item => ({ kind: "message", id: `m-${m.id}`, at: m.createdAt, message: m })),
  ]
    .sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : x.kind === "message" ? -1 : 1))
    .slice(0, 24);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <SectionTitle icon={Activity} title="Live activity" />
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        {items.length === 0 ? (
          <div className="grid h-60 place-items-center rounded-2xl bg-secondary/60 text-sm text-muted-foreground">Nothing yet</div>
        ) : (
          <ScrollArea className="h-[560px] pr-3">
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  // New items fade in. No layout or exit animation: this list re-renders on every poll.
                  <motion.li
                    key={item.id}
                    {...rise()}
                    className={cn("rounded-2xl p-3.5", item.kind === "alert" ? "bg-review-soft/70" : "bg-secondary/60")}
                  >
                    {item.kind === "alert" ? <AlertRow item={item.alert} now={now} /> : <MessageRow item={item.message} now={now} />}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function AlertRow({ item, now }: { item: DashboardFeed["alerts"][number]; now: number | null }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-review-foreground">
        <BellRing className="size-[18px]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-medium">
            {item.patient.name} · {item.result.testName} <span className="font-mono">{item.result.value}</span>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">{now ? timeAgo(item.createdAt, now) : ""}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {item.reasons.map((r) => (
            <ReasonChip key={r} reason={r} />
          ))}
          <span className="text-[11px] text-muted-foreground">
            → {item.recipient.name}
            {item.handedOverFrom ? ` (cover for ${item.handedOverFrom.name})` : ""}
          </span>
          {item.seenAt ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-success">
              <Eye className="size-3" /> Seen
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MessageRow({ item, now }: { item: DashboardFeed["notifications"][number]; now: number | null }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-primary">
        <ChannelGlyph channel={item.channel} className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{item.channel === "app" ? "In-app alert" : channelLabel(item.channel)}</span>
          <StatusPill status={item.status} />
          {item.repeat ? <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-primary">Repeat {item.repeat}</span> : null}
        </div>
        <div className="truncate text-[11px] text-muted-foreground" title={item.detail ?? undefined}>
          {item.gpName} · {item.recipient ?? "—"}
          {item.detail ? ` · ${item.detail}` : ""}
        </div>
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground">{now ? timeAgo(item.createdAt, now) : ""}</span>
    </div>
  );
}
