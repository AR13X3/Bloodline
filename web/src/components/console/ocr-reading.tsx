"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileSearch, ScanText, UserCheck, UserX } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LiveRun } from "@/hooks/use-live-run";
import { api, type ReportView } from "@/lib/api";
import { fade, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ReasonChip, SectionTitle } from "./bits";

function outcomes(row: ReportView["results"][number]): string[] {
  const reasons: string[] = [];
  if (row.checks.some((c) => c.kind === "lab_flag" && c.outcome === "triggered")) reasons.push("lab_flag");
  if (row.checks.some((c) => c.kind === "range" && c.outcome === "triggered")) reasons.push("outside_range");
  if (row.checks.some((c) => c.kind === "rule" && c.outcome === "triggered")) reasons.push("gp_rule");
  if (row.checkStatus === "couldnt_check") reasons.push("couldnt_check");
  return reasons;
}

function ExtractionBadge({ report }: { report: ReportView }) {
  const { source, costUsd, note } = report.extraction;
  const text =
    source === "ocr"
      ? `Read by OCR · $${(costUsd ?? 0).toFixed(4)}`
      : source === "cache"
        ? "Already read · from cache"
        : source === "fallback"
          ? "OCR unavailable · simulator's values"
          : report.status === "couldnt_read"
            ? "Couldn't read this report"
            : "Reading…";
  const warn = source === "fallback" || report.status === "couldnt_read";
  return (
    <span
      title={note ?? undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset",
        warn ? "bg-review-soft text-review-foreground ring-review/40" : "bg-brand-soft text-accent-foreground ring-brand/25",
      )}
    >
      <ScanText className="size-3.5" />
      {text}
    </span>
  );
}

export function OcrReadingCard({ run, latestReportId }: { run: LiveRun | null; latestReportId: string | null }) {
  const reportId = run?.reportId ?? latestReportId;
  const reading = Boolean(run?.steps.reading && !run.steps.read);
  const report = useQuery({
    queryKey: ["report", reportId, Boolean(run?.steps.checked)],
    queryFn: () => api.report(reportId!),
    enabled: Boolean(reportId),
  });
  const data = report.data && report.data.id === reportId ? report.data : undefined;
  const ready = Boolean(data && data.status !== "received" && data.status !== "read");
  const reduceMotion = useReducedMotion();

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <SectionTitle icon={FileSearch} title="OCR reading" />
        {data ? <ExtractionBadge report={data} /> : null}
      </CardHeader>
      <CardContent className="@container">
        {!reportId ? (
          <div className="grid h-80 place-items-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground">
            Send a report to see BloodLine read it here.
          </div>
        ) : (
          <div className="grid gap-5 @min-[45rem]:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
            <div className="relative h-64 overflow-hidden rounded-xl bg-muted ring-1 ring-border @min-[45rem]:h-[440px]">
              <iframe key={reportId} title="Lab report" src={`/api/reports/${reportId}/file#toolbar=0&navpanes=0&view=FitH`} className="size-full" />
              <AnimatePresence>
                {reading ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade()} className="pointer-events-none absolute inset-0 bg-brand/5">
                    {/* A soft scan line, moved with a transform rather than `top`. */}
                    {reduceMotion ? null : (
                      <motion.div className="absolute inset-0" initial={{ y: "-15%" }} animate={{ y: ["-15%", "100%"] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
                        <div className="h-24 bg-gradient-to-b from-transparent via-brand/15 to-transparent" />
                      </motion.div>
                    )}
                    <div className="absolute inset-x-0 bottom-4 flex justify-center">
                      <span className="inline-flex items-center gap-2 rounded-full bg-card/95 px-3 py-1.5 text-xs font-medium shadow-md ring-1 ring-brand/30">
                        <ScanText className="size-3.5 text-brand" /> Reading the report…
                      </span>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <AnimatePresence mode="wait">
                {data?.patientCheck.matches === false ? (
                  <motion.div key="mismatch" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={fade()} className="flex items-start gap-2.5 rounded-xl bg-review-soft p-3 text-sm text-review-foreground ring-1 ring-review/40">
                    <UserX className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <div className="font-semibold">Name on report doesn&apos;t match</div>
                      <div className="text-xs">
                        Report says &ldquo;{data.patientCheck.nameOnReport}&rdquo;, filed against {data.patient.name}. BloodLine never re-routes by name.
                      </div>
                    </div>
                  </motion.div>
                ) : data?.patientCheck.matches ? (
                  <motion.div key="match" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={fade()} className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-xs text-[oklch(0.42_0.11_155)] ring-1 ring-success/25">
                    <UserCheck className="size-4" /> Name on report matches <span className="font-semibold">{data.patient.name}</span>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="overflow-x-auto rounded-xl ring-1 ring-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Test</th>
                      <th className="px-3 py-2 font-medium">Result</th>
                      <th className="px-3 py-2 font-medium">Range</th>
                      <th className="px-3 py-2 font-medium">Flag</th>
                      <th className="px-3 py-2 font-medium">BloodLine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!ready
                      ? Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i} className="border-t">
                            {Array.from({ length: 5 }).map((__, j) => (
                              <td key={j} className="px-3 py-3">
                                <Skeleton className="h-4 w-full" />
                              </td>
                            ))}
                          </tr>
                        ))
                      : data!.results.map((row, i) => {
                          const reasons = outcomes(row);
                          return (
                            // Rows fade in with a light tint that fades out shortly after.
                            <motion.tr
                              key={`${reportId}-${row.id}`}
                              initial={{ opacity: 0, backgroundColor: "oklch(0.955 0.035 185 / 0.6)" }}
                              animate={{ opacity: 1, backgroundColor: "oklch(0.955 0.035 185 / 0)" }}
                              transition={{ ...fade(stagger(i)), backgroundColor: fade(stagger(i) + 0.8, 0.25) }}
                              className="border-t align-top"
                            >
                              <td className="px-3 py-2.5 font-medium">{row.testName}</td>
                              <td className={cn("px-3 py-2.5 font-mono whitespace-nowrap tabular-nums", reasons.length && "font-semibold")}>
                                {row.value} <span className="font-sans text-xs font-normal text-muted-foreground">{row.unit}</span>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap tabular-nums text-muted-foreground">{row.range ?? "—"}</td>
                              <td className="px-3 py-2.5">{row.labFlag ? <span className="font-mono font-semibold text-destructive">{row.labFlag}</span> : <span className="text-muted-foreground">—</span>}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex flex-col items-start gap-1">
                                  {reasons.length ? (
                                    reasons.map((r) => <ReasonChip key={r} reason={r} />)
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[oklch(0.42_0.11_155)]">
                                      <CheckCircle2 className="size-3.5" /> Clear
                                    </span>
                                  )}
                                </div>
                                {row.couldntCheckLabel || row.ruleLimitationLabel ? (
                                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <AlertTriangle className="size-3" /> {row.couldntCheckLabel ?? row.ruleLimitationLabel}
                                  </div>
                                ) : null}
                              </td>
                            </motion.tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>

              {ready && data!.results.some((r) => r.labComment) ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(stagger(3))} className="rounded-2xl bg-brand-soft/70 px-4 py-3 text-xs">
                  <span className="font-semibold">Lab comment: </span>
                  {data!.results.find((r) => r.labComment)?.labComment}
                </motion.div>
              ) : null}
              {data ? (
                <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>Patient: <span className="font-medium text-foreground">{data.patient.name}</span></span>
                  <span>Requesting GP: <span className="font-medium text-foreground">{data.requestingGp.name}</span></span>
                  <span>Alerts: <span className="font-medium text-foreground">{data.alerts}</span></span>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
