"use client";

import { ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardFeed } from "@/lib/api";
import { ReasonChip, SectionTitle, StatusPill, channelLabel } from "./bits";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

export function LogsCard({ feed }: { feed: DashboardFeed | undefined }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <SectionTitle icon={ScrollText} title="Records" />
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <Tabs defaultValue="alerts" className="min-h-0 flex-1">
          <TabsList>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="audit">Audit trail</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="mt-3 min-h-80 basis-0 overflow-auto">
            {feed?.alerts.length ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs font-normal text-muted-foreground">
                  <tr><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Patient</th><th className="py-2 pr-3">Result</th><th className="py-2 pr-3">Why</th><th className="py-2 pr-3">To</th><th className="py-2">Seen</th></tr>
                </thead>
                <tbody>
                  {feed.alerts.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{time(a.createdAt)}</td>
                      <td className="py-2 pr-3">{a.patient.name}</td>
                      <td className="py-2 pr-3">{a.result.testName} <span className="font-mono">{a.result.value}</span> <span className="text-xs text-muted-foreground">{a.result.unit}</span></td>
                      <td className="py-2 pr-3"><div className="flex flex-wrap gap-1">{a.reasons.map((r) => <ReasonChip key={r} reason={r} />)}</div></td>
                      <td className="py-2 pr-3">{a.recipient.name}{a.handedOverFrom ? <span className="text-xs text-muted-foreground"> (for {a.handedOverFrom.name})</span> : null}</td>
                      <td className="py-2 font-mono text-xs">{a.seenAt ? time(a.seenAt) : <span className="text-review-foreground">Not yet</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty text="No alerts yet" />}
          </TabsContent>

          <TabsContent value="reports" className="mt-3 min-h-80 basis-0 overflow-auto">
            {feed?.reports.length ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs font-normal text-muted-foreground">
                  <tr><th className="py-2 pr-3">Received</th><th className="py-2 pr-3">Patient</th><th className="py-2 pr-3">Requesting GP</th><th className="py-2 pr-3">Source</th><th className="py-2 pr-3">Read by</th><th className="py-2 pr-3">Results</th><th className="py-2">Alerts</th></tr>
                </thead>
                <tbody>
                  {feed.reports.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{time(r.receivedAt)}</td>
                      <td className="py-2 pr-3">{r.patientName}{r.nameMatches === false ? <span className="ml-1.5 rounded bg-review-soft px-1.5 text-[11px] text-review-foreground">name mismatch</span> : null}</td>
                      <td className="py-2 pr-3">{r.gpName}</td>
                      <td className="py-2 pr-3 capitalize">{r.origin}</td>
                      <td className="py-2 pr-3">{r.extractionSource ?? (r.status === "couldnt_read" ? "couldn't read" : "—")}</td>
                      <td className="py-2 pr-3 font-mono">{r.results}</td>
                      <td className="py-2 font-mono">{r.alerts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty text="No reports yet" />}
          </TabsContent>

          <TabsContent value="messages" className="mt-3 min-h-80 basis-0 overflow-auto">
            {feed?.notifications.length ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs font-normal text-muted-foreground">
                  <tr><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Channel</th><th className="py-2 pr-3">GP</th><th className="py-2 pr-3">To</th><th className="py-2 pr-3">Status</th><th className="py-2">Detail</th></tr>
                </thead>
                <tbody>
                  {feed.notifications.map((n) => (
                    <tr key={n.id} className="border-t">
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{time(n.createdAt)}</td>
                      <td className="py-2 pr-3">{n.channel === "app" ? "In-app" : channelLabel(n.channel)}</td>
                      <td className="py-2 pr-3">{n.gpName}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{n.recipient ?? "—"}</td>
                      <td className="py-2 pr-3"><StatusPill status={n.status} /></td>
                      <td className="py-2 text-xs text-muted-foreground">{n.detail ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty text="No messages yet" />}
          </TabsContent>

          <TabsContent value="audit" className="mt-3 min-h-80 basis-0 overflow-auto">
            {feed?.audit.length ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs font-normal text-muted-foreground">
                  <tr><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Who</th><th className="py-2 pr-3">What</th><th className="py-2">Detail</th></tr>
                </thead>
                <tbody>
                  {feed.audit.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{time(a.at)}</td>
                      <td className="py-2 pr-3">{a.actor}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{a.action}</td>
                      <td className="max-w-md truncate py-2 font-mono text-[11px] text-muted-foreground" title={a.detail ?? undefined}>{a.detail ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty text="No audit events yet" />}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
