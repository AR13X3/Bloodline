import { describe, expect, it } from "vitest";
import { evaluateResult, ruleMatches } from "./evaluate";
import { planAlerts, type ClinicianAvailability } from "./routing";
import type { ActiveRule, ExtractedResult, TestTypeRef } from "./types";
import { isLabFlagged, normaliseUnit, validateResult } from "./validate";

const TESTS: TestTypeRef[] = [
  { id: "K", name: "Potassium", unit: "mmol/L", nameAliases: ["K", "K+"], unitAliases: ["mmol/l"] },
  { id: "CREAT", name: "Creatinine", unit: "µmol/L", nameAliases: ["Creat"], unitAliases: ["umol/L", "μmol/L"] },
  { id: "EGFR", name: "eGFR", unit: "mL/min/1.73m²", nameAliases: [], unitAliases: ["mL/min/1.73m2"] },
];

function result(overrides: Partial<ExtractedResult> = {}): ExtractedResult {
  return {
    testName: "Potassium",
    value: "4.6",
    unit: "mmol/L",
    referenceRange: "3.5 - 5.2",
    labFlag: null,
    labComment: null,
    ...overrides,
  };
}

const kRule = (overrides: Partial<ActiveRule> = {}): ActiveRule => ({
  id: "r1",
  clinicianId: "gp_a",
  testTypeId: "K",
  direction: "above",
  threshold: 5.0,
  ...overrides,
});

describe("validateResult", () => {
  it("accepts a clean result and matches aliases case-insensitively", () => {
    const v = validateResult(result({ testName: "  k+ " }), TESTS);
    expect(v.status).toBe("checked");
    expect(v.testTypeId).toBe("K");
  });

  it.each([
    [{ testName: "Magnesium" }, "unknown_test"],
    [{ value: "<0.1" }, "value_not_numeric"],
    [{ value: "see comment" }, "value_not_numeric"],
    [{ value: "4.6 H" }, "value_not_numeric"],
    [{ unit: "mEq/L" }, "unit_mismatch"],
    [{ unit: null }, "unit_mismatch"],
    [{ referenceRange: null }, "range_missing"],
    [{ referenceRange: "  " }, "range_missing"],
    [{ referenceRange: "see note" }, "range_unreadable"],
  ] as const)("can't check %j → %s", (overrides, reason) => {
    const v = validateResult(result(overrides), TESTS);
    expect(v.status).toBe("couldnt_check");
    if (v.status === "couldnt_check") expect(v.reason).toBe(reason);
  });

  it("treats micro sign, Greek mu, spacing and ² as the same unit spelling", () => {
    expect(normaliseUnit("μmol/L")).toBe(normaliseUnit("µmol/l"));
    expect(normaliseUnit("mL/min/1.73 m²")).toBe(normaliseUnit("mL/min/1.73m2"));
    const v = validateResult(result({ testName: "Creat", value: "94", unit: "umol/L", referenceRange: "45 - 90" }), TESTS);
    expect(v.status).toBe("checked");
  });

  it("knows which lab flags count", () => {
    for (const f of ["H", "L", "HH", "LL", "A", "*", "Critical"]) expect(isLabFlagged(f)).toBe(true);
    for (const f of [null, "", "  ", "N", "normal", "-"]) expect(isLabFlagged(f)).toBe(false);
  });
});

describe("evaluateResult", () => {
  it("raises nothing for a normal result with no rules", () => {
    const e = evaluateResult(validateResult(result(), TESTS), []);
    expect(e).toMatchObject({ labFlag: false, outsideRange: null, matchedRules: [], couldntCheck: null });
    expect(e.checks.map((c) => `${c.kind}:${c.outcome}`)).toEqual(["lab_flag:clear", "validation:clear", "range:clear"]);
  });

  it("flags a value outside the printed range even when the lab didn't flag it", () => {
    const e = evaluateResult(validateResult(result({ value: "5.6" }), TESTS), []);
    expect(e.outsideRange).toBe("above");
    expect(e.labFlag).toBe(false);
  });

  it("treats a value exactly on a two-sided limit as inside", () => {
    expect(evaluateResult(validateResult(result({ value: "5.2" }), TESTS), []).outsideRange).toBeNull();
    expect(evaluateResult(validateResult(result({ value: "3.5" }), TESTS), []).outsideRange).toBeNull();
  });

  it("respects a strict one-sided printed range", () => {
    const egfr = (value: string) =>
      evaluateResult(validateResult(result({ testName: "eGFR", value, unit: "mL/min/1.73m2", referenceRange: "> 59" }), TESTS), []);
    expect(egfr("59").outsideRange).toBe("below");
    expect(egfr("60").outsideRange).toBeNull();
  });

  it("matches a GP rule even when the lab says normal and the value is inside the range", () => {
    const e = evaluateResult(validateResult(result({ value: "5.1" }), TESTS), [kRule()]);
    expect(e.labFlag).toBe(false);
    expect(e.outsideRange).toBeNull();
    expect(e.matchedRules.map((r) => r.id)).toEqual(["r1"]);
  });

  it("uses strict comparisons for rules", () => {
    expect(ruleMatches(kRule(), 5.0)).toBe(false);
    expect(ruleMatches(kRule(), 5.01)).toBe(true);
    expect(ruleMatches(kRule({ direction: "below", threshold: 3.5 }), 3.5)).toBe(false);
    expect(ruleMatches(kRule({ direction: "below", threshold: 3.5 }), 3.4)).toBe(true);
  });

  it("ignores rules for other tests", () => {
    const e = evaluateResult(validateResult(result({ value: "9" }), TESTS), [kRule({ testTypeId: "CREAT", threshold: 1 })]);
    expect(e.matchedRules).toEqual([]);
  });

  it("still honours the lab flag when the value can't be checked", () => {
    const e = evaluateResult(validateResult(result({ value: "<0.1", labFlag: "L" }), TESTS), [kRule()]);
    expect(e.labFlag).toBe(true);
    expect(e.couldntCheck).toBe("value_not_numeric");
    expect(e.unevaluatedRules.map((r) => r.id)).toEqual(["r1"]);
    expect(e.checks.find((c) => c.kind === "rule")?.outcome).toBe("skipped");
  });
});

