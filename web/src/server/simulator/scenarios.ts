// Preset synthetic reports for the presenter. Each one demonstrates one
// behaviour. Values are demo values, not clinical guidance.
import type { DatabaseSync } from "node:sqlite";
import { parsePrintedRange, positionInRange } from "../checks/range";
import type { ExtractedResult } from "../checks/types";
import { SYNTHETIC_LAB_NAME, illustrativeRangeFor } from "../db/seed";
import type { SyntheticReport, SyntheticReportRow } from "../reports/pdf";

export type ScenarioId = "normal" | "lab_flagged" | "rule_match" | "range_only" | "couldnt_check";

interface ScenarioRow {
  testId: string;
  value: string;
  /** Override the flag the lab prints. By default it follows the printed range. */
  flag?: string;
}

interface Scenario {
  id: ScenarioId;
  title: string;
  description: string;
  expected: string;
  patientId: string;
  panelName: string;
  labReference: string;
  rows: ScenarioRow[];
  comment: string | null;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "normal",
    title: "Normal result",
    description: "Everything inside the printed ranges, no lab flags.",
    expected: "No alert. The check is still logged.",
    patientId: "pt_walker",
    panelName: "Electrolytes",
    labReference: "HP-26-10421",
    rows: [
      { testId: "NA", value: "140" },
      { testId: "K", value: "4.3" },
    ],
    comment: null,
  },
  {
    id: "lab_flagged",
    title: "Lab flagged result",
    description: "Haemoglobin and ferritin below range, flagged by the lab.",
    expected: "Alert to the requesting GP: lab flag and outside the printed range.",
    patientId: "pt_nguyen",
    panelName: "Full blood count and iron studies",
    labReference: "HP-26-10422",
    rows: [
      { testId: "HB", value: "118" },
      { testId: "FERR", value: "12" },
    ],
    comment: "Low haemoglobin with low ferritin. Suggest clinical correlation and repeat FBC in 6 weeks.",
  },
  {
    id: "rule_match",
    title: "Matches a GP rule",
    description: "Potassium 5.1: inside the printed range and not flagged, but above the GP's rule.",
    expected: "Alert to Dr Chen from Dr Chen's own rule only.",
    patientId: "pt_fletcher",
    panelName: "Electrolytes",
    labReference: "HP-26-10423",
    rows: [
      { testId: "K", value: "5.1" },
      { testId: "NA", value: "138" },
    ],
    comment: null,
  },
  {
    id: "range_only",
    title: "Outside range, not flagged",
    description: "eGFR below the printed range, but the lab printed no flag.",
    expected: "Alert: outside the printed range. Lab flag and BloodLine check shown side by side.",
    patientId: "pt_ellis",
    panelName: "Kidney function",
    labReference: "HP-26-10424",
    rows: [
      { testId: "CREAT", value: "88" },
      { testId: "EGFR", value: "52", flag: "" },
    ],
    comment: null,
  },
  {
    id: "couldnt_check",
    title: "Can't be checked",
    description: "TSH reported as \"<0.01\", which isn't a plain number.",
    expected: "Alert: BloodLine couldn't check this result, plus the lab's flag.",
    patientId: "pt_sharma",
    panelName: "Thyroid function",
    labReference: "HP-26-10425",
    rows: [{ testId: "TSH", value: "<0.01", flag: "L" }],
    comment: "TSH below the reporting limit of 0.01 mU/L.",
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export interface BuiltScenario {
  report: SyntheticReport;
  patientId: string;
  requestingClinicianId: string;
  /** What the simulator printed, used only as a labelled fallback if OCR is unavailable. */
  sourceRows: ExtractedResult[];
}

export function buildScenarioReport(db: DatabaseSync, scenario: Scenario, now: Date = new Date()): BuiltScenario {
  const patient = db
    .prepare(
      `SELECT p.display_name AS name, p.sex, p.date_of_birth AS dob, p.practice_ref AS ref,
              c.id AS gpId, c.name AS gpName
       FROM patients p JOIN clinicians c ON c.id = p.usual_clinician_id WHERE p.id = ?`,
    )
    .get(scenario.patientId) as { name: string; sex: "F" | "M"; dob: string; ref: string; gpId: string; gpName: string } | undefined;
  if (!patient) throw new Error(`Scenario patient ${scenario.patientId} not found`);

  const tests = new Map(
    (db.prepare("SELECT id, name, unit FROM test_types").all() as { id: string; name: string; unit: string }[]).map((t) => [t.id, t]),
  );

  const rows: SyntheticReportRow[] = scenario.rows.map((r) => {
    const test = tests.get(r.testId);
    if (!test) throw new Error(`Unknown test ${r.testId}`);
    const range = illustrativeRangeFor(r.testId, patient.sex);
    let flag = r.flag;
    if (flag === undefined) {
      const parsed = parsePrintedRange(range);
      const position = parsed && /^\d/.test(r.value) ? positionInRange(Number(r.value), parsed) : "inside";
      flag = position === "above" ? "H" : position === "below" ? "L" : "";
    }
    return { testName: test.name, value: r.value, unit: test.unit, range, flag };
  });

  // Dates are fixed to the day, so re-sending the same scenario on the same
  // day produces the same PDF bytes (and a cache hit).
  const day = now.toISOString().slice(0, 10);
  const report: SyntheticReport = {
    labName: SYNTHETIC_LAB_NAME,
    labReference: scenario.labReference,
    patient: { name: patient.name, sex: patient.sex, dateOfBirth: patient.dob, practiceRef: patient.ref },
    requestingGp: patient.gpName,
    collectedAt: new Date(`${day}T07:45:00+11:00`),
    reportedAt: new Date(`${day}T11:20:00+11:00`),
    panelName: scenario.panelName,
    rows,
    comment: scenario.comment,
  };

  return {
    report,
    patientId: scenario.patientId,
    requestingClinicianId: patient.gpId,
    sourceRows: rows.map((r) => ({
      testName: r.testName,
      value: r.value,
      unit: r.unit,
      referenceRange: r.range,
      labFlag: r.flag || null,
      labComment: null,
    })),
  };
}
