import { useSession } from "./session";
import type { AlertDetail, AlertListItem, ClinicianSettings, ClinicianSummary, PatientDetail, PatientSummary } from "./types";

export class ApiError extends Error {}

export type SettingsPatch = Partial<Pick<ClinicianSettings, "notifyEmail" | "notifySms" | "notifyVoice" | "away" | "coveringClinicianId" | "repeatAlerts" | "repeatAfterMinutes">>;

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${base}${path}`, { ...init, signal: controller.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `Request failed (${res.status})`);
    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(controller.signal.aborted ? "The server didn't respond in time" : "Can't reach the BloodLine server");
  } finally {
    clearTimeout(timer);
  }
}

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function createApi(base: string) {
  return {
    health: () => request<{ ok: boolean }>(base, "/api/health"),
    clinicians: () => request<ClinicianSummary[]>(base, "/api/clinicians"),
    alerts: (clinicianId: string) => request<AlertListItem[]>(base, `/api/alerts?clinicianId=${encodeURIComponent(clinicianId)}`),
    alert: (id: string) => request<AlertDetail>(base, `/api/alerts/${id}`),
    markSeen: (id: string, clinicianId: string) => request<{ seenAt: string }>(base, `/api/alerts/${id}/seen`, json("POST", { clinicianId })),
    patients: () => request<PatientSummary[]>(base, "/api/patients"),
    patient: (id: string) => request<PatientDetail>(base, `/api/patients/${id}`),
    createRule: (input: { clinicianId: string; patientId: string; testTypeId: string; direction: "above" | "below"; threshold: number; months: 1 | 3 | 6; note?: string | null }) =>
      request<{ id: string }>(base, "/api/rules", json("POST", input)),
    updateRule: (
      id: string,
      input:
        | { action: "renew"; clinicianId: string; months: 1 | 3 | 6 }
        | { action: "end"; clinicianId: string }
        | { action: "edit"; clinicianId: string; direction: "above" | "below"; threshold: number; note?: string | null; months?: 1 | 3 | 6 },
    ) =>
      request<{ ok: true }>(base, `/api/rules/${id}`, json("PATCH", input)),
    settings: (clinicianId: string) => request<ClinicianSettings>(base, `/api/clinicians/${clinicianId}/settings`),
    updateSettings: (clinicianId: string, patch: SettingsPatch) =>
      request<ClinicianSettings>(base, `/api/clinicians/${clinicianId}/settings`, json("PUT", patch)),
    reportUrl: (fileUrl: string) => `${base}${fileUrl}`,
  };
}

export function useApi() {
  const { serverUrl } = useSession();
  return createApi(serverUrl);
}
