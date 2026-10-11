"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useLiveRun } from "@/hooks/use-live-run";
import { api } from "@/lib/api";
import { rise, stagger } from "@/lib/motion";
import { ActivityCard } from "./activity";
import { OcrReadingCard } from "./ocr-reading";
import { DeliveryCard, StatsCard } from "./delivery-card";
import { ConsoleHeader } from "./header";
import { LogsCard } from "./logs";
import { PipelineCard } from "./pipeline";
import { UploadCard } from "./upload-card";

export function Console() {
  const { run, connected } = useLiveRun();
  const feed = useQuery({ queryKey: ["feed"], queryFn: api.feed, refetchInterval: 15_000 });

  return (
    <div className="console-backdrop min-h-screen">
      <ConsoleHeader feed={feed.data} connected={connected} />
      <main className="mx-auto grid max-w-[1680px] grid-cols-1 gap-5 px-4 py-6 sm:px-6 xl:grid-cols-12">
        <motion.div {...rise()} className="xl:col-span-3">
          <UploadCard />
        </motion.div>
        <div className="flex flex-col gap-5 xl:col-span-6">
          <motion.div {...rise(stagger(1))}>
            <PipelineCard run={run} connected={connected} />
          </motion.div>
          <motion.div {...rise(stagger(1))}>
            <OcrReadingCard run={run} latestReportId={feed.data?.reports[0]?.id ?? null} />
          </motion.div>
        </div>
        <div className="flex flex-col gap-5 xl:col-span-3">
          <motion.div {...rise(stagger(2))}>
            <DeliveryCard feed={feed.data} />
          </motion.div>
          <motion.div {...rise(stagger(2))}>
            <StatsCard feed={feed.data} />
          </motion.div>
        </div>
        <motion.div {...rise(stagger(3))} className="xl:col-span-8">
          <LogsCard feed={feed.data} />
        </motion.div>
        <motion.div {...rise(stagger(3))} className="xl:col-span-4">
          <ActivityCard feed={feed.data} />
        </motion.div>
      </main>
      <footer className="mx-auto max-w-[1680px] px-4 pb-8 text-xs text-muted-foreground sm:px-6">
        BloodLine is a safety net, not a replacement for reviewing results as usual. It doesn&apos;t diagnose or decide urgency. Labs still phone through
        critical results. All data shown is synthetic.
      </footer>
    </div>
  );
}
