// Repeat alerts: a GP can ask to be nudged again, up to twice, if they haven't
// seen an alert yet. Repeats are planned when the first nudge goes out and
// sent later by the reminder sweep (see reminders.ts).
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export const MAX_REPEATS = 2;
/** Longest delay a GP can choose, in minutes (one day). */
export const MAX_REPEAT_MINUTES = 24 * 60;

export interface RepeatSettings {
  on: boolean;
  afterMinutes: number[];
}

/** Sorted, de-duplicated and capped at two, so storage and display agree. */
export function normaliseRepeatMinutes(minutes: number[]): number[] {
  return [...new Set(minutes.map((m) => Math.round(m)))].sort((a, b) => a - b).slice(0, MAX_REPEATS);
}

export function getRepeatSettings(db: DatabaseSync, clinicianId: string): RepeatSettings {
  const row = db.prepare("SELECT repeat_alerts, repeat_after_minutes FROM clinicians WHERE id = ?").get(clinicianId) as
    | { repeat_alerts: number; repeat_after_minutes: string }
    | undefined;
  if (!row) return { on: false, afterMinutes: [] };
  let afterMinutes: number[] = [];
  try {
    const parsed: unknown = JSON.parse(row.repeat_after_minutes);
    if (Array.isArray(parsed)) afterMinutes = normaliseRepeatMinutes(parsed.filter((m): m is number => typeof m === "number"));
  } catch {
    // Treat a malformed value as no repeats.
  }
  return { on: row.repeat_alerts === 1, afterMinutes };
}

/** Plans this GP's repeats for a report they've just been nudged about. Returns how many were planned. */
export function scheduleRepeats(db: DatabaseSync, input: { clinicianId: string; alertId: string; from?: Date }): number {
  const settings = getRepeatSettings(db, input.clinicianId);
  if (!settings.on || settings.afterMinutes.length === 0) return 0;
  const alert = db.prepare("SELECT report_id FROM alerts WHERE id = ?").get(input.alertId) as { report_id: string } | undefined;
  if (!alert) return 0;

  const from = input.from ?? new Date();
  const insert = db.prepare(
    `INSERT INTO repeat_reminders (id, report_id, clinician_id, alert_id, repeat_number, due_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  settings.afterMinutes.forEach((minutes, i) => {
    insert.run(randomUUID(), alert.report_id, input.clinicianId, input.alertId, i + 1, new Date(from.getTime() + minutes * 60_000).toISOString(), from.toISOString());
  });
  return settings.afterMinutes.length;
}

/** Drops a GP's repeats that haven't gone out yet, e.g. when they switch repeats off. */
export function cancelPendingRepeats(db: DatabaseSync, clinicianId: string): number {
  return Number(db.prepare("UPDATE repeat_reminders SET status = 'cancelled' WHERE clinician_id = ? AND status = 'pending'").run(clinicianId).changes);
}
