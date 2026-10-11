// The three checks: the lab's flag, the range printed on the report, and the
// GP's own rules. Deterministic; the AI plays no part here.
import { positionInRange } from "./range";
import type { ActiveRule, CheckRecord, Evaluation, ValidatedResult } from "./types";

/** "above X" means strictly above X; "below X" means strictly below X. */
export function ruleMatches(rule: ActiveRule, value: number): boolean {
  return rule.direction === "above" ? value > rule.threshold : value < rule.threshold;
}

/** `rules` must already be the active rules for this patient. */
export function evaluateResult(result: ValidatedResult, rules: ActiveRule[]): Evaluation {
  const checks: CheckRecord[] = [];
  const rulesForTest = result.testTypeId ? rules.filter((r) => r.testTypeId === result.testTypeId) : [];

  // The lab's own flag counts even when we can't check the value ourselves.
  const flagText = result.extracted.labFlag?.trim() || "none";
  checks.push({ kind: "lab_flag", outcome: result.labFlagged ? "triggered" : "clear", detail: `Lab flag: ${flagText}` });

  if (result.status === "couldnt_check") {
    checks.push({ kind: "validation", outcome: "failed", detail: result.reason });
    checks.push({ kind: "range", outcome: "skipped", detail: "Result couldn't be checked" });
    for (const rule of rulesForTest) {
      checks.push({ kind: "rule", ruleId: rule.id, outcome: "skipped", detail: "Result couldn't be checked" });
    }
    return {
      checks,
      labFlag: result.labFlagged,
      outsideRange: null,
      matchedRules: [],
      couldntCheck: result.reason,
      unevaluatedRules: rulesForTest,
    };
  }

  checks.push({
    kind: "validation",
    outcome: "clear",
    detail: result.limitation ? `Range checked; ${result.limitation}` : "All fields valid",
  });

  const position = positionInRange(result.value, result.range);
  checks.push({
    kind: "range",
    outcome: position === "inside" ? "clear" : "triggered",
    detail: `${result.value} is ${position} ${result.extracted.referenceRange}`,
  });

  const matchedRules: ActiveRule[] = [];
  const unevaluatedRules: ActiveRule[] = [];
  for (const rule of rulesForTest) {
    if (!result.rulesApplicable) {
      unevaluatedRules.push(rule);
      checks.push({ kind: "rule", ruleId: rule.id, outcome: "skipped", detail: `Unit "${result.extracted.unit ?? "none"}" isn't the rule's unit` });
      continue;
    }
    const matched = ruleMatches(rule, result.value);
    if (matched) matchedRules.push(rule);
    checks.push({
      kind: "rule",
      ruleId: rule.id,
      outcome: matched ? "triggered" : "clear",
      detail: `${result.value} ${matched ? "is" : "is not"} ${rule.direction} ${rule.threshold}`,
    });
  }

  return {
    checks,
    labFlag: result.labFlagged,
    outsideRange: position === "inside" ? null : position,
    matchedRules,
    couldntCheck: null,
    unevaluatedRules,
  };
}
