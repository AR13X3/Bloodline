// Receive report -> ignore duplicates -> store PDF -> read (cache/AI) ->
// validate -> three checks -> route -> alert -> notify -> audit.
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { evaluateResult } from "../checks/evaluate";
import { namesMatch } from "../checks/patient";
import { planAlerts, type ClinicianAvailability } from "../checks/routing";
import type { ActiveRule, AlertReason, ExtractedResult, TestTypeRef, ValidatedResult } from "../checks/types";
import { validateResult } from "../checks/validate";
import { reportsDir, transaction } from "../db";
import { audit } from "../db/audit";
import { emit, type PipelineStep } from "../events";
import { extractReport } from "../extraction";
import { notifyRecipient, type NotificationOutcome } from "../notify";

export interface IngestInput {
  pdf: Uint8Array;
  fileName: string;
  origin: "simulator" | "upload";
  sourceMessageId: string;
  patientId: string;
  requestingClinicianId: string;
  labName: string;
  collectedAt: string;
  /** Simulator only: what was printed, used as a labelled fallback if AI reading is unavailable. */
  sourceRows?: ExtractedResult[];
  sourcePatientName?: string;
  actor?: string;
}

export interface ExtractionInfo {
  source: "cache" | "ai" | "fallback" | "failed";
  model: string | null;
  costUsd: number | null;
  note: string | null;
}

export interface IngestSummary {
  status: "processed" | "duplicate";
  reportId: string | null;
  extraction?: ExtractionInfo;
  patientCheck?: { nameOnReport: string | null; filedAs: string; matches: boolean | null };
  results: { id: string; testName: string; value: string; checkStatus: string; couldntCheckReason: string | null; ruleLimitation: string | null }[];
  alerts: { id: string; recipientId: string; originalId: string; reasons: AlertReason[]; resultId: string }[];
  notifications: (NotificationOutcome & { recipientId: string })[];
}

export function loadTestTypes(db: DatabaseSync): TestTypeRef[] {
  const rows = db.prepare("SELECT id, name, unit, name_aliases, unit_aliases FROM test_types").all() as {
    id: string; name: string; unit: string; name_aliases: string; unit_aliases: string;
  }[];
  return rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, nameAliases: JSON.parse(r.name_aliases), unitAliases: JSON.parse(r.unit_aliases) }));
}

export function loadActiveRules(db: DatabaseSync, patientId: string, at: string): ActiveRule[] {
  const rows = db
    .prepare(
      `SELECT id, clinician_id, test_type_id, direction, threshold FROM rules
       WHERE patient_id = ? AND ended_at IS NULL AND starts_at <= ? AND ends_at > ?`,
    )
    .all(patientId, at, at) as { id: string; clinician_id: string; test_type_id: string; direction: "above" | "below"; threshold: number }[];
  return rows.map((r) => ({ id: r.id, clinicianId: r.clinician_id, testTypeId: r.test_type_id, direction: r.direction, threshold: r.threshold }));
}

function loadAvailability(db: DatabaseSync): Map<string, ClinicianAvailability> {
  const rows = db.prepare("SELECT id, away, covering_clinician_id FROM clinicians").all() as { id: string; away: number; covering_clinician_id: string | null }[];
  return new Map(rows.map((r) => [r.id, { id: r.id, away: r.away === 1, coveringClinicianId: r.covering_clinician_id }]));
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed: reports\.source_message_id/.test(err.message);
}

