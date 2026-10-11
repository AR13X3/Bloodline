// Synthetic demo data. Every person, result and rule here is made up.
// Rule values are demo values only, not clinical thresholds.
import type { DatabaseSync } from "node:sqlite";
import { parsePrintedRange, positionInRange } from "../checks/range";
import { audit } from "./audit";

export interface SeedOptions {
  /** Where the demo GP's email alerts go (must be the Resend account owner's address). */
  demoGpEmail: string | null;
  /** The demo GP's mobile in international format, for SMS and voice calls. */
  demoGpMobile: string | null;
  now?: Date;
}

export const DEMO_GP_ID = "gp_chen";
export const SYNTHETIC_LAB_NAME = "Harbourside Pathology (synthetic)";

type Sex = "F" | "M";

const CLINICIANS = [
  { id: DEMO_GP_ID, name: "Dr Amelia Chen" },
  { id: "gp_patel", name: "Dr Rohan Patel" },
  { id: "gp_okafor", name: "Dr Sarah Okafor" },
];

export const TEST_TYPES = [
  {
    id: "HB", name: "Haemoglobin", unit: "g/L", sort: 1,
    nameAliases: ["Hb", "Hemoglobin", "Haemoglobin (Hb)"],
    unitAliases: ["g/l"],
    ranges: { M: "130 - 180", F: "115 - 165" },
  },
  {
    id: "K", name: "Potassium", unit: "mmol/L", sort: 2,
    nameAliases: ["K", "K+", "Serum potassium"],
    unitAliases: ["mmol/l"],
    ranges: { any: "3.5 - 5.2" },
  },
  {
    id: "NA", name: "Sodium", unit: "mmol/L", sort: 3,
    nameAliases: ["Na", "Na+", "Serum sodium"],
    unitAliases: ["mmol/l"],
    ranges: { any: "135 - 145" },
  },
  {
    id: "CREAT", name: "Creatinine", unit: "µmol/L", sort: 4,
    nameAliases: ["Creat", "Serum creatinine"],
    unitAliases: ["umol/L", "umol/l", "μmol/L", "µmol/l"],
    ranges: { M: "60 - 110", F: "45 - 90" },
  },
  {
    id: "EGFR", name: "eGFR", unit: "mL/min/1.73m²", sort: 5,
    nameAliases: ["Estimated GFR", "eGFR (CKD-EPI)"],
    unitAliases: ["mL/min/1.73m2", "ml/min/1.73m2", "mL/min/1.73 m2", "mL/min/1.73 m²"],
    ranges: { any: "> 59" },
  },
  {
    id: "TSH", name: "TSH", unit: "mU/L", sort: 6,
    nameAliases: ["Thyroid stimulating hormone"],
    unitAliases: ["mIU/L", "mu/L"],
    ranges: { any: "0.5 - 4.0" },
  },
  {
    id: "FERR", name: "Ferritin", unit: "µg/L", sort: 7,
    nameAliases: ["Serum ferritin"],
    unitAliases: ["ug/L", "μg/L", "µg/l"],
    ranges: { M: "30 - 500", F: "30 - 300" },
  },
] as const;

const PATIENTS: { id: string; name: string; sex: Sex; dob: string; ref: string; gp: string }[] = [
  { id: "pt_nguyen", name: "Daniel Nguyen", sex: "M", dob: "1962-03-14", ref: "SYN-1001", gp: DEMO_GP_ID },
  { id: "pt_fletcher", name: "Tom Fletcher", sex: "M", dob: "1951-08-02", ref: "SYN-1002", gp: DEMO_GP_ID },
  { id: "pt_walker", name: "James Walker", sex: "M", dob: "1975-01-30", ref: "SYN-1003", gp: DEMO_GP_ID },
  { id: "pt_ellis", name: "Margaret Ellis", sex: "F", dob: "1958-11-21", ref: "SYN-1004", gp: "gp_patel" },
  { id: "pt_lee", name: "Grace Lee", sex: "F", dob: "1990-07-17", ref: "SYN-1005", gp: "gp_patel" },
  { id: "pt_sharma", name: "Priya Sharma", sex: "F", dob: "1981-05-09", ref: "SYN-1006", gp: "gp_okafor" },
];

