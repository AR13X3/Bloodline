import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CommandError, UpdateSettingsInput, markAlertSeen, updateClinicianSettings, updateRule } from "../commands";
import { openDb } from "../db";
import { DEMO_GP_ID } from "../db/seed";
import { ingestReport } from "../pipeline/ingest";
import { getClinicianSettings, listAlerts } from "../queries";
import { renderReportPdf } from "../reports/pdf";
import { buildScenarioReport, getScenario } from "../simulator/scenarios";
import { sendDueRepeats } from "./reminders";

const KEYS = ["OPENROUTER_API_KEY", "RESEND_API_KEY", "EMAIL_FROM", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "VOICE_MESSAGE_URL"];
const NOW = new Date("2026-10-11T00:00:00Z");
const MINUTE = 60_000;
let tmp: string;
let messageCounter = 0;

beforeAll(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "bloodline-repeats-"));
  process.env.BLOODLINE_REPORTS_DIR = tmp;
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
});

function freshDb() {
  return openDb(":memory:", { demoGpEmail: "gp@example.com", demoGpMobile: "+61400000823", now: NOW });
}

/** Sends the "lab flagged" scenario, which alerts the demo GP. Returns when the first nudge went out. */
async function sendLabFlagged(db: ReturnType<typeof freshDb>): Promise<number> {
  const built = buildScenarioReport(db, getScenario("lab_flagged")!, NOW);
  const before = Date.now();
  await ingestReport(db, {
    pdf: await renderReportPdf(built.report),
    fileName: "lab_flagged.pdf",
    origin: "simulator",
    sourceMessageId: `MSG-${++messageCounter}`,
    patientId: built.patientId,
    requestingClinicianId: built.requestingClinicianId,
    labName: built.report.labName,
    collectedAt: built.report.collectedAt.toISOString(),
    sourceRows: built.sourceRows,
    sourcePatientName: built.report.patient.name,
  });
  return before;
}

function repeats(db: ReturnType<typeof freshDb>) {
  return db.prepare("SELECT repeat_number, status, due_at FROM repeat_reminders ORDER BY repeat_number").all() as { repeat_number: number; status: string; due_at: string }[];
}

function notificationsFor(db: ReturnType<typeof freshDb>, repeat: number) {
  return db.prepare("SELECT channel, status FROM notifications WHERE repeat_number = ? ORDER BY channel").all(repeat);
}

describe("repeat alert settings", () => {
  it("are off by default", () => {
    const settings = getClinicianSettings(freshDb(), DEMO_GP_ID)!;
    expect(settings.repeatAlerts).toBe(false);
    expect(settings.repeatAfterMinutes).toEqual([]);
  });

  it("store up to two timings, sorted and without duplicates", () => {
    const db = freshDb();
    updateClinicianSettings(db, DEMO_GP_ID, { repeatAlerts: true, repeatAfterMinutes: [60, 15] });
    expect(getClinicianSettings(db, DEMO_GP_ID)).toMatchObject({ repeatAlerts: true, repeatAfterMinutes: [15, 60] });
    updateClinicianSettings(db, DEMO_GP_ID, { repeatAfterMinutes: [30, 30] });
    expect(getClinicianSettings(db, DEMO_GP_ID)!.repeatAfterMinutes).toEqual([30]);
  });

  it("reject more than two repeats or out-of-range timings", () => {
    expect(UpdateSettingsInput.safeParse({ repeatAfterMinutes: [5, 15, 60] }).success).toBe(false);
    expect(UpdateSettingsInput.safeParse({ repeatAfterMinutes: [0] }).success).toBe(false);
    expect(UpdateSettingsInput.safeParse({ repeatAfterMinutes: [24 * 60 + 1] }).success).toBe(false);
    expect(UpdateSettingsInput.safeParse({ repeatAfterMinutes: [1, 24 * 60] }).success).toBe(true);
  });
});

