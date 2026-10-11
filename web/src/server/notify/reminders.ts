// Sends repeat alerts that have fallen due. A repeat only goes out if the GP
// still has unseen alerts from that report and still has repeats switched on;
// otherwise it's cancelled.
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "../db";
import { audit } from "../db/audit";
import { notifyRecipient } from "./index";
import { getRepeatSettings } from "./repeats";

interface DueRepeat {
  id: string;
  report_id: string;
  clinician_id: string;
  alert_id: string;
  repeat_number: number;
  source_message_id: string;
}

/** Sends or cancels every repeat due by `now`. Returns how many were sent. */
export async function sendDueRepeats(db: DatabaseSync, now: Date = new Date()): Promise<number> {
  const due = db
    .prepare(
      `SELECT rr.id, rr.report_id, rr.clinician_id, rr.alert_id, rr.repeat_number, rep.source_message_id
       FROM repeat_reminders rr JOIN reports rep ON rep.id = rr.report_id
       WHERE rr.status = 'pending' AND rr.due_at <= ? ORDER BY rr.due_at`,
    )
    .all(now.toISOString()) as unknown as DueRepeat[];

  let sent = 0;
  for (const r of due) {
    const { n: unseen } = db
      .prepare("SELECT COUNT(*) AS n FROM alerts WHERE report_id = ? AND recipient_clinician_id = ? AND seen_at IS NULL")
      .get(r.report_id, r.clinician_id) as { n: number };
    if (unseen === 0 || !getRepeatSettings(db, r.clinician_id).on) {
      db.prepare("UPDATE repeat_reminders SET status = 'cancelled' WHERE id = ?").run(r.id);
      continue;
    }
    // Claimed before sending, so an overlapping sweep can't send it twice.
    db.prepare("UPDATE repeat_reminders SET status = 'sent', sent_at = ? WHERE id = ?").run(now.toISOString(), r.id);
    audit(db, { actor: "system", action: "alert.repeated", entityType: "alert", entityId: r.alert_id, detail: { repeat: r.repeat_number, unseen } });
    await notifyRecipient(db, { clinicianId: r.clinician_id, alertId: r.alert_id, resultCount: unseen, sourceMessageId: r.source_message_id, repeat: r.repeat_number });
    sent += 1;
  }
  return sent;
}

const globalForRepeats = globalThis as unknown as { __bloodlineRepeats?: { timer: ReturnType<typeof setInterval>; running: boolean } };

/** Checks for due repeats every few seconds. Started once per server process (see instrumentation.ts). */
export function startRepeatScheduler(intervalMs = 10_000): void {
  if (globalForRepeats.__bloodlineRepeats) return;
  const state = { running: false, timer: setInterval(() => void tick(), intervalMs) };
  state.timer.unref?.();
  globalForRepeats.__bloodlineRepeats = state;

  async function tick() {
    if (state.running) return;
    state.running = true;
    try {
      await sendDueRepeats(getDb());
    } catch (err) {
      console.error("Repeat alerts:", err);
    } finally {
      state.running = false;
    }
  }
}
