"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, RotateCcw, Radio } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, type DashboardFeed } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Logo } from "./bits";

function ProviderChip({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap [&_svg]:text-success",
            ok ? "bg-card text-primary" : "bg-secondary text-muted-foreground [&_svg]:text-muted-foreground",
          )}
        >
          {ok ? <CheckCircle2 className="size-3.5" /> : <CircleDashed className="size-3.5" />}
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

export function ConsoleHeader({ feed, connected }: { feed: DashboardFeed | undefined; connected: boolean }) {
  const queryClient = useQueryClient();
  const [confirmLive, setConfirmLive] = useState(false);
  const live = feed?.liveMessages ?? false;

  const setLive = useMutation({
    mutationFn: api.setLiveMessages,
    onSuccess: (r) => {
      queryClient.invalidateQueries();
      toast(r.liveMessages ? "Live messages on" : "Live messages off", {
        description: r.liveMessages ? "Real email, SMS and calls will go to the demo GP." : "Email, SMS and calls will be simulated.",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: api.reset,
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Demo reset", { description: "Synthetic data restored. Saved OCR readings kept." });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1680px] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <Logo className="size-9" />
          <div className="text-lg font-semibold tracking-tight">BloodLine</div>
        </div>
        <span className="ml-2 hidden rounded-full bg-review-soft px-3 py-1.5 text-[11px] font-medium whitespace-nowrap text-review-foreground xl:inline">
          Synthetic data · not for clinical use
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className="mr-1 hidden items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground md:inline-flex">
            <span className="relative flex size-2">
              {connected ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" /> : null}
              <span className={cn("relative inline-flex size-2 rounded-full", connected ? "bg-success" : "bg-muted-foreground/40")} />
            </span>
            {connected ? "Live" : "Reconnecting"}
          </span>
          <div className="hidden items-center gap-2 lg:flex">
            <ProviderChip ok={feed?.providers.ocr ?? false} label="OCR" hint="OpenRouter" />
            <ProviderChip ok={feed?.providers.email ?? false} label="Email" hint="Resend" />
            <ProviderChip ok={feed?.providers.twilio ?? false} label="SMS & calls" hint="Twilio" />
          </div>

          <div
            className={cn(
              "ml-2 flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pl-3.5 pr-2 transition-colors",
              live ? "bg-review-soft" : "bg-card",
            )}
          >
            <Radio className={cn("size-4", live ? "text-review-foreground" : "text-muted-foreground")} />
            <div className="leading-tight whitespace-nowrap">
              <div className="text-xs font-semibold">Live messages</div>
              <div className="hidden text-[11px] text-muted-foreground sm:block">{live ? "Real email, SMS & calls" : "Simulated"}</div>
            </div>
            <Switch
              checked={live}
              disabled={setLive.isPending}
              onCheckedChange={(on) => (on ? setConfirmLive(true) : setLive.mutate(false))}
              aria-label="Live messages"
            />
          </div>

          <AlertDialog open={confirmLive} onOpenChange={setConfirmLive}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send real messages?</AlertDialogTitle>
                <AlertDialogDescription>
                  Alerts will send real email, SMS and phone calls to the demo GP&apos;s contact details. Messages never include patient
                  details. A Twilio trial account can only reach verified numbers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep simulated</AlertDialogCancel>
                <AlertDialogAction onClick={() => setLive.mutate(true)}>Turn on live messages</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={reset.isPending} aria-label="Reset demo">
                <RotateCcw /> <span className="hidden sm:inline">Reset demo</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset the demo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Clears reports, alerts, messages and rule changes, then restores the synthetic patients. Saved OCR readings and the
                  live-messages setting are kept.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => reset.mutate()}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </header>
  );
}
