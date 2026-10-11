// Actions from the GP app and the dashboard. Every change is audited.
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { audit } from "./db/audit";
import { setSetting } from "./db/settings";
import { emit } from "./events";

export class CommandError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409 = 400) {
    super(message);
  }
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// ---------- Alerts ----------

export function markAlertSeen(db: DatabaseSync, alertId: string, clinicianId: string): { seenAt: string } {
  const alert = db.prepare("SELECT recipient_clinician_id, seen_at FROM alerts WHERE id = ?").get(alertId) as
    | { recipient_clinician_id: string; seen_at: string | null }
    | undefined;
  if (!alert) throw new CommandError("Alert not found", 404);
  if (alert.recipient_clinician_id !== clinicianId) throw new CommandError("Only the alert's recipient can mark it as seen", 403);
  if (alert.seen_at) return { seenAt: alert.seen_at };

  const seenAt = new Date().toISOString();
  db.prepare("UPDATE alerts SET seen_at = ?, seen_by_clinician_id = ? WHERE id = ?").run(seenAt, clinicianId, alertId);
  audit(db, { actor: clinicianId, action: "alert.seen", entityType: "alert", entityId: alertId }, seenAt);
  emit({ type: "alert.seen", alertId });
  return { seenAt };
}

// ---------- Rules ----------

export const CreateRuleInput = z.object({
  clinicianId: z.string().min(1),
  patientId: z.string().min(1),
  testTypeId: z.string().min(1),
  direction: z.enum(["above", "below"]),
  threshold: z.number().finite().nonnegative(),
  months: z.union([z.literal(1), z.literal(3), z.literal(6)]),
  note: z.string().trim().max(200).nullish(),
});

export function createRule(db: DatabaseSync, input: z.infer<typeof CreateRuleInput>): { id: string } {
  const test = db.prepare("SELECT unit FROM test_types WHERE id = ?").get(input.testTypeId) as { unit: string } | undefined;
  if (!test) throw new CommandError("Unknown test");
  if (!db.prepare("SELECT 1 FROM patients WHERE id = ?").get(input.patientId)) throw new CommandError("Unknown patient", 404);
  if (!db.prepare("SELECT 1 FROM clinicians WHERE id = ?").get(input.clinicianId)) throw new CommandError("Unknown GP", 404);

  const id = randomUUID();
  const now = new Date();
  const endsAt = new Date(now.getTime() + input.months * MONTH_MS).toISOString();
  db.prepare(
    `INSERT INTO rules (id, clinician_id, patient_id, test_type_id, direction, threshold, unit, note, starts_at, ends_at, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(id, input.clinicianId, input.patientId, input.testTypeId, input.direction, input.threshold, test.unit, input.note || null, now.toISOString(), endsAt, now.toISOString(), now.toISOString());
  audit(db, {
    actor: input.clinicianId,
    action: "rule.created",
    entityType: "rule",
    entityId: id,
    detail: { patientId: input.patientId, testTypeId: input.testTypeId, direction: input.direction, threshold: input.threshold, unit: test.unit, endsAt },
  });
  emit({ type: "rules.changed", patientId: input.patientId });
  return { id };
}

export const UpdateRuleInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("renew"), clinicianId: z.string().min(1), months: z.union([z.literal(1), z.literal(3), z.literal(6)]) }),
  z.object({ action: z.literal("end"), clinicianId: z.string().min(1) }),
]);

export function updateRule(db: DatabaseSync, ruleId: string, input: z.infer<typeof UpdateRuleInput>): void {
  const rule = db.prepare("SELECT clinician_id, patient_id, ends_at, ended_at, version FROM rules WHERE id = ?").get(ruleId) as
    | { clinician_id: string; patient_id: string; ends_at: string; ended_at: string | null; version: number }
    | undefined;
  if (!rule) throw new CommandError("Rule not found", 404);
  if (rule.clinician_id !== input.clinicianId) throw new CommandError("You can only change your own rules", 403);
  if (rule.ended_at) throw new CommandError("This rule has already ended", 409);

  const now = new Date();
  if (input.action === "renew") {
    const endsAt = new Date(now.getTime() + input.months * MONTH_MS).toISOString();
    db.prepare("UPDATE rules SET ends_at = ?, version = version + 1, updated_at = ? WHERE id = ?").run(endsAt, now.toISOString(), ruleId);
    audit(db, { actor: input.clinicianId, action: "rule.renewed", entityType: "rule", entityId: ruleId, detail: { from: rule.ends_at, to: endsAt, version: rule.version + 1 } });
  } else {
    db.prepare("UPDATE rules SET ended_at = ?, version = version + 1, updated_at = ? WHERE id = ?").run(now.toISOString(), now.toISOString(), ruleId);
    audit(db, { actor: input.clinicianId, action: "rule.ended", entityType: "rule", entityId: ruleId, detail: { version: rule.version + 1 } });
  }
  emit({ type: "rules.changed", patientId: rule.patient_id });
}

// ---------- GP settings ----------

const E164 = /^\+[1-9]\d{7,14}$/;

export const UpdateSettingsInput = z
  .object({
    email: z.email().nullable(),
    mobile: z.string().trim().regex(E164, "Use international format, e.g. +61400000000").nullable(),
    notifyEmail: z.boolean(),
    notifySms: z.boolean(),
    notifyVoice: z.boolean(),
    away: z.boolean(),
    coveringClinicianId: z.string().min(1).nullable(),
  })
  .partial();

export function updateClinicianSettings(db: DatabaseSync, clinicianId: string, input: z.infer<typeof UpdateSettingsInput>): void {
  if (!db.prepare("SELECT 1 FROM clinicians WHERE id = ?").get(clinicianId)) throw new CommandError("Unknown GP", 404);
  if (input.coveringClinicianId) {
    if (input.coveringClinicianId === clinicianId) throw new CommandError("You can't cover for yourself");
    if (!db.prepare("SELECT 1 FROM clinicians WHERE id = ?").get(input.coveringClinicianId)) throw new CommandError("Unknown colleague");
  }

  const columns: Record<keyof typeof input, string> = {
    email: "email",
    mobile: "mobile",
    notifyEmail: "notify_email",
    notifySms: "notify_sms",
    notifyVoice: "notify_voice",
    away: "away",
    coveringClinicianId: "covering_clinician_id",
  };
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, column] of Object.entries(columns) as [keyof typeof input, string][]) {
    const value = input[key];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    values.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
  }
  if (sets.length === 0) return;
  db.prepare(`UPDATE clinicians SET ${sets.join(", ")} WHERE id = ?`).run(...values, clinicianId);

  // Never put contact details in the audit log.
  const changed = Object.keys(input).map((k) => (k === "email" || k === "mobile" ? `${k} (changed)` : `${k}=${String(input[k as keyof typeof input])}`));
  audit(db, { actor: clinicianId, action: "settings.updated", entityType: "clinician", entityId: clinicianId, detail: { changed } });
  emit({ type: "settings.changed" });
}

export function setLiveMessages(db: DatabaseSync, on: boolean, actor = "presenter"): void {
  setSetting(db, "live_messages", on ? "on" : "off");
  audit(db, { actor, action: on ? "live_messages.on" : "live_messages.off" });
  emit({ type: "settings.changed" });
}
