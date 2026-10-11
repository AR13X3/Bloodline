"use client";

import { BellRing, CircleHelp, Flag, ListChecks, Mail, MessageSquareText, MoveVertical, PhoneCall, Smartphone, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id="bl-drop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.66 0.13 185)" />
          <stop offset="100%" stopColor="oklch(0.3 0.07 258)" />
        </linearGradient>
      </defs>
      <path d="M16 2.5c5.6 6.8 10 12 10 17.2A10 10 0 0 1 6 19.7C6 14.5 10.4 9.3 16 2.5Z" fill="url(#bl-drop)" />
      <path d="M8.5 20h4l1.6-3.6 2.6 7 2-5 1.2 1.6h3.6" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const REASONS: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  lab_flag: { label: "Lab flag", icon: Flag, className: "bg-primary/[0.06] text-primary ring-primary/15" },
  outside_range: { label: "Outside range", icon: MoveVertical, className: "bg-review-soft text-review-foreground ring-review/30" },
  gp_rule: { label: "GP rule", icon: ListChecks, className: "bg-brand-soft text-accent-foreground ring-brand/30" },
  couldnt_check: { label: "Couldn't check", icon: CircleHelp, className: "bg-review-soft text-review-foreground ring-review/40" },
};

export function ReasonChip({ reason, className }: { reason: string; className?: string }) {
  const r = REASONS[reason] ?? { label: reason, icon: BellRing, className: "bg-muted text-muted-foreground ring-border" };
  const Icon = r.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap", r.className, className)}>
      <Icon className="size-3" />
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
    sent: "bg-success-soft text-[oklch(0.42_0.11_155)] ring-success/30",
    simulated: "bg-muted text-muted-foreground ring-border",
    failed: "bg-destructive/10 text-destructive ring-destructive/25",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset", styles[status] ?? styles.simulated)}>
      {status}
    </span>
  );
}

export function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-brand-soft text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <div className="text-sm font-semibold tracking-tight">{title}</div>
    </div>
  );
}
