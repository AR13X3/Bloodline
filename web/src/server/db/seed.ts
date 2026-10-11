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

// Illustrative ranges only: used to print synthetic reports and as a clearly
// labelled fallback on the rule screen. Checks always use the printed range.
const X109 = ["x10^9/L", "x 10^9/L", "10^9/L", "x10*9/L", "×10⁹/L", "x10e9/L"];
export const TEST_TYPES = [
  // Full blood count
  { id: "HB", name: "Haemoglobin", unit: "g/L", sort: 1, nameAliases: ["Hb", "Hemoglobin", "Haemoglobin (Hb)"], unitAliases: ["g/l"], ranges: { M: "130 - 180", F: "115 - 165" } },
  { id: "WCC", name: "White cell count", unit: "x10^9/L", sort: 2, nameAliases: ["WCC", "WBC", "White blood cells", "White cell count (WCC)", "Leucocytes"], unitAliases: X109, ranges: { any: "4.0 - 11.0" } },
  { id: "PLT", name: "Platelets", unit: "x10^9/L", sort: 3, nameAliases: ["PLT", "Platelet count"], unitAliases: X109, ranges: { any: "150 - 400" } },
  { id: "MCV", name: "MCV", unit: "fL", sort: 4, nameAliases: ["Mean cell volume", "Mean corpuscular volume"], unitAliases: ["fl"], ranges: { any: "80 - 100" } },
  { id: "NEUT", name: "Neutrophils", unit: "x10^9/L", sort: 5, nameAliases: ["Neutrophil count", "Neuts"], unitAliases: X109, ranges: { any: "2.0 - 7.5" } },
  // Kidney function and electrolytes
  { id: "NA", name: "Sodium", unit: "mmol/L", sort: 10, nameAliases: ["Na", "Na+", "Serum sodium"], unitAliases: ["mmol/l"], ranges: { any: "135 - 145" } },
  { id: "K", name: "Potassium", unit: "mmol/L", sort: 11, nameAliases: ["K", "K+", "Serum potassium"], unitAliases: ["mmol/l"], ranges: { any: "3.5 - 5.2" } },
  { id: "CL", name: "Chloride", unit: "mmol/L", sort: 12, nameAliases: ["Cl", "Cl-"], unitAliases: ["mmol/l"], ranges: { any: "95 - 110" } },
  { id: "BICARB", name: "Bicarbonate", unit: "mmol/L", sort: 13, nameAliases: ["HCO3", "Total CO2", "Bicarb"], unitAliases: ["mmol/l"], ranges: { any: "22 - 32" } },
  { id: "UREA", name: "Urea", unit: "mmol/L", sort: 14, nameAliases: ["Serum urea"], unitAliases: ["mmol/l"], ranges: { any: "3.0 - 8.0" } },
  { id: "CREAT", name: "Creatinine", unit: "µmol/L", sort: 15, nameAliases: ["Creat", "Serum creatinine"], unitAliases: ["umol/L", "umol/l", "μmol/L", "µmol/l"], ranges: { M: "60 - 110", F: "45 - 90" } },
  { id: "EGFR", name: "eGFR", unit: "mL/min/1.73m²", sort: 16, nameAliases: ["Estimated GFR", "eGFR (CKD-EPI)"], unitAliases: ["mL/min/1.73m2", "ml/min/1.73m2", "mL/min/1.73 m2", "mL/min/1.73 m²"], ranges: { any: "> 59" } },
  // Liver function
  { id: "ALT", name: "ALT", unit: "U/L", sort: 20, nameAliases: ["Alanine aminotransferase", "ALT (SGPT)"], unitAliases: ["u/l", "IU/L"], ranges: { any: "< 40" } },
  { id: "AST", name: "AST", unit: "U/L", sort: 21, nameAliases: ["Aspartate aminotransferase", "AST (SGOT)"], unitAliases: ["u/l", "IU/L"], ranges: { any: "< 35" } },
  { id: "GGT", name: "GGT", unit: "U/L", sort: 22, nameAliases: ["Gamma GT", "Gamma-glutamyl transferase"], unitAliases: ["u/l", "IU/L"], ranges: { M: "< 60", F: "< 40" } },
  { id: "ALP", name: "ALP", unit: "U/L", sort: 23, nameAliases: ["Alkaline phosphatase", "Alk phos"], unitAliases: ["u/l", "IU/L"], ranges: { any: "30 - 110" } },
  { id: "BILI", name: "Bilirubin", unit: "µmol/L", sort: 24, nameAliases: ["Total bilirubin", "Bilirubin (total)"], unitAliases: ["umol/L", "umol/l", "μmol/L"], ranges: { any: "< 20" } },
  { id: "ALB", name: "Albumin", unit: "g/L", sort: 25, nameAliases: ["Serum albumin"], unitAliases: ["g/l"], ranges: { any: "35 - 50" } },
  // Lipids and glucose
  { id: "CHOL", name: "Total cholesterol", unit: "mmol/L", sort: 30, nameAliases: ["Cholesterol", "Cholesterol (total)"], unitAliases: ["mmol/l"], ranges: { any: "< 5.5" } },
  { id: "TRIG", name: "Triglycerides", unit: "mmol/L", sort: 31, nameAliases: ["Triglyceride", "TG"], unitAliases: ["mmol/l"], ranges: { any: "< 2.0" } },
  { id: "HDL", name: "HDL cholesterol", unit: "mmol/L", sort: 32, nameAliases: ["HDL", "HDL-C"], unitAliases: ["mmol/l"], ranges: { any: "> 1.0" } },
  { id: "LDL", name: "LDL cholesterol", unit: "mmol/L", sort: 33, nameAliases: ["LDL", "LDL-C"], unitAliases: ["mmol/l"], ranges: { any: "< 3.5" } },
  { id: "GLU", name: "Glucose", unit: "mmol/L", sort: 34, nameAliases: ["Fasting glucose", "Glucose (fasting)"], unitAliases: ["mmol/l"], ranges: { any: "3.0 - 6.0" } },
  { id: "HBA1C", name: "HbA1c", unit: "mmol/mol", sort: 35, nameAliases: ["HbA1c (IFCC)", "Haemoglobin A1c", "Glycated haemoglobin"], unitAliases: [], ranges: { any: "< 42" } },
  // Thyroid
  { id: "TSH", name: "TSH", unit: "mU/L", sort: 40, nameAliases: ["Thyroid stimulating hormone"], unitAliases: ["mIU/L", "mu/L"], ranges: { any: "0.5 - 4.0" } },
  { id: "FT4", name: "Free T4", unit: "pmol/L", sort: 41, nameAliases: ["FT4", "Free thyroxine"], unitAliases: ["pmol/l"], ranges: { any: "9.0 - 19.0" } },
  // Iron and vitamins
  { id: "FERR", name: "Ferritin", unit: "µg/L", sort: 50, nameAliases: ["Serum ferritin"], unitAliases: ["ug/L", "μg/L", "µg/l"], ranges: { M: "30 - 500", F: "30 - 300" } },
  { id: "IRON", name: "Iron", unit: "µmol/L", sort: 51, nameAliases: ["Serum iron"], unitAliases: ["umol/L", "umol/l", "μmol/L"], ranges: { any: "10 - 30" } },
  { id: "TSAT", name: "Transferrin saturation", unit: "%", sort: 52, nameAliases: ["Transferrin sat", "TSAT"], unitAliases: [], ranges: { any: "15 - 45" } },
  { id: "B12", name: "Vitamin B12", unit: "pmol/L", sort: 53, nameAliases: ["B12", "Active B12"], unitAliases: ["pmol/l"], ranges: { any: "150 - 700" } },
  { id: "FOLATE", name: "Folate", unit: "nmol/L", sort: 54, nameAliases: ["Serum folate"], unitAliases: ["nmol/l"], ranges: { any: "> 7.0" } },
  { id: "VITD", name: "Vitamin D", unit: "nmol/L", sort: 55, nameAliases: ["25-OH Vitamin D", "25-hydroxyvitamin D", "Vitamin D (25-OH)"], unitAliases: ["nmol/l"], ranges: { any: "50 - 150" } },
  // Inflammation and bone
  { id: "CRP", name: "CRP", unit: "mg/L", sort: 60, nameAliases: ["C-reactive protein"], unitAliases: ["mg/l"], ranges: { any: "< 5" } },
  { id: "ESR", name: "ESR", unit: "mm/h", sort: 61, nameAliases: ["Erythrocyte sedimentation rate"], unitAliases: ["mm/hr"], ranges: { any: "< 20" } },
  { id: "CA", name: "Calcium", unit: "mmol/L", sort: 62, nameAliases: ["Serum calcium", "Total calcium"], unitAliases: ["mmol/l"], ranges: { any: "2.10 - 2.60" } },
  { id: "MG", name: "Magnesium", unit: "mmol/L", sort: 63, nameAliases: ["Mg"], unitAliases: ["mmol/l"], ranges: { any: "0.70 - 1.10" } },
  { id: "PSA", name: "PSA", unit: "µg/L", sort: 64, nameAliases: ["Prostate specific antigen", "Total PSA"], unitAliases: ["ug/L", "μg/L"], ranges: { any: "< 4.0" } },
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
