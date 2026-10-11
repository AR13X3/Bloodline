import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb } from "../db";
import { setSetting } from "../db/settings";
import { renderReportPdf } from "../reports/pdf";
import { buildScenarioReport, getScenario, type ScenarioId } from "../simulator/scenarios";
import { ingestReport } from "./ingest";

const KEYS = ["OPENROUTER_API_KEY", "RESEND_API_KEY", "EMAIL_FROM", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "VOICE_MESSAGE_URL"];
const NOW = new Date("2026-10-11T00:00:00Z");
let tmp: string;
let messageCounter = 0;

beforeAll(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "bloodline-test-"));
  process.env.BLOODLINE_REPORTS_DIR = tmp;
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => vi.unstubAllGlobals());

function freshDb(contacts: { demoGpEmail: string | null; demoGpMobile: string | null } = { demoGpEmail: "gp@example.com", demoGpMobile: "+61400000823" }) {
  return openDb(":memory:", { ...contacts, now: NOW });
}

async function send(db: ReturnType<typeof freshDb>, id: ScenarioId, sourceMessageId = `MSG-${++messageCounter}`) {
  const built = buildScenarioReport(db, getScenario(id)!, NOW);
  const pdf = await renderReportPdf(built.report);
  const summary = await ingestReport(db, {
    pdf,
    fileName: `${id}.pdf`,
    origin: "simulator",
    sourceMessageId,
    patientId: built.patientId,
    requestingClinicianId: built.requestingClinicianId,
    labName: built.report.labName,
    collectedAt: built.report.collectedAt.toISOString(),
    sourceRows: built.sourceRows,
  });
  return { summary, pdf };
}

describe("synthetic report PDFs", () => {
  it("are byte-identical for the same scenario on the same day", async () => {
    const db = freshDb();
    const hash = async () =>
      createHash("sha256").update(await renderReportPdf(buildScenarioReport(db, getScenario("lab_flagged")!, NOW).report)).digest("hex");
    expect(await hash()).toBe(await hash());
  });
});

describe("ingestReport (AI not configured, so the labelled simulator fallback is used)", () => {
  it("logs a normal result without alerting anyone", async () => {
    const db = freshDb();
    const { summary } = await send(db, "normal");
    expect(summary.extraction?.source).toBe("fallback");
    expect(summary.results).toHaveLength(2);
    expect(summary.alerts).toEqual([]);
    expect(summary.notifications).toEqual([]);
    const checks = db.prepare("SELECT COUNT(*) AS n FROM checks").get() as { n: number };
    expect(checks.n).toBe(6);
  });

  it("alerts the requesting GP for a lab-flagged result, once per result but one nudge per report", async () => {
    const db = freshDb();
    const { summary } = await send(db, "lab_flagged");
    expect(summary.alerts.map((a) => [a.recipientId, a.reasons])).toEqual([
      ["gp_chen", ["lab_flag", "outside_range"]],
      ["gp_chen", ["lab_flag", "outside_range"]],
    ]);
    // Live messages are off by default: app + email + SMS, simulated (voice is off by default).
    expect(summary.notifications.map((n) => `${n.channel}:${n.status}`)).toEqual(["app:sent", "email:simulated", "sms:simulated"]);
    expect(summary.notifications.find((n) => n.channel === "sms")?.recipient).toBe("+61 ••• ••• 823");
  });

  it("alerts from a GP rule even though the lab says normal", async () => {
    const db = freshDb();
    const { summary } = await send(db, "rule_match");
    expect(summary.alerts).toHaveLength(1);
    expect(summary.alerts[0]).toMatchObject({ recipientId: "gp_chen", reasons: ["gp_rule"] });
  });

  it("alerts when outside the printed range without a lab flag", async () => {
    const db = freshDb();
    const { summary } = await send(db, "range_only");
    expect(summary.alerts.map((a) => a.reasons)).toEqual([["outside_range"]]);
    expect(summary.alerts[0].recipientId).toBe("gp_patel");
  });

  it("says it couldn't check, and still passes on the lab flag", async () => {
    const db = freshDb();
    const { summary } = await send(db, "couldnt_check");
    expect(summary.results[0]).toMatchObject({ checkStatus: "couldnt_check", couldntCheckReason: "value_not_numeric" });
    expect(summary.alerts[0]).toMatchObject({ recipientId: "gp_okafor", reasons: ["lab_flag", "couldnt_check"] });
  });

  it("ignores a duplicate source message id", async () => {
    const db = freshDb();
    await send(db, "lab_flagged", "SAME-ID");
    const { summary } = await send(db, "lab_flagged", "SAME-ID");
    expect(summary.status).toBe("duplicate");
    const n = db.prepare("SELECT COUNT(*) AS n FROM alerts").get() as { n: number };
    expect(n.n).toBe(2);
  });

  it("hands alerts to a covering colleague", async () => {
    const db = freshDb();
    db.prepare("UPDATE clinicians SET away = 1, covering_clinician_id = 'gp_patel' WHERE id = 'gp_chen'").run();
    const { summary } = await send(db, "rule_match");
    expect(summary.alerts[0]).toMatchObject({ recipientId: "gp_patel", originalId: "gp_chen" });
  });

  it("tells the GP when a report can't be read and there's no fallback", async () => {
    const db = freshDb();
    const built = buildScenarioReport(db, getScenario("normal")!, NOW);
    const summary = await ingestReport(db, {
      pdf: await renderReportPdf(built.report),
      fileName: "upload.pdf",
      origin: "upload",
      sourceMessageId: "UPLOAD-1",
      patientId: built.patientId,
      requestingClinicianId: built.requestingClinicianId,
      labName: "x",
      collectedAt: NOW.toISOString(),
    });
    expect(summary.extraction?.source).toBe("failed");
    expect(summary.alerts[0]).toMatchObject({ recipientId: "gp_chen", reasons: ["couldnt_check"] });
  });
});