// Earlier results, from before BloodLine was "installed". They give the app
// a history to chart and are not alerted on.
const HISTORY: { patient: string; daysAgo: number; results: [testId: string, value: number][] }[] = [
  { patient: "pt_nguyen", daysAgo: 300, results: [["HB", 141]] },
  { patient: "pt_nguyen", daysAgo: 180, results: [["HB", 137]] },
  { patient: "pt_nguyen", daysAgo: 60, results: [["HB", 133], ["FERR", 62]] },
  { patient: "pt_fletcher", daysAgo: 240, results: [["K", 4.4], ["NA", 140]] },
  { patient: "pt_fletcher", daysAgo: 120, results: [["K", 4.7], ["NA", 138]] },
  { patient: "pt_fletcher", daysAgo: 30, results: [["K", 4.9], ["NA", 139]] },
  { patient: "pt_walker", daysAgo: 100, results: [["K", 4.2], ["NA", 141], ["HB", 152]] },
  { patient: "pt_ellis", daysAgo: 270, results: [["CREAT", 82], ["EGFR", 66]] },
  { patient: "pt_ellis", daysAgo: 150, results: [["CREAT", 88], ["EGFR", 62]] },
  { patient: "pt_ellis", daysAgo: 45, results: [["CREAT", 94], ["EGFR", 57]] },
  { patient: "pt_lee", daysAgo: 120, results: [["FERR", 41], ["HB", 124]] },
  { patient: "pt_sharma", daysAgo: 200, results: [["TSH", 2.1]] },
  { patient: "pt_sharma", daysAgo: 90, results: [["TSH", 2.6]] },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function illustrativeRangeFor(testId: string, sex: Sex): string {
  const test = TEST_TYPES.find((t) => t.id === testId);
  if (!test) throw new Error(`Unknown test type ${testId}`);
  const ranges = test.ranges as Partial<Record<Sex | "any", string>>;
  const range = ranges[sex] ?? ranges.any;
  if (!range) throw new Error(`No illustrative range for ${testId}`);
  return range;
}

export function seedDemoData(db: DatabaseSync, options: SeedOptions): void {
  const now = options.now ?? new Date();
  const iso = (offsetDays: number) => new Date(now.getTime() + offsetDays * DAY_MS).toISOString();
  const createdAt = now.toISOString();

  const insertClinician = db.prepare(
    `INSERT INTO clinicians (id, name, email, mobile, notify_app, notify_email, notify_sms, notify_voice, created_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, 0, ?)`,
  );
  for (const c of CLINICIANS) {
    const isDemo = c.id === DEMO_GP_ID;
    const email = isDemo ? options.demoGpEmail : null;
    const mobile = isDemo ? options.demoGpMobile : null;
    insertClinician.run(c.id, c.name, email, mobile, email ? 1 : 0, mobile ? 1 : 0, createdAt);
  }

  const insertTest = db.prepare(
    `INSERT INTO test_types (id, name, unit, name_aliases, unit_aliases, illustrative_ranges, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const t of TEST_TYPES) {
    insertTest.run(
      t.id, t.name, t.unit,
      JSON.stringify(t.nameAliases), JSON.stringify(t.unitAliases), JSON.stringify(t.ranges),
      t.sort,
    );
  }

  const insertPatient = db.prepare(
    `INSERT INTO patients (id, display_name, sex, date_of_birth, practice_ref, usual_clinician_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const p of PATIENTS) insertPatient.run(p.id, p.name, p.sex, p.dob, p.ref, p.gp, createdAt);

  const insertReport = db.prepare(
    `INSERT INTO reports (id, source_message_id, patient_id, requesting_clinician_id, lab_name,
                          collected_at, received_at, origin, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'history', 'checked', ?)`,
  );
  const insertResult = db.prepare(
    `INSERT INTO results (id, report_id, patient_id, test_type_id, test_name_raw, value_raw, value,
                          unit_raw, range_raw, range_low, range_high, range_low_inclusive, range_high_inclusive,
                          lab_flag_raw, lab_flagged, check_status, collected_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'checked', ?, ?)`,
  );
  HISTORY.forEach((h, i) => {
    const patient = PATIENTS.find((p) => p.id === h.patient)!;
    const reportId = `rep_hist_${i + 1}`;
    const collected = iso(-h.daysAgo);
    const received = iso(-h.daysAgo + 0.5);
    insertReport.run(reportId, `HIST-${i + 1}`, patient.id, patient.gp, SYNTHETIC_LAB_NAME, collected, received, received);

    h.results.forEach(([testId, value], j) => {
      const test = TEST_TYPES.find((t) => t.id === testId)!;
      const rangeRaw = illustrativeRangeFor(testId, patient.sex);
      const range = parsePrintedRange(rangeRaw)!;
      const position = positionInRange(value, range);
      const flag = position === "above" ? "H" : position === "below" ? "L" : "";
      insertResult.run(
        `res_hist_${i + 1}_${j + 1}`, reportId, patient.id, testId, test.name, String(value), value,
        test.unit, rangeRaw, range.low, range.high, range.lowInclusive ? 1 : 0, range.highInclusive ? 1 : 0,
        flag, flag ? 1 : 0, collected, received,
      );
    });
  });

  // One ready-made rule, so the "GP rule" alert can be shown straight away.
  // A second rule is created live during the demo.
  db.prepare(
    `INSERT INTO rules (id, clinician_id, patient_id, test_type_id, direction, threshold, unit, note,
                        starts_at, ends_at, version, created_at, updated_at)
     VALUES ('rule_fletcher_k', ?, 'pt_fletcher', 'K', 'above', 5.0, 'mmol/L', ?, ?, ?, 1, ?, ?)`,
  ).run(DEMO_GP_ID, "Demo rule: keep an eye on potassium after a medication change", iso(-7), iso(83), iso(-7), iso(-7));

  audit(db, { actor: "system", action: "demo.seeded", detail: { patients: PATIENTS.length, historyReports: HISTORY.length } }, createdAt);
}
