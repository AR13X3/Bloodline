import type { PrintedRange, RangePosition } from "./range";

/** One result exactly as transcribed from the report. Nothing is interpreted. */
export interface ExtractedResult {
  testName: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  labFlag: string | null;
  labComment: string | null;
}

export interface TestTypeRef {
  id: string;
  name: string;
  unit: string;
  nameAliases: string[];
  unitAliases: string[];
}

export type CouldntCheckReason =
  | "extraction_failed"
  | "unknown_test"
  | "value_not_numeric"
  | "unit_mismatch"
  | "range_missing"
  | "range_unreadable";

export const COULDNT_CHECK_LABELS: Record<CouldntCheckReason, string> = {
  extraction_failed: "The report couldn't be read",
  unknown_test: "Test not recognised, so GP rules can't apply",
  value_not_numeric: "Value isn't a plain number",
  unit_mismatch: "Unit isn't the expected unit, so GP rules can't apply",
  range_missing: "No reference range printed",
  range_unreadable: "Reference range couldn't be read",
};

interface ValidatedBase {
  extracted: ExtractedResult;
  testTypeId: string | null;
  /** Lab flag as printed counts as "flagged" (present, and not N/Normal). */
  labFlagged: boolean;
}

/**
 * The value and the printed range can be compared. The value and range come
 * from the same row, so they share a unit even if we don't recognise the test.
 * GP rules only apply when the test is recognised and the unit is the one the
 * rule was set in.
 */
export interface CheckableResult extends ValidatedBase {
  status: "checked";
  value: number;
  range: PrintedRange;
  rulesApplicable: boolean;
  /** Why rules can't apply, when they can't. */
  limitation: Extract<CouldntCheckReason, "unknown_test" | "unit_mismatch"> | null;
}

export interface UncheckableResult extends ValidatedBase {
  status: "couldnt_check";
  reason: CouldntCheckReason;
  /** Parsed when possible, for display. */
  value: number | null;
  range: PrintedRange | null;
}

export type ValidatedResult = CheckableResult | UncheckableResult;

export interface ActiveRule {
  id: string;
  clinicianId: string;
  testTypeId: string;
  direction: "above" | "below";
  threshold: number;
}

export type AlertReason = "lab_flag" | "outside_range" | "gp_rule" | "couldnt_check";

export interface CheckRecord {
  kind: "validation" | "lab_flag" | "range" | "rule";
  ruleId?: string;
  outcome: "triggered" | "clear" | "skipped" | "failed";
  detail: string;
}

export interface Evaluation {
  checks: CheckRecord[];
  labFlag: boolean;
  outsideRange: Exclude<RangePosition, "inside"> | null;
  matchedRules: ActiveRule[];
  couldntCheck: CouldntCheckReason | null;
  /** Rules on this test that couldn't be evaluated. Their owners are told. */
  unevaluatedRules: ActiveRule[];
}
