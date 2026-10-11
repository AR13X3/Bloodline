// Sends one nudge per GP per report on each channel they've chosen.
// Real messages only go out when live messages are switched on and the
// provider's keys are set; otherwise the attempt is logged as "simulated".
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { audit } from "../db/audit";
import { liveMessagesOn } from "../db/settings";
import { emit } from "../events";
import { emailConfigured, makeCall, sendEmail, sendSms, twilioConfigured, type SendResult } from "./providers";

export type Channel = "app" | "email" | "sms" | "voice";

export interface NotificationOutcome {
  channel: Channel;
  status: "sent" | "simulated" | "failed";
  recipient: string | null;
  detail: string | null;
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "•••";
  return `${name.slice(0, 1)}•••@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.length < 6) return "•••";
  return `${digits.slice(0, 3)} ••• ••• ${digits.slice(-3)}`;
}

export function messageText(count: number): { sms: string; subject: string; email: string; html: string; voice: string } {
  const what = count === 1 ? "1 new result" : `${count} new results`;
  const sms = `BloodLine: You have ${what} to review. Open the app.`;
  return {
    sms,
    subject: `BloodLine: ${what} to review`,
    email: `${sms}\n\nFor privacy, this message contains no patient details. Sign in to the BloodLine app to see the result.\n\nSynthetic demo - not for clinical use.`,
    html: `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#0b1f3a">
  <div style="font-size:20px;font-weight:600;color:#0b1f3a">BloodLine</div>
  <p style="font-size:16px;line-height:1.5;margin:24px 0">You have <strong>${what}</strong> to review.</p>
  <p style="font-size:14px;line-height:1.5;color:#55606e">For privacy, this message contains no patient details. Open the BloodLine app to see the result.</p>
  <p style="font-size:12px;color:#8a94a3;margin-top:32px">Synthetic demo - not for clinical use.</p>
</div>`,
    voice: `This is BloodLine. You have ${what} to review. Please open the BloodLine app.`,
  };
}

interface ClinicianContact {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  notify_email: number;
  notify_sms: number;
  notify_voice: number;
}

export async function notifyRecipient(
  db: DatabaseSync,
  input: { clinicianId: string; alertId: string; resultCount: number },
): Promise<NotificationOutcome[]> {
  const gp = db
    .prepare("SELECT id, name, email, mobile, notify_email, notify_sms, notify_voice FROM clinicians WHERE id = ?")
    .get(input.clinicianId) as ClinicianContact | undefined;
  if (!gp) return [];

  const live = liveMessagesOn(db);
  const text = messageText(input.resultCount);

  const attempts: { channel: Channel; recipient: string | null; configured: boolean; send: () => Promise<SendResult> }[] = [];
  if (gp.notify_email && gp.email) {
    attempts.push({ channel: "email", recipient: maskEmail(gp.email), configured: emailConfigured(), send: () => sendEmail(gp.email!, text.subject, text.email, text.html) });
  }
  if (gp.notify_sms && gp.mobile) {
    attempts.push({ channel: "sms", recipient: maskPhone(gp.mobile), configured: twilioConfigured(), send: () => sendSms(gp.mobile!, text.sms) });
  }
  if (gp.notify_voice && gp.mobile) {
    attempts.push({ channel: "voice", recipient: maskPhone(gp.mobile), configured: twilioConfigured(), send: () => makeCall(gp.mobile!, text.voice) });
  }

  // The in-app alert is always available: the app picks it up when it next checks.
  const outcomes: NotificationOutcome[] = [{ channel: "app", status: "sent", recipient: "BloodLine app", detail: null }];
  const sent = await Promise.all(
    attempts.map(async (a): Promise<NotificationOutcome & { providerId: string | null }> => {
      if (!live) return { channel: a.channel, status: "simulated", recipient: a.recipient, detail: "Live messages are off", providerId: null };
      if (!a.configured) return { channel: a.channel, status: "simulated", recipient: a.recipient, detail: "Provider keys not set", providerId: null };
      try {
        const r = await a.send();
        return { channel: a.channel, status: "sent", recipient: a.recipient, detail: null, providerId: r.providerId };
      } catch (err) {
        return { channel: a.channel, status: "failed", recipient: a.recipient, detail: err instanceof Error ? err.message : String(err), providerId: null };
      }
    }),
  );

  const insert = db.prepare(
    `INSERT INTO notifications (id, alert_id, channel, recipient_masked, status, provider_id, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const now = new Date().toISOString();
  const rows = [{ ...outcomes[0], providerId: null }, ...sent];
  rows.forEach((o, i) => {
    insert.run(randomUUID(), input.alertId, o.channel, o.recipient, o.status, o.providerId, o.detail, now);
    audit(db, { actor: "system", action: `notification.${o.status}`, entityType: "alert", entityId: input.alertId, detail: { channel: o.channel, detail: o.detail } }, now);
    emit({ type: "notification", alertId: input.alertId, channel: o.channel, status: o.status, recipient: o.recipient, detail: o.detail });
    if (i > 0) outcomes.push({ channel: o.channel, status: o.status, recipient: o.recipient, detail: o.detail });
  });
  return outcomes;
}