describe("ingestReport with AI and live messages (network mocked)", () => {
  it("uses the AI transcription, caches it, and sends real-format requests to the providers", async () => {
    Object.assign(process.env, {
      OPENROUTER_API_KEY: "test-key",
      RESEND_API_KEY: "test-resend",
      EMAIL_FROM: "BloodLine <onboarding@resend.dev>",
      TWILIO_ACCOUNT_SID: "ACtest",
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_FROM_NUMBER: "+17372508034",
    });
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: String(init.body) });
        if (url.includes("openrouter")) {
          const content = JSON.stringify({
            results: [
              { testName: "Potassium", value: "5.1", unit: "mmol/L", referenceRange: "3.5 - 5.2", labFlag: null, labComment: null },
              { testName: "Sodium", value: "138", unit: "mmol/L", referenceRange: "135 - 145", labFlag: null, labComment: null },
            ],
            reportComment: null,
          });
          return Response.json({ model: "anthropic/claude-haiku-5.5", choices: [{ message: { content } }], usage: { prompt_tokens: 2000, completion_tokens: 150, cost: 0.0003 } });
        }
        if (url.includes("resend")) return Response.json({ id: "email_1" });
        return Response.json({ sid: url.includes("Calls") ? "CA1" : "SM1" }, { status: 201 });
      }),
    );

    const db = freshDb();
    setSetting(db, "live_messages", "on");
    db.prepare("UPDATE clinicians SET notify_voice = 1 WHERE id = 'gp_chen'").run();

    const first = await send(db, "rule_match");
    expect(first.summary.extraction).toMatchObject({ source: "ai", model: "anthropic/claude-haiku-5.5", costUsd: 0.0003 });
    expect(first.summary.alerts[0].reasons).toEqual(["gp_rule"]);
    expect(first.summary.notifications.map((n) => `${n.channel}:${n.status}`)).toEqual(["app:sent", "email:sent", "sms:sent", "voice:sent"]);

    const aiBody = JSON.parse(calls.find((c) => c.url.includes("openrouter"))!.body);
    expect(aiBody.response_format.json_schema.strict).toBe(true);
    expect(aiBody.messages[0].content[1].file.file_data).toMatch(/^data:application\/pdf;base64,/);

    const sms = new URLSearchParams(calls.find((c) => c.url.endsWith("Messages.json"))!.body);
    expect(sms.get("Body")).toBe("BloodLine: You have 1 new result to review. Open the app.");
    expect(sms.get("To")).toBe("+61400000823");
    const call = new URLSearchParams(calls.find((c) => c.url.endsWith("Calls.json"))!.body);
    expect(call.get("Twiml")).toContain("<Say");
    // No patient details in any message.
    for (const c of calls.filter((c) => !c.url.includes("openrouter"))) expect(c.body).not.toMatch(/Fletcher|Potassium|5\.1/);

    // Same PDF again (new message id): served from the cache, no second AI call.
    const aiCallsBefore = calls.filter((c) => c.url.includes("openrouter")).length;
    const second = await send(db, "rule_match");
    expect(second.summary.extraction?.source).toBe("cache");
    expect(calls.filter((c) => c.url.includes("openrouter")).length).toBe(aiCallsBefore);
  });

  it("records a failed send without stopping the pipeline", async () => {
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: "ACtest", TWILIO_AUTH_TOKEN: "token", TWILIO_FROM_NUMBER: "+17372508034" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: 21608, message: "The number is unverified" }, { status: 400 })));
    const db = freshDb({ demoGpEmail: null, demoGpMobile: "+61400000823" });
    setSetting(db, "live_messages", "on");
    const { summary } = await send(db, "rule_match");
    const sms = summary.notifications.find((n) => n.channel === "sms")!;
    expect(sms.status).toBe("failed");
    expect(sms.detail).toContain("21608");
  });
});