describe("repeat alerts", () => {
  it("aren't planned when the GP hasn't turned them on", async () => {
    const db = freshDb();
    await sendLabFlagged(db);
    expect(repeats(db)).toEqual([]);
  });

  it("are planned from the first nudge, at the GP's chosen times", async () => {
    const db = freshDb();
    updateClinicianSettings(db, DEMO_GP_ID, { repeatAlerts: true, repeatAfterMinutes: [15, 60] });
    const sentAt = await sendLabFlagged(db);
    const planned = repeats(db);
    expect(planned.map((r) => [r.repeat_number, r.status])).toEqual([[1, "pending"], [2, "pending"]]);
    const delay = (r: { due_at: string }) => Math.round((new Date(r.due_at).getTime() - sentAt) / MINUTE);
    expect(planned.map(delay)).toEqual([15, 60]);
  });

  it("go out on the GP's channels when due and the alerts are still unseen", async () => {
    const db = freshDb();
    updateClinicianSettings(db, DEMO_GP_ID, { repeatAlerts: true, repeatAfterMinutes: [15, 60] });
    const sentAt = await sendLabFlagged(db);

    expect(await sendDueRepeats(db, new Date(sentAt + 10 * MINUTE))).toBe(0);
    expect(await sendDueRepeats(db, new Date(sentAt + 16 * MINUTE))).toBe(1);
    expect(repeats(db).map((r) => r.status)).toEqual(["sent", "pending"]);
    // Live messages are off, so email and SMS are logged as simulated.
    expect(notificationsFor(db, 1)).toEqual([
      { channel: "app", status: "sent" },
      { channel: "email", status: "simulated" },
      { channel: "sms", status: "simulated" },
    ]);
    expect(listAlerts(db, DEMO_GP_ID).every((a) => a.lastRepeatAt !== null)).toBe(true);
    const audited = db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'alert.repeated'").get() as { n: number };
    expect(audited.n).toBe(1);

    // Sending again doesn't repeat the same reminder.
    expect(await sendDueRepeats(db, new Date(sentAt + 20 * MINUTE))).toBe(0);
  });

  it("are cancelled once the GP has seen every alert from the report", async () => {
    const db = freshDb();
    updateClinicianSettings(db, DEMO_GP_ID, { repeatAlerts: true, repeatAfterMinutes: [15] });
    const sentAt = await sendLabFlagged(db);
    for (const a of listAlerts(db, DEMO_GP_ID)) markAlertSeen(db, a.id, DEMO_GP_ID);

    expect(await sendDueRepeats(db, new Date(sentAt + 16 * MINUTE))).toBe(0);
    expect(repeats(db).map((r) => r.status)).toEqual(["cancelled"]);
    expect(notificationsFor(db, 1)).toEqual([]);
  });

  it("are cancelled when the GP switches repeats off", async () => {
    const db = freshDb();
    updateClinicianSettings(db, DEMO_GP_ID, { repeatAlerts: true, repeatAfterMinutes: [15, 60] });
    const sentAt = await sendLabFlagged(db);
    updateClinicianSettings(db, DEMO_GP_ID, { repeatAlerts: false });

    expect(repeats(db).map((r) => r.status)).toEqual(["cancelled", "cancelled"]);
    expect(await sendDueRepeats(db, new Date(sentAt + 90 * MINUTE))).toBe(0);
  });
});

describe("editing a rule", () => {
  const rule = (db: ReturnType<typeof freshDb>) =>
    db.prepare("SELECT direction, threshold, note, ends_at, version FROM rules WHERE id = 'rule_fletcher_k'").get() as {
      direction: string; threshold: number; note: string | null; ends_at: string; version: number;
    };

  it("changes the direction, value and note, keeps the end date, and is audited", () => {
    const db = freshDb();
    const before = rule(db);
    updateRule(db, "rule_fletcher_k", { action: "edit", clinicianId: DEMO_GP_ID, direction: "below", threshold: 3.5, note: "Watching for low potassium" });
    expect(rule(db)).toEqual({ direction: "below", threshold: 3.5, note: "Watching for low potassium", ends_at: before.ends_at, version: before.version + 1 });
    const audited = db.prepare("SELECT detail FROM audit_events WHERE action = 'rule.edited'").get() as { detail: string };
    expect(JSON.parse(audited.detail)).toMatchObject({ from: { direction: "above", threshold: 5 }, to: { direction: "below", threshold: 3.5 }, noteChanged: true });
    expect(audited.detail).not.toContain("Watching");
  });

  it("can set a new end date", () => {
    const db = freshDb();
    const start = Date.now();
    updateRule(db, "rule_fletcher_k", { action: "edit", clinicianId: DEMO_GP_ID, direction: "above", threshold: 5.5, months: 6 });
    const days = (new Date(rule(db).ends_at).getTime() - start) / (24 * 60 * MINUTE);
    expect(Math.round(days)).toBe(180);
  });

  it("is only allowed for the GP who owns the rule, while it's still running", () => {
    const db = freshDb();
    const edit = (clinicianId: string) => updateRule(db, "rule_fletcher_k", { action: "edit", clinicianId, direction: "above", threshold: 6 });
    expect(() => edit("gp_patel")).toThrow(CommandError);
    updateRule(db, "rule_fletcher_k", { action: "end", clinicianId: DEMO_GP_ID });
    expect(() => edit(DEMO_GP_ID)).toThrow(/already ended/);
  });
});
