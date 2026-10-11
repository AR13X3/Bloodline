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
            <div key={c.key} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-secondary/60">
              <span className={cn("grid size-10 place-items-center rounded-full", checked && !missing ? "bg-brand-soft text-primary" : "bg-secondary text-muted-foreground")}>
                <c.icon className="size-[18px]" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-sm font-medium">{c.key === "voice" ? "Phone call" : c.label === "App" ? "In-app alert" : c.label}</div>
                <div className="truncate text-xs text-muted-foreground">
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
        <div className="mt-2 flex items-center gap-3 border-t px-2 pt-3">
          <span className={cn("grid size-10 place-items-center rounded-full", s?.away ? "bg-review-soft text-review-foreground" : "bg-secondary text-muted-foreground")}>
            <Plane className="size-[18px]" strokeWidth={1.75} />
          </span>
          <div className="flex-1 leading-tight">
            <div className="text-sm font-medium">Away</div>
            <div className="text-xs text-muted-foreground">{s?.away ? `Alerts go to ${s.colleagues.find((x) => x.id === s.coveringClinicianId)?.name ?? "a colleague"}` : "Hand alerts to a colleague"}</div>
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

/** A summary tile: label on top, a large light number below. A dark tile marks what needs attention. */
function Stat({ label, value, decimals = 0, prefix, dark }: { label: string; value: number; decimals?: number; prefix?: string; dark?: boolean }) {
  return (
    <div className={cn("@container flex min-h-28 flex-col justify-between rounded-[1.25rem] p-4 transition-colors duration-200", dark ? "bg-primary text-primary-foreground" : "bg-secondary text-primary")}>
      <div className={cn("text-sm", dark ? "text-primary-foreground/80" : "text-muted-foreground")}>{label}</div>
      {/* Sized to the tile, so "$0.0012" fits the narrow column as well as a single digit. */}
      <div className="text-[clamp(1.25rem,24cqi,2.25rem)] leading-tight font-light tabular-nums tracking-tight">
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
      <CardContent className="grid grid-cols-2 gap-3">
        <Stat label="Reports" value={st?.reports ?? 0} />
        <Stat label="Alerts" value={st?.alerts ?? 0} />
        <Stat label="Not yet seen" value={st?.unseen ?? 0} dark={(st?.unseen ?? 0) > 0} />
        <Stat label="OCR cost" value={st?.ocrCostUsd ?? 0} decimals={4} prefix="$" />
      </CardContent>
    </Card>
  );
}
