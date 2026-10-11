// Browser-side API client for the presenter console.
import type { IngestSummary } from "@/server/pipeline/ingest";
import type { ClinicianSettings, ClinicianSummary, DashboardFeed, PatientSummary, ReportView } from "@/server/queries";

export type { ClinicianSettings, ClinicianSummary, DashboardFeed, IngestSummary, PatientSummary, ReportView };

export interface ScenarioSummary {
  id: string;
  title: string;
  description: string;
  expected: string;
  patientId: string;
  panelName: string;
}

export type SendResult = IngestSummary & { sourceMessageId: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  feed: () => request<DashboardFeed>("/api/dashboard/feed"),
  report: (id: string) => request<ReportView>(`/api/reports/${id}`),
  scenarios: () => request<ScenarioSummary[]>("/api/simulator/scenarios"),
  patients: () => request<PatientSummary[]>("/api/patients"),
  clinicians: () => request<ClinicianSummary[]>("/api/clinicians"),
  settings: (clinicianId: string) => request<ClinicianSettings>(`/api/clinicians/${clinicianId}/settings`),
  updateSettings: (clinicianId: string, patch: Partial<Pick<ClinicianSettings, "notifyEmail" | "notifySms" | "notifyVoice" | "away" | "coveringClinicianId">>) =>
    request<ClinicianSettings>(`/api/clinicians/${clinicianId}/settings`, json("PUT", patch)),
  setLiveMessages: (on: boolean) => request<{ liveMessages: boolean }>("/api/settings", json("PUT", { liveMessages: on })),
  sendScenario: (scenario: string, sourceMessageId?: string) => request<SendResult>("/api/simulator/send", json("POST", { scenario, sourceMessageId })),
  upload: (file: File, patientId: string, requestingClinicianId: string) => {
    const form = new FormData();
    form.set("file", file);
    form.set("patientId", patientId);
    form.set("requestingClinicianId", requestingClinicianId);
    return request<SendResult>("/api/simulator/upload", { method: "POST", body: form });
  },
  reset: () => request<{ ok: true }>("/api/demo/reset", { method: "POST" }),
};

export const DEMO_GP_ID = "gp_chen";

export function maskEmail(email: string | null): string {
  if (!email) return "Not set";
  const [name, domain] = email.split("@");
  return domain ? `${name.slice(0, 1)}•••@${domain}` : "•••";
}

export function maskPhone(phone: string | null): string {
  if (!phone) return "Not set";
  return phone.length > 6 ? `${phone.slice(0, 3)} ••• ••• ${phone.slice(-3)}` : "•••";
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