describe("planAlerts", () => {
  const available = (id: string, away = false, cover: string | null = null): ClinicianAvailability => ({
    id,
    away,
    coveringClinicianId: cover,
  });
  const team = (...list: ClinicianAvailability[]) => new Map(list.map((c) => [c.id, c]));

  it("sends nothing when no check triggers", () => {
    const e = evaluateResult(validateResult(result(), TESTS), []);
    expect(planAlerts(e, "gp_a", team(available("gp_a")))).toEqual([]);
  });

  it("combines every reason for the same GP into one alert", () => {
    const e = evaluateResult(validateResult(result({ value: "5.6", labFlag: "H" }), TESTS), [kRule()]);
    expect(planAlerts(e, "gp_a", team(available("gp_a")))).toEqual([
      { recipientId: "gp_a", originalId: "gp_a", reasons: ["lab_flag", "outside_range", "gp_rule"], ruleIds: ["r1"], handoverUnavailable: false },
    ]);
  });

  it("sends a rule match to the rule's owner, separately from the requesting GP", () => {
    const e = evaluateResult(validateResult(result({ value: "5.6" }), TESTS), [kRule({ clinicianId: "gp_b" })]);
    const plans = planAlerts(e, "gp_a", team(available("gp_a"), available("gp_b")));
    expect(plans.map((p) => [p.recipientId, p.reasons])).toEqual([
      ["gp_a", ["outside_range"]],
      ["gp_b", ["gp_rule"]],
    ]);
  });

  it("tells the requesting GP and rule owners when a result can't be checked", () => {
    const e = evaluateResult(validateResult(result({ value: "see comment" }), TESTS), [kRule({ clinicianId: "gp_b" })]);
    const plans = planAlerts(e, "gp_a", team(available("gp_a"), available("gp_b")));
    expect(plans.map((p) => [p.recipientId, p.reasons])).toEqual([
      ["gp_a", ["couldnt_check"]],
      ["gp_b", ["couldnt_check"]],
    ]);
  });

  it("hands over to the covering colleague, one step only", () => {
    const e = evaluateResult(validateResult(result({ labFlag: "H", value: "5.6" }), TESTS), []);
    const covered = planAlerts(e, "gp_a", team(available("gp_a", true, "gp_b"), available("gp_b")));
    expect(covered[0]).toMatchObject({ recipientId: "gp_b", originalId: "gp_a", handoverUnavailable: false });

    const coverAway = planAlerts(e, "gp_a", team(available("gp_a", true, "gp_b"), available("gp_b", true, "gp_c"), available("gp_c")));
    expect(coverAway[0]).toMatchObject({ recipientId: "gp_a", handoverUnavailable: true });

    const noCover = planAlerts(e, "gp_a", team(available("gp_a", true)));
    expect(noCover[0]).toMatchObject({ recipientId: "gp_a", handoverUnavailable: true });
  });

  it("merges alerts that hand over to the same colleague", () => {
    const e = evaluateResult(validateResult(result({ value: "5.6" }), TESTS), [kRule({ clinicianId: "gp_b" })]);
    const plans = planAlerts(e, "gp_a", team(available("gp_a", true, "gp_c"), available("gp_b", true, "gp_c"), available("gp_c")));
    expect(plans).toEqual([
      { recipientId: "gp_c", originalId: "gp_a", reasons: ["outside_range", "gp_rule"], ruleIds: ["r1"], handoverUnavailable: false },
    ]);
  });
});
