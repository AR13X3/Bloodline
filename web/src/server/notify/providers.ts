// Thin wrappers over Resend (email) and Twilio (SMS, voice).
// Messages never contain patient details.

export interface SendResult {
  providerId: string | null;
}

const TIMEOUT_MS = 15_000;

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim() && process.env.TWILIO_FROM_NUMBER?.trim(),
  );
}

export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM!.trim(), to: [to], subject, text, html }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? "request failed"}`);
  return { providerId: body.id ?? null };
}

async function twilio(path: "Messages.json" | "Calls.json", params: Record<string, string>): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN!.trim()}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/${path}`, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: process.env.TWILIO_FROM_NUMBER!.trim(), ...params }),
  });
  const body = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
  if (!res.ok) throw new Error(`Twilio ${res.status}${body.code ? ` (${body.code})` : ""}: ${body.message ?? "request failed"}`);
  return { providerId: body.sid ?? null };
}

export function sendSms(to: string, body: string): Promise<SendResult> {
  return twilio("Messages.json", { To: to, Body: body });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Builds the call script: a pre-recorded file if configured, otherwise a computer voice. */
export function voiceTwiml(spoken: string): string {
  const recording = process.env.VOICE_MESSAGE_URL?.trim();
  if (recording) return `<Response><Play loop="2">${escapeXml(recording)}</Play></Response>`;
  const voice = escapeXml(process.env.TWILIO_VOICE?.trim() || "Polly.Olivia-Neural");
  const say = `<Say voice="${voice}" language="en-AU">${escapeXml(spoken)}</Say>`;
  return `<Response>${say}<Pause length="1"/>${say}</Response>`;
}

export function makeCall(to: string, spoken: string): Promise<SendResult> {
  return twilio("Calls.json", { To: to, Twiml: voiceTwiml(spoken) });
}
