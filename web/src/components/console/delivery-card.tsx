"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Plane, Send } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { NumberTicker } from "@/components/ui/number-ticker";
import { api, DEMO_GP_ID, maskEmail, maskPhone, type ClinicianSettings, type DashboardFeed } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CHANNELS, SectionTitle } from "./bits";

type Toggle = "notifyEmail" | "notifySms" | "notifyVoice";
const CHANNEL_SETTING: Partial<Record<string, Toggle>> = { email: "notifyEmail", sms: "notifySms", voice: "notifyVoice" };

export function DeliveryCard({ feed }: { feed: DashboardFeed | undefined }) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings", DEMO_GP_ID], queryFn: () => api.settings(DEMO_GP_ID) });
  const update = useMutation({
    mutationFn: (patch: Parameters<typeof api.updateSettings>[1]) => api.updateSettings(DEMO_GP_ID, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["settings", DEMO_GP_ID] });
      const before = queryClient.getQueryData<ClinicianSettings>(["settings", DEMO_GP_ID]);
      if (before) queryClient.setQueryData(["settings", DEMO_GP_ID], { ...before, ...patch });
      return { before };
    },
    onError: (e: Error, _patch, ctx) => {
      if (ctx?.before) queryClient.setQueryData(["settings", DEMO_GP_ID], ctx.before);
      toast.error(e.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["settings", DEMO_GP_ID] }),
  });

  const s = settings.data;
  const live = feed?.liveMessages ?? false;
  const configured = { app: true, email: feed?.providers.email ?? false, sms: feed?.providers.twilio ?? false, voice: feed?.providers.twilio ?? false };

  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={Send} title="Delivery" />
      </CardHeader>
      <CardContent className="space-y-1">
        {CHANNELS.map((c) => {
          const key = CHANNEL_SETTING[c.key];
          const contact = c.key === "email" ? s?.email ?? null : c.key === "app" ? "BloodLine app" : s?.mobile ?? null;
          const shown = c.key === "email" ? maskEmail(contact) : c.key === "app" ? "Always on" : maskPhone(contact);
          const checked = key ? Boolean(s?.[key]) : true;
          const missing = c.key !== "app" && !contact;
          return (
            <div key={c.key} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
              <span className={cn("grid size-8 place-items-center rounded-lg ring-1 ring-inset", checked && !missing ? "bg-brand-soft text-accent-foreground ring-brand/25" : "bg-muted text-muted-foreground ring-border")}>
                <c.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-sm font-medium">{c.key === "voice" ? "Phone call" : c.label === "App" ? "In-app alert" : c.label}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  {missing ? `Set DEMO_GP_${c.key === "email" ? "EMAIL" : "MOBILE"} in .env.local` : shown}
                  {c.key !== "app" && !missing && checked ? (live && configured[c.key] ? " · live" : " · simulated") : ""}
                </div>
              </div>
              <Switch
                checked={checked && !missing}
                disabled={!key || missing || update.isPending}
                onCheckedChange={(on) => key && update.mutate({ [key]: on })}
                aria-label={`${c.label} alerts`}
              />
            </div>
          );
        })}
        <div className="mt-2 flex items-center gap-3 rounded-lg border-t px-2 pt-3">
          <span className={cn("grid size-8 place-items-center rounded-lg ring-1 ring-inset", s?.away ? "bg-review-soft text-review-foreground ring-review/40" : "bg-muted text-muted-foreground ring-border")}>
            <Plane className="size-4" />
          </span>
          <div className="flex-1 leading-tight">
            <div className="text-sm font-medium">Away</div>
            <div className="text-[11px] text-muted-foreground">{s?.away ? `Alerts go to ${s.colleagues.find((x) => x.id === s.coveringClinicianId)?.name ?? "a colleague"}` : "Hand alerts to a colleague"}</div>
          </div>
          <Switch
            checked={Boolean(s?.away)}
            disabled={!s || update.isPending}
            onCheckedChange={(on) => update.mutate({ away: on, coveringClinicianId: on ? (s?.coveringClinicianId ?? s?.colleagues[0]?.id ?? null) : s?.coveringClinicianId ?? null })}
            aria-label="Away"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, decimals = 0, prefix, tone }: { label: string; value: number; decimals?: number; prefix?: string; tone?: "review" | "brand" }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3 ring-1 ring-border/60 ring-inset">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight", tone === "review" && value > 0 && "text-review-foreground", tone === "brand" && "text-accent-foreground")}>
        {prefix}
        <NumberTicker value={value} decimalPlaces={decimals} />
      </div>
    </div>
  );
}

export function StatsCard({ feed }: { feed: DashboardFeed | undefined }) {
  const st = feed?.stats;
  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={BellRing} title="This session" />
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2.5">
        <Stat label="Reports" value={st?.reports ?? 0} />
        <Stat label="Alerts" value={st?.alerts ?? 0} tone="review" />
        <Stat label="Not yet seen" value={st?.unseen ?? 0} tone="review" />
        <Stat label="AI cost" value={st?.aiCostUsd ?? 0} decimals={4} prefix="$" tone="brand" />
      </CardContent>
    </Card>
  );
}