export async function ingestReport(db: DatabaseSync, input: IngestInput): Promise<IngestSummary> {
  const actor = input.actor ?? "simulator";
  const step = (s: PipelineStep, reportId: string | null, detail?: Record<string, unknown>) =>
    emit({ type: "pipeline", step: s, sourceMessageId: input.sourceMessageId, reportId, detail });

  step("received", null, { origin: input.origin });

  const duplicate = () => {
    audit(db, { actor, action: "report.duplicate_ignored", entityType: "report", detail: { sourceMessageId: input.sourceMessageId } });
    step("duplicate", null);
    return { status: "duplicate" as const, reportId: null, results: [], alerts: [], notifications: [] };
  };
  if (db.prepare("SELECT 1 FROM reports WHERE source_message_id = ?").get(input.sourceMessageId)) return duplicate();

  // Store the PDF under its hash (same file, same name).
  const fileHash = createHash("sha256").update(input.pdf).digest("hex");
  const storedName = `${fileHash}.pdf`;
  const dir = reportsDir();
  mkdirSync(dir, { recursive: true });
  const storedPath = path.join(dir, storedName);
  if (!existsSync(storedPath)) writeFileSync(storedPath, input.pdf);

  const reportId = randomUUID();
  const receivedAt = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO reports (id, source_message_id, patient_id, requesting_clinician_id, lab_name, collected_at,
                            received_at, origin, file_name, file_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)`,
    ).run(reportId, input.sourceMessageId, input.patientId, input.requestingClinicianId, input.labName, input.collectedAt, receivedAt, input.origin, storedName, fileHash, receivedAt);
  } catch (err) {
    if (isUniqueViolation(err)) return duplicate();
    throw err;
  }
  audit(db, { actor, action: "report.received", entityType: "report", entityId: reportId, detail: { origin: input.origin, sourceMessageId: input.sourceMessageId } });

  // Read the report.
  step("reading", reportId);
  const extraction = await extractReport(db, {
    fileHash,
    pdf: input.pdf,
    fileName: input.fileName,
    sourceRows: input.sourceRows,
    sourcePatientName: input.sourcePatientName,
  });
  const extractionInfo: ExtractionInfo =
    extraction.source === "failed"
      ? { source: "failed", model: null, costUsd: null, note: extraction.error }
      : extraction.source === "fallback"
        ? { source: "fallback", model: null, costUsd: null, note: `AI unavailable (${extraction.reason}). Used the simulator's printed values.` }
        : { source: extraction.source, model: extraction.model, costUsd: extraction.costUsd, note: null };
  db.prepare(
    `UPDATE reports SET status = ?, extraction_source = ?, extraction_model = ?, extraction_cost_usd = ?, extraction_note = ?, error = ?
     WHERE id = ?`,
  ).run(
    extraction.source === "failed" ? "couldnt_read" : "read",
    extraction.source === "failed" ? null : extraction.source,
    extractionInfo.model,
    extractionInfo.costUsd,
    extractionInfo.note,
    extraction.source === "failed" ? extraction.error : null,
    reportId,
  );
  audit(db, { actor: "system", action: `extraction.${extraction.source}`, entityType: "report", entityId: reportId, detail: extractionInfo });

  // Warn (never re-route) if the name on the report isn't the patient it was filed against.
  const filedAs = (db.prepare("SELECT display_name FROM patients WHERE id = ?").get(input.patientId) as { display_name: string }).display_name;
  const nameOnReport = extraction.source === "failed" ? null : extraction.patientName;
  const patientCheck = { nameOnReport, filedAs, matches: namesMatch(nameOnReport, filedAs) };
  db.prepare("UPDATE reports SET patient_name_on_report = ?, patient_name_matches = ? WHERE id = ?").run(
    nameOnReport,
    patientCheck.matches === null ? null : patientCheck.matches ? 1 : 0,
    reportId,
  );
  if (patientCheck.matches === false) {
    audit(db, { actor: "system", action: "report.patient_name_mismatch", entityType: "report", entityId: reportId, detail: { filedAs } });
  }
  step("read", reportId, {
    ...extractionInfo,
    count: extraction.source === "failed" ? 0 : extraction.results.length,
    patientNameMatches: patientCheck.matches,
  });

  // Validate, check and plan alerts.
  const testTypes = loadTestTypes(db);
  const now = new Date().toISOString();
  const rules = loadActiveRules(db, input.patientId, now);
  const availability = loadAvailability(db);

  const validated: ValidatedResult[] =
    extraction.source === "failed"
      ? [{
          status: "couldnt_check",
          reason: "extraction_failed",
          extracted: { testName: "Report could not be read", value: "", unit: null, referenceRange: null, labFlag: null, labComment: null },
          testTypeId: null,
          labFlagged: false,
          value: null,
          range: null,
        }]
      : extraction.results.map((r) => validateResult(r, testTypes));

  const summary: IngestSummary = { status: "processed", reportId, extraction: extractionInfo, patientCheck, results: [], alerts: [], notifications: [] };

  transaction(db, () => {
    const insertResult = db.prepare(
      `INSERT INTO results (id, report_id, patient_id, test_type_id, test_name_raw, value_raw, value, unit_raw, range_raw,
                            range_low, range_high, range_low_inclusive, range_high_inclusive, lab_flag_raw, lab_flagged,
                            lab_comment, check_status, couldnt_check_reason, rule_limitation, collected_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertCheck = db.prepare(
      "INSERT INTO checks (result_id, kind, rule_id, outcome, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const insertAlert = db.prepare(
      `INSERT INTO alerts (id, result_id, report_id, patient_id, recipient_clinician_id, original_clinician_id, reasons, rule_ids, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const v of validated) {
      const resultId = randomUUID();
      const e = v.extracted;
      insertResult.run(
        resultId, reportId, input.patientId, v.testTypeId, e.testName, e.value, v.value, e.unit, e.referenceRange,
        v.range?.low ?? null, v.range?.high ?? null, v.range ? (v.range.lowInclusive ? 1 : 0) : 1, v.range ? (v.range.highInclusive ? 1 : 0) : 1,
        e.labFlag, v.labFlagged ? 1 : 0, e.labComment, v.status, v.status === "couldnt_check" ? v.reason : null,
        v.status === "checked" ? v.limitation : null, input.collectedAt, now,
      );
      summary.results.push({
        id: resultId,
        testName: e.testName,
        value: e.value,
        checkStatus: v.status,
        couldntCheckReason: v.status === "couldnt_check" ? v.reason : null,
        ruleLimitation: v.status === "checked" ? v.limitation : null,
      });

      const evaluation = evaluateResult(v, rules);
      for (const c of evaluation.checks) insertCheck.run(resultId, c.kind, c.ruleId ?? null, c.outcome, c.detail, now);

      for (const plan of planAlerts(evaluation, input.requestingClinicianId, availability)) {
        const alertId = randomUUID();
        insertAlert.run(alertId, resultId, reportId, input.patientId, plan.recipientId, plan.originalId, JSON.stringify(plan.reasons), JSON.stringify(plan.ruleIds), now);
        summary.alerts.push({ id: alertId, recipientId: plan.recipientId, originalId: plan.originalId, reasons: plan.reasons, resultId });
        audit(db, { actor: "system", action: "alert.created", entityType: "alert", entityId: alertId, detail: { recipient: plan.recipientId, original: plan.originalId, reasons: plan.reasons } }, now);
        if (plan.handoverUnavailable) {
          audit(db, { actor: "system", action: "alert.handover_unavailable", entityType: "alert", entityId: alertId, detail: { gp: plan.originalId } }, now);
        }
      }
    }
    db.prepare("UPDATE reports SET status = ? WHERE id = ?").run(extraction.source === "failed" ? "couldnt_read" : "checked", reportId);
  });

  step("checked", reportId, {
    results: summary.results.length,
    couldntCheck: summary.results.filter((r) => r.checkStatus === "couldnt_check").length,
  });
  for (const a of summary.alerts) emit({ type: "alert.created", alertId: a.id, recipientId: a.recipientId, reasons: a.reasons });
  step("alerted", reportId, { alerts: summary.alerts.length });

  // One nudge per GP per report, however many results alerted.
  const byRecipient = new Map<string, { firstAlertId: string; count: number }>();
  for (const a of summary.alerts) {
    const entry = byRecipient.get(a.recipientId);
    if (entry) entry.count += 1;
    else byRecipient.set(a.recipientId, { firstAlertId: a.id, count: 1 });
  }
  for (const [recipientId, { firstAlertId, count }] of byRecipient) {
    const outcomes = await notifyRecipient(db, { clinicianId: recipientId, alertId: firstAlertId, resultCount: count, sourceMessageId: input.sourceMessageId });
    summary.notifications.push(...outcomes.map((o) => ({ ...o, recipientId })));
  }
  if (byRecipient.size > 0) step("notified", reportId, { notifications: summary.notifications.length });

  step("done", reportId, { alerts: summary.alerts.length });
  return summary;
}
