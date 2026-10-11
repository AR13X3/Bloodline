"use client";

import { BellRing, CircleHelp, Flag, ListChecks, Mail, MessageSquareText, MoveVertical, PhoneCall, Smartphone, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// The BloodLine heart: nine flat bars on a 4-unit pitch; the seventh is the green accent.
const LOGO_BARS: [x: number, y: number, h: number][] = [
  [0, 10.5, 10.5], [4, 7, 18.5], [8, 4, 27], [12, 5.5, 30], [16, 9, 29.5],
  [20, 5.5, 30], [24, 4, 27], [28, 7, 18.5], [32, 10.5, 10.5],
];

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 4 35 34.5" className={cn("size-8", className)} aria-hidden="true">
      {LOGO_BARS.map(([x, y, h], i) => (
        <rect key={x} x={x} y={y} width={3} height={h} className={i === 6 ? "fill-[#1e9e5e] dark:fill-[#56db8b]" : "fill-primary"} />
      ))}
    </svg>
  );
}

const REASONS: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  lab_flag: { label: "Lab flag", icon: Flag, className: "bg-secondary text-primary" },
  outside_range: { label: "Outside range", icon: MoveVertical, className: "bg-review-soft text-review-foreground" },
  gp_rule: { label: "GP rule", icon: ListChecks, className: "bg-brand-soft text-primary" },
  couldnt_check: { label: "Couldn't check", icon: CircleHelp, className: "bg-review-soft text-review-foreground" },
};

export function ReasonChip({ reason, className }: { reason: string; className?: string }) {
  const r = REASONS[reason] ?? { label: reason, icon: BellRing, className: "bg-muted text-muted-foreground" };
  const Icon = r.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap", r.className, className)}>
      <Icon className="size-3" strokeWidth={1.75} />
      {r.label}
    </span>
  );
}

export const CHANNELS: { key: "app" | "email" | "sms" | "voice"; label: string; icon: LucideIcon }[] = [
  { key: "app", label: "App", icon: Smartphone },
  { key: "email", label: "Email", icon: Mail },
  { key: "sms", label: "SMS", icon: MessageSquareText },
  { key: "voice", label: "Call", icon: PhoneCall },
];

export function ChannelGlyph({ channel, className }: { channel: string; className?: string }) {
  switch (channel) {
    case "app":
      return <Smartphone className={className} />;
    case "email":
      return <Mail className={className} />;
    case "sms":
      return <MessageSquareText className={className} />;
    case "voice":
      return <PhoneCall className={className} />;
    default:
      return <BellRing className={className} />;
  }
}

export function channelLabel(channel: string): string {
  return CHANNELS.find((c) => c.key === channel)?.label ?? channel;
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sent: "bg-success-soft text-success",
    simulated: "bg-muted text-muted-foreground",
    failed: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize", styles[status] ?? styles.simulated)}>
      {status}
    </span>
  );
}

export function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-full bg-secondary text-primary">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <div className="text-lg font-medium tracking-tight">{title}</div>
    </div>
  );
}
