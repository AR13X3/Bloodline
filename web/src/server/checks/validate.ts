// Turns a transcribed result into something the checks can trust, or says
// clearly why it can't be checked. Never guesses and never converts units.
import { parsePrintedRange } from "./range";
import type { ExtractedResult, TestTypeRef, ValidatedResult } from "./types";

const PLAIN_NUMBER = /^(\d+(\.\d+)?|\.\d+)$/;
const NOT_FLAGGED = new Set(["", "n", "normal", "-", "—"]);

function normaliseName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Compares units by spelling only: case, spaces, micro/Greek mu and "²"/"2"
// are treated as the same. Different units are never converted.
export function normaliseUnit(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "").replace(/μ/g, "µ").replace(/²/g, "2");
}

export function isLabFlagged(flag: string | null | undefined): boolean {
  if (flag == null) return false;
  return !NOT_FLAGGED.has(flag.trim().toLowerCase());
}

export function matchTestType(name: string, testTypes: TestTypeRef[]): TestTypeRef | null {
  const wanted = normaliseName(name);
  return (
    testTypes.find((t) => [t.name, ...t.nameAliases].some((n) => normaliseName(n) === wanted)) ?? null
  );
}

export function validateResult(extracted: ExtractedResult, testTypes: TestTypeRef[]): ValidatedResult {
  const labFlagged = isLabFlagged(extracted.labFlag);
  const test = matchTestType(extracted.testName, testTypes);
  const valueText = extracted.value.trim();
  const value = PLAIN_NUMBER.test(valueText) ? Number(valueText) : null;
  const range = parsePrintedRange(extracted.referenceRange);
  const base = { extracted, testTypeId: test?.id ?? null, labFlagged };

  if (!test) return { ...base, status: "couldnt_check", reason: "unknown_test", value, range };
  if (value === null) return { ...base, status: "couldnt_check", reason: "value_not_numeric", value, range };

  const unitOk =
    extracted.unit != null &&
    [test.unit, ...test.unitAliases].some((u) => normaliseUnit(u) === normaliseUnit(extracted.unit!));
  if (!unitOk) return { ...base, status: "couldnt_check", reason: "unit_mismatch", value, range };

  if (!extracted.referenceRange?.trim()) {
    return { ...base, status: "couldnt_check", reason: "range_missing", value, range };
  }
  if (!range) return { ...base, status: "couldnt_check", reason: "range_unreadable", value, range };

  return { ...base, testTypeId: test.id, status: "checked", value, range };
}
