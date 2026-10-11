// Read models for the GP app and the practice dashboard.
import type { DatabaseSync } from "node:sqlite";
import { positionInRange, type RangePosition } from "./checks/range";
import { COULDNT_CHECK_LABELS, type AlertReason, type CouldntCheckReason } from "./checks/types";
import { liveMessagesOn } from "./db/settings";
import { aiConfigured } from "./extraction/ai";
import { emailConfigured, twilioConfigured } from "./notify/providers";

const json = <T>(s: string | null): T => (s ? JSON.parse(s) : null) as T;

// ---------- Clinicians ----------

export interface ClinicianSummary {
  id: string;
  name: string;
  unseen: number;
  away: boolean;
}

export function listClinicians(db: DatabaseSync): ClinicianSummary[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.away,
              (SELECT COUNT(*) FROM alerts a WHERE a.recipient_clinician_id = c.id AND a.seen_at IS NULL) AS unseen
       FROM clinicians c ORDER BY c.name`,
    )
    .all() as { id: string; name: string; away: number; unseen: number }[];
  return rows.map((r) => ({ id: r.id, name: r.name, unseen: r.unseen, away: r.away === 1 }));
}

export interface ClinicianSettings {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  notifyApp: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyVoice: boolean;
  away: boolean;
  coveringClinicianId: string | null;
  colleagues: { id: string; name: string; away: boolean }[];
  liveMessages: boolean;
}

export function getClinicianSettings(db: DatabaseSync, id: string): ClinicianSettings | null {
  const c = db.prepare("SELECT * FROM clinicians WHERE id = ?").get(id) as
    | { id: string; name: string; email: string | null; mobile: string | null; notify_app: number; notify_email: number; notify_sms: number; notify_voice: number; away: number; covering_clinician_id: string | null }
    | undefined;
  if (!c) return null;
  const colleagues = (db.prepare("SELECT id, name, away FROM clinicians WHERE id != ? ORDER BY name").all(id) as { id: string; name: string; away: number }[]).map(
    (x) => ({ id: x.id, name: x.name, away: x.away === 1 }),
  );
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    mobile: c.mobile,
    notifyApp: c.notify_app === 1,
    notifyEmail: c.notify_email === 1,
    notifySms: c.notify_sms === 1,
    notifyVoice: c.notify_voice === 1,
    away: c.away === 1,
    coveringClinicianId: c.covering_clinician_id,
    colleagues,
    liveMessages: liveMessagesOn(db),
  };
}

// ---------- Alerts ----------

export interface AlertListItem {
  id: string;
  createdAt: string;
  seenAt: string | null;
  reasons: AlertReason[];
  patient: { id: string; name: string };
  result: { testName: string; value: string; unit: string | null; labFlag: string | null; checkStatus: string };
  handedOverFrom: { id: string; name: string } | null;
  recipient: { id: string; name: string };
  reportId: string;
}

const ALERT_SELECT = `
  SELECT a.id, a.created_at, a.seen_at, a.reasons, a.report_id,
         p.id AS patient_id, p.display_name AS patient_name,
         r.test_name_raw, r.value_raw, r.unit_raw, r.lab_flag_raw, r.check_status,
         rc.id AS recipient_id, rc.name AS recipient_name,
         oc.id AS original_id, oc.name AS original_name
  FROM alerts a
  JOIN patients p ON p.id = a.patient_id
  JOIN results r ON r.id = a.result_id
  JOIN clinicians rc ON rc.id = a.recipient_clinician_id
  JOIN clinicians oc ON oc.id = a.original_clinician_id`;

interface AlertRow {
  id: string; created_at: string; seen_at: string | null; reasons: string; report_id: string;
  patient_id: string; patient_name: string;
  test_name_raw: string; value_raw: string; unit_raw: string | null; lab_flag_raw: string | null; check_status: string;
  recipient_id: string; recipient_name: string; original_id: string; original_name: string;
}

function toAlertItem(r: AlertRow): AlertListItem {
  return {
    id: r.id,
    createdAt: r.created_at,
    seenAt: r.seen_at,
    reasons: json<AlertReason[]>(r.reasons),
    patient: { id: r.patient_id, name: r.patient_name },
    result: { testName: r.test_name_raw, value: r.value_raw, unit: r.unit_raw, labFlag: r.lab_flag_raw || null, checkStatus: r.check_status },
    handedOverFrom: r.original_id !== r.recipient_id ? { id: r.original_id, name: r.original_name } : null,
    recipient: { id: r.recipient_id, name: r.recipient_name },
    reportId: r.report_id,
  };
}

export function listAlerts(db: DatabaseSync, clinicianId: string): AlertListItem[] {
  const rows = db
    .prepare(`${ALERT_SELECT} WHERE a.recipient_clinician_id = ? ORDER BY (a.seen_at IS NOT NULL), a.created_at DESC LIMIT 100`)
    .all(clinicianId) as unknown as AlertRow[];
  return rows.map(toAlertItem);
}

export interface AlertDetail extends AlertListItem {
  result: AlertListItem["result"] & {
    id: string;
    testTypeId: string | null;
    valueNumber: number | null;
    range: string | null;
    labFlagged: boolean;
    labComment: string | null;
    couldntCheckReason: CouldntCheckReason | null;
    couldntCheckLabel: string | null;
    ruleLimitationLabel: string | null;
    collectedAt: string;
  };
  rangePosition: RangePosition | null;
  matchedRules: { id: string; direction: "above" | "below"; threshold: number; unit: string; ownerName: string }[];
  history: { collectedAt: string; value: number; labFlagged: boolean; isThis: boolean }[];
  report: {
    id: string;
    labName: string;
    fileUrl: string | null;
    extractionSource: string | null;
    extractionNote: string | null;
    nameOnReport: string | null;
    nameMatches: boolean | null;
  };
  checks: { kind: string; outcome: string; detail: string | null }[];
}

export function getAlertDetail(db: DatabaseSync, alertId: string): AlertDetail | null {
  const row = db.prepare(`${ALERT_SELECT} WHERE a.id = ?`).get(alertId) as unknown as AlertRow | undefined;
  if (!row) return null;
  const base = toAlertItem(row);

  const extra = db
    .prepare(
      `SELECT r.id, r.test_type_id, r.value, r.range_raw, r.range_low, r.range_high, r.range_low_inclusive, r.range_high_inclusive,
              r.lab_flagged, r.lab_comment, r.couldnt_check_reason, r.rule_limitation, r.collected_at, a.rule_ids, a.patient_id,
              rep.id AS report_id, rep.lab_name, rep.file_name, rep.extraction_source, rep.extraction_note,
              rep.patient_name_on_report, rep.patient_name_matches
       FROM alerts a JOIN results r ON r.id = a.result_id JOIN reports rep ON rep.id = a.report_id WHERE a.id = ?`,
    )
    .get(alertId) as {
      id: string; test_type_id: string | null; value: number | null; range_raw: string | null; range_low: number | null; range_high: number | null;
      range_low_inclusive: number; range_high_inclusive: number; lab_flagged: number; lab_comment: string | null;
      couldnt_check_reason: CouldntCheckReason | null; rule_limitation: CouldntCheckReason | null; collected_at: string; rule_ids: string; patient_id: string;
      report_id: string; lab_name: string; file_name: string | null; extraction_source: string | null; extraction_note: string | null;
      patient_name_on_report: string | null; patient_name_matches: number | null;
    };

  const rangePosition =
    extra.value !== null && (extra.range_low !== null || extra.range_high !== null)
      ? positionInRange(extra.value, {
          low: extra.range_low,
          high: extra.range_high,
          lowInclusive: extra.range_low_inclusive === 1,
          highInclusive: extra.range_high_inclusive === 1,
        })
      : null;

  const ruleIds = json<string[]>(extra.rule_ids);
  const matchedRules = ruleIds.length
    ? (db
        .prepare(
          `SELECT ru.id, ru.direction, ru.threshold, ru.unit, c.name AS owner_name FROM rules ru JOIN clinicians c ON c.id = ru.clinician_id
           WHERE ru.id IN (${ruleIds.map(() => "?").join(",")})`,
        )
        .all(...ruleIds) as { id: string; direction: "above" | "below"; threshold: number; unit: string; owner_name: string }[]).map((r) => ({
        id: r.id, direction: r.direction, threshold: r.threshold, unit: r.unit, ownerName: r.owner_name,
      }))
    : [];

  const history = extra.test_type_id
    ? (db
        .prepare(
          `SELECT id, collected_at, value, lab_flagged FROM results
           WHERE patient_id = ? AND test_type_id = ? AND value IS NOT NULL ORDER BY collected_at DESC, created_at DESC LIMIT 8`,
        )
        .all(extra.patient_id, extra.test_type_id) as { id: string; collected_at: string; value: number; lab_flagged: number }[])
        .reverse()
        .map((h) => ({ collectedAt: h.collected_at, value: h.value, labFlagged: h.lab_flagged === 1, isThis: h.id === extra.id }))
    : [];

  const checks = db
    .prepare("SELECT kind, outcome, detail FROM checks WHERE result_id = ? ORDER BY id")
    .all(extra.id) as { kind: string; outcome: string; detail: string | null }[];

  return {
    ...base,
    result: {
      ...base.result,
      id: extra.id,
      testTypeId: extra.test_type_id,
      valueNumber: extra.value,
      range: extra.range_raw,
      labFlagged: extra.lab_flagged === 1,
      labComment: extra.lab_comment,
      couldntCheckReason: extra.couldnt_check_reason,
      couldntCheckLabel: extra.couldnt_check_reason ? COULDNT_CHECK_LABELS[extra.couldnt_check_reason] : null,
      ruleLimitationLabel: extra.rule_limitation ? COULDNT_CHECK_LABELS[extra.rule_limitation] : null,
      collectedAt: extra.collected_at,
    },
    rangePosition,
    matchedRules,
    history,
    report: {
      id: extra.report_id,
      labName: extra.lab_name,
      fileUrl: extra.file_name ? `/api/reports/${extra.report_id}/file` : null,
      extractionSource: extra.extraction_source,
      extractionNote: extra.extraction_note,
      nameOnReport: extra.patient_name_on_report,
      nameMatches: extra.patient_name_matches === null ? null : extra.patient_name_matches === 1,
    },
    checks: checks.map((c) => ({ ...c })),
  };
}

// ---------- Patients, tests and rules ----------

export interface PatientSummary {
  id: string;
  name: string;
  sex: string;
  dateOfBirth: string;
  practiceRef: string;
  usualGp: { id: string; name: string } | null;
  activeRules: number;
  lastResultAt: string | null;
}

export function listPatients(db: DatabaseSync): PatientSummary[] {
  const now = new Date().toISOString();
  const rows = db
    .prepare(
      `SELECT p.id, p.display_name, p.sex, p.date_of_birth, p.practice_ref, c.id AS gp_id, c.name AS gp_name,
              (SELECT COUNT(*) FROM rules r WHERE r.patient_id = p.id AND r.ended_at IS NULL AND r.ends_at > ?) AS active_rules,
              (SELECT MAX(collected_at) FROM results r WHERE r.patient_id = p.id) AS last_result_at
       FROM patients p LEFT JOIN clinicians c ON c.id = p.usual_clinician_id ORDER BY p.display_name`,
    )
    .all(now) as {
      id: string; display_name: string; sex: string; date_of_birth: string; practice_ref: string;
      gp_id: string | null; gp_name: string | null; active_rules: number; last_result_at: string | null;
    }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.display_name,
    sex: r.sex,
    dateOfBirth: r.date_of_birth,
    practiceRef: r.practice_ref,
    usualGp: r.gp_id ? { id: r.gp_id, name: r.gp_name! } : null,
    activeRules: r.active_rules,
    lastResultAt: r.last_result_at,
  }));
}

export interface RuleView {
  id: string;
  testTypeId: string;
  testName: string;
  direction: "above" | "below";
  threshold: number;
  unit: string;
  note: string | null;
  owner: { id: string; name: string };
  startsAt: string;
  endsAt: string;
  endedAt: string | null;
  status: "active" | "expired" | "ended";
  version: number;
}

export interface TestForRules {
  id: string;
  name: string;
  unit: string;
  /** The patient's latest printed range for this test, if any. */
  latestRange: string | null;
  /** Shown, clearly labelled, only when there's no printed range for this patient. */
  illustrativeRange: string;
  latest: { value: string; collectedAt: string; labFlagged: boolean } | null;
}

export interface PatientDetail extends PatientSummary {
  rules: RuleView[];
  tests: TestForRules[];
}

export function getPatientDetail(db: DatabaseSync, patientId: string): PatientDetail | null {
  const summary = listPatients(db).find((p) => p.id === patientId);
  if (!summary) return null;
  const now = new Date().toISOString();

  const rules = (db
    .prepare(
      `SELECT ru.*, t.name AS test_name, c.name AS owner_name FROM rules ru
       JOIN test_types t ON t.id = ru.test_type_id JOIN clinicians c ON c.id = ru.clinician_id
       WHERE ru.patient_id = ? ORDER BY ru.ended_at IS NOT NULL, ru.ends_at <= ?, ru.created_at DESC`,
    )
    .all(patientId, now) as {
      id: string; test_type_id: string; test_name: string; direction: "above" | "below"; threshold: number; unit: string; note: string | null;
      clinician_id: string; owner_name: string; starts_at: string; ends_at: string; ended_at: string | null; version: number;
    }[]).map((r): RuleView => ({
    id: r.id,
    testTypeId: r.test_type_id,
    testName: r.test_name,
    direction: r.direction,
    threshold: r.threshold,
    unit: r.unit,
    note: r.note,
    owner: { id: r.clinician_id, name: r.owner_name },
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    endedAt: r.ended_at,
    status: r.ended_at ? "ended" : r.ends_at <= now ? "expired" : "active",
    version: r.version,
  }));

  const sex = summary.sex as "F" | "M";
  const tests = (db.prepare("SELECT id, name, unit, illustrative_ranges FROM test_types ORDER BY sort_order").all() as {
    id: string; name: string; unit: string; illustrative_ranges: string;
  }[]).map((t): TestForRules => {
    const latest = db
      .prepare(
        `SELECT value_raw, range_raw, collected_at, lab_flagged FROM results
         WHERE patient_id = ? AND test_type_id = ? ORDER BY collected_at DESC, created_at DESC LIMIT 1`,
      )
      .get(patientId, t.id) as { value_raw: string; range_raw: string | null; collected_at: string; lab_flagged: number } | undefined;
    const ranges = json<Record<string, string>>(t.illustrative_ranges);
    return {
      id: t.id,
      name: t.name,
      unit: t.unit,
      latestRange: latest?.range_raw ?? null,
      illustrativeRange: ranges[sex] ?? ranges.any ?? "",
      latest: latest ? { value: latest.value_raw, collectedAt: latest.collected_at, labFlagged: latest.lab_flagged === 1 } : null,
    };
  });

  return { ...summary, rules, tests };
}

export function listTestTypes(db: DatabaseSync): { id: string; name: string; unit: string }[] {
  return db.prepare("SELECT id, name, unit FROM test_types ORDER BY sort_order").all() as { id: string; name: string; unit: string }[];
}

// ---------- Reports ----------

export interface ReportView {
  id: string;
  sourceMessageId: string;
  origin: string;
  status: string;
  labName: string;
  receivedAt: string;
  patient: { id: string; name: string };
  requestingGp: { id: string; name: string };
  fileUrl: string | null;
  extraction: { source: string | null; model: string | null; costUsd: number | null; note: string | null };
  patientCheck: { nameOnReport: string | null; matches: boolean | null };
  results: {
    id: string;
    testName: string;
    value: string;
    unit: string | null;
    range: string | null;
    labFlag: string | null;
    labComment: string | null;
    checkStatus: string;
    couldntCheckLabel: string | null;
    ruleLimitationLabel: string | null;
    checks: { kind: string; outcome: string; detail: string | null }[];
  }[];
  alerts: number;
}

export function getReport(db: DatabaseSync, reportId: string): ReportView | null {
  const r = db
    .prepare(
      `SELECT rep.*, p.display_name AS patient_name, c.name AS gp_name FROM reports rep
       JOIN patients p ON p.id = rep.patient_id JOIN clinicians c ON c.id = rep.requesting_clinician_id WHERE rep.id = ?`,
    )
    .get(reportId) as
    | {
        id: string; source_message_id: string; origin: string; status: string; lab_name: string; received_at: string;
        patient_id: string; patient_name: string; requesting_clinician_id: string; gp_name: string; file_name: string | null;
        extraction_source: string | null; extraction_model: string | null; extraction_cost_usd: number | null; extraction_note: string | null;
        patient_name_on_report: string | null; patient_name_matches: number | null;
      }
    | undefined;
  if (!r) return null;
  const results = (db.prepare("SELECT * FROM results WHERE report_id = ? ORDER BY created_at, rowid").all(reportId) as {
    id: string; test_name_raw: string; value_raw: string; unit_raw: string | null; range_raw: string | null; lab_flag_raw: string | null;
    lab_comment: string | null; check_status: string; couldnt_check_reason: CouldntCheckReason | null; rule_limitation: CouldntCheckReason | null;
  }[]).map((x) => ({
    id: x.id,
    testName: x.test_name_raw,
    value: x.value_raw,
    unit: x.unit_raw,
    range: x.range_raw,
    labFlag: x.lab_flag_raw || null,
    labComment: x.lab_comment,
    checkStatus: x.check_status,
    couldntCheckLabel: x.couldnt_check_reason ? COULDNT_CHECK_LABELS[x.couldnt_check_reason] : null,
    ruleLimitationLabel: x.rule_limitation ? COULDNT_CHECK_LABELS[x.rule_limitation] : null,
    checks: db.prepare("SELECT kind, outcome, detail FROM checks WHERE result_id = ? ORDER BY id").all(x.id) as { kind: string; outcome: string; detail: string | null }[],
  }));
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM alerts WHERE report_id = ?").get(reportId) as { n: number };
  return {
    id: r.id,
    sourceMessageId: r.source_message_id,
    origin: r.origin,
    status: r.status,
    labName: r.lab_name,
    receivedAt: r.received_at,
    patient: { id: r.patient_id, name: r.patient_name },
    requestingGp: { id: r.requesting_clinician_id, name: r.gp_name },
    fileUrl: r.file_name ? `/api/reports/${r.id}/file` : null,
    extraction: { source: r.extraction_source, model: r.extraction_model, costUsd: r.extraction_cost_usd, note: r.extraction_note },
    patientCheck: { nameOnReport: r.patient_name_on_report, matches: r.patient_name_matches === null ? null : r.patient_name_matches === 1 },
    results,
    alerts: n,
  };
}

export function getReportFileName(db: DatabaseSync, reportId: string): string | null {
  const r = db.prepare("SELECT file_name FROM reports WHERE id = ?").get(reportId) as { file_name: string | null } | undefined;
  return r?.file_name ?? null;
}

// ---------- Dashboard ----------

export interface DashboardFeed {
  stats: { reports: number; alerts: number; unseen: number; couldntCheck: number; aiCostUsd: number; aiReads: number; cacheHits: number };
  liveMessages: boolean;
  providers: { ai: boolean; email: boolean; twilio: boolean };
  reports: { id: string; receivedAt: string; patientName: string; gpName: string; origin: string; status: string; extractionSource: string | null; nameMatches: boolean | null; results: number; alerts: number }[];
  alerts: AlertListItem[];
  notifications: { id: string; createdAt: string; channel: string; status: string; recipient: string | null; detail: string | null; gpName: string }[];
  audit: { id: number; at: string; actor: string; action: string; entityType: string | null; detail: string | null }[];
}

export function getDashboardFeed(db: DatabaseSync): DashboardFeed {
  const one = (sql: string) => (db.prepare(sql).get() as { n: number | null }).n ?? 0;
  return {
    stats: {
      reports: one("SELECT COUNT(*) AS n FROM reports WHERE origin != 'history'"),
      alerts: one("SELECT COUNT(*) AS n FROM alerts"),
      unseen: one("SELECT COUNT(*) AS n FROM alerts WHERE seen_at IS NULL"),
      couldntCheck: one("SELECT COUNT(*) AS n FROM results WHERE check_status = 'couldnt_check'"),
      aiCostUsd: one("SELECT SUM(extraction_cost_usd) AS n FROM reports WHERE extraction_source = 'ai'"),
      aiReads: one("SELECT COUNT(*) AS n FROM reports WHERE extraction_source = 'ai'"),
      cacheHits: one("SELECT COUNT(*) AS n FROM reports WHERE extraction_source = 'cache'"),
    },
    liveMessages: liveMessagesOn(db),
    providers: { ai: aiConfigured(), email: emailConfigured(), twilio: twilioConfigured() },
    reports: (db
      .prepare(
        `SELECT rep.id, rep.received_at, rep.origin, rep.status, rep.extraction_source, rep.patient_name_matches, p.display_name AS patient_name, c.name AS gp_name,
                (SELECT COUNT(*) FROM results r WHERE r.report_id = rep.id) AS results,
                (SELECT COUNT(*) FROM alerts a WHERE a.report_id = rep.id) AS alerts
         FROM reports rep JOIN patients p ON p.id = rep.patient_id JOIN clinicians c ON c.id = rep.requesting_clinician_id
         WHERE rep.origin != 'history' ORDER BY rep.received_at DESC LIMIT 20`,
      )
      .all() as {
        id: string; received_at: string; origin: string; status: string; extraction_source: string | null; patient_name_matches: number | null;
        patient_name: string; gp_name: string; results: number; alerts: number;
      }[]).map((r) => ({
      id: r.id,
      receivedAt: r.received_at,
      patientName: r.patient_name,
      gpName: r.gp_name,
      origin: r.origin,
      status: r.status,
      extractionSource: r.extraction_source,
      nameMatches: r.patient_name_matches === null ? null : r.patient_name_matches === 1,
      results: r.results,
      alerts: r.alerts,
    })),
    alerts: (db.prepare(`${ALERT_SELECT} ORDER BY a.created_at DESC LIMIT 30`).all() as unknown as AlertRow[]).map(toAlertItem),
    notifications: (db
      .prepare(
        `SELECT n.id, n.created_at, n.channel, n.status, n.recipient_masked, n.error, c.name AS gp_name
         FROM notifications n JOIN alerts a ON a.id = n.alert_id JOIN clinicians c ON c.id = a.recipient_clinician_id
         ORDER BY n.created_at DESC, n.rowid DESC LIMIT 30`,
      )
      .all() as { id: string; created_at: string; channel: string; status: string; recipient_masked: string | null; error: string | null; gp_name: string }[]).map((n) => ({
      id: n.id, createdAt: n.created_at, channel: n.channel, status: n.status, recipient: n.recipient_masked, detail: n.error, gpName: n.gp_name,
    })),
    audit: (db.prepare("SELECT id, at, actor, action, entity_type, detail FROM audit_events ORDER BY id DESC LIMIT 50").all() as {
      id: number; at: string; actor: string; action: string; entity_type: string | null; detail: string | null;
    }[]).map((a) => ({ id: a.id, at: a.at, actor: a.actor, action: a.action, entityType: a.entity_type, detail: a.detail })),
  };
}
