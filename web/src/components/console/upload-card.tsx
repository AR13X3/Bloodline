"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, FileText, FileUp, Loader2, Send, X, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, DEMO_GP_ID, type SendResult } from "@/lib/api";
import { fade, rise, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { SectionTitle } from "./bits";

function describeResult(r: SendResult): { title: string; description: string } {
  if (r.status === "duplicate") return { title: "Duplicate ignored", description: `${r.sourceMessageId} was already received. No alert, no message.` };
  const alerts = r.alerts.length;
  const channels = r.notifications.filter((n) => n.channel !== "app").map((n) => `${n.channel === "voice" ? "call" : n.channel} ${n.status}`);
  return {
    title: alerts ? `${alerts} alert${alerts > 1 ? "s" : ""} sent to the GP` : "Checked: no alert needed",
    description: alerts ? (channels.length ? channels.join(" · ") : "In-app alert ready") : `${r.results.length} result${r.results.length === 1 ? "" : "s"} checked and logged.`,
  };
}

export function UploadCard() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [patientId, setPatientId] = useState("pt_nguyen");
  const [gpId, setGpId] = useState(DEMO_GP_ID);
  const [last, setLast] = useState<{ scenario: string; sourceMessageId: string } | null>(null);

  const patients = useQuery({ queryKey: ["patients"], queryFn: api.patients });
  const clinicians = useQuery({ queryKey: ["clinicians"], queryFn: api.clinicians });
  const scenarios = useQuery({ queryKey: ["scenarios"], queryFn: api.scenarios, staleTime: Infinity });

  const onDone = (r: SendResult) => {
    queryClient.invalidateQueries();
    const { title, description } = describeResult(r);
    if (r.patientCheck?.matches === false) {
      toast.warning("Name on report doesn't match the selected patient", {
        description: `Report says "${r.patientCheck.nameOnReport}", filed against ${r.patientCheck.filedAs}. Alerts were still sent.`,
      });
    }
    (r.status === "duplicate" ? toast.info : toast.success)(title, { description });
  };

  const upload = useMutation({
    mutationFn: () => api.upload(file!, patientId, gpId),
    onSuccess: (r) => {
      setFile(null);
      onDone(r);
    },
    onError: (e: Error) => toast.error("Upload failed", { description: e.message }),
  });

  const sendScenario = useMutation({
    mutationFn: ({ scenario, sourceMessageId }: { scenario: string; sourceMessageId?: string }) => api.sendScenario(scenario, sourceMessageId),
    onSuccess: (r, vars) => {
      setLast({ scenario: vars.scenario, sourceMessageId: r.sourceMessageId });
      onDone(r);
    },
    onError: (e: Error) => toast.error("Couldn't send", { description: e.message }),
  });

  const busy = upload.isPending || sendScenario.isPending;

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return toast.error("Please choose a PDF lab report");
    setFile(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  return (
    <Card className="relative h-full overflow-hidden">
      <CardHeader>
        <SectionTitle icon={FileUp} title="Send a lab report" />
      </CardHeader>
      <CardContent className="space-y-4">
        <motion.label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          animate={{ scale: dragging ? 1.01 : 1 }}
          transition={fade()}
          className={cn(
            "relative flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed p-5 text-center transition-colors",
            dragging ? "border-brand bg-brand-soft" : file ? "border-brand/50 bg-brand-soft/40" : "border-border bg-muted/40 hover:border-brand/40 hover:bg-brand-soft/30",
          )}
        >
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          {dragging ? <BorderBeam size={120} duration={4} colorFrom="oklch(0.66 0.13 185)" colorTo="oklch(0.3 0.07 258)" /> : null}
          <AnimatePresence mode="wait" initial={false}>
            {file ? (
              <motion.div key="file" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={fade(0, 0.15)} className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-card text-primary">
                  <FileText className="size-5" strokeWidth={1.75} />
                </span>
                <div className="text-left">
                  <div className="max-w-56 truncate text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · ready to send</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove file"
                  onClick={(e) => {
                    e.preventDefault();
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  <X />
                </Button>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={fade(0, 0.15)} className="flex flex-col items-center gap-2">
                <motion.span
                  animate={{ y: dragging ? -3 : 0 }}
                  transition={fade()}
                  className="grid size-12 place-items-center rounded-full bg-card text-primary"
                >
                  <FileUp className="size-5" strokeWidth={1.75} />
                </motion.span>
                <div className="text-sm font-medium">Drop a PDF lab report here</div>
                <div className="text-xs text-muted-foreground">or click to choose · synthetic or de-identified reports only</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.label>

        {/* Side by side only when the card is full width: in the narrow column the names get cut off. */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Patient</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.data?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} <span className="text-muted-foreground">· {p.practiceRef}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Requesting GP</Label>
            <Select value={gpId} onValueChange={setGpId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose GP" />
              </SelectTrigger>
              <SelectContent>
                {clinicians.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button size="lg" className="h-11 w-full text-sm" disabled={!file || busy} onClick={() => upload.mutate()}>
          {upload.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          {upload.isPending ? "Reading and checking…" : "Send to BloodLine"}
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
          <span>No report handy?</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="link" size="xs" className="h-auto px-0">
                <Download /> Download a sample report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Synthetic sample reports</DropdownMenuLabel>
              {scenarios.data?.map((s) => (
                <DropdownMenuItem key={s.id} asChild>
                  <a href={`/api/simulator/sample/${s.id}`} download>
                    <FileText /> {s.title}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="border-t pt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Zap className="size-4" strokeWidth={1.75} /> Quick scenarios
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={!last || busy}
                  onClick={() => last && sendScenario.mutate({ scenario: last.scenario, sourceMessageId: last.sourceMessageId })}
                >
                  <Copy /> Send duplicate
                </Button>
              </TooltipTrigger>
              <TooltipContent>Re-sends the last scenario with the same message ID</TooltipContent>
            </Tooltip>
          </div>
          <div className="space-y-2">
            {scenarios.data?.map((s, i) => (
              <motion.div
                key={s.id}
                {...rise(stagger(i))}
                className="group flex items-center gap-3 rounded-2xl bg-secondary/60 px-3.5 py-2.5 transition-colors hover:bg-secondary"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.expected}</div>
                </div>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Send ${s.title}`}
                  disabled={busy}
                  onClick={() => sendScenario.mutate({ scenario: s.id })}
                  className="shrink-0 border-transparent bg-card group-hover:bg-primary group-hover:text-primary-foreground"
                >
                  {sendScenario.isPending && sendScenario.variables?.scenario === s.id && !sendScenario.variables?.sourceMessageId ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Send />
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
