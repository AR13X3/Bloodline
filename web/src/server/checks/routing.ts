// Decides who gets an alert and why.
// - Lab flag, outside-range and couldn't-check go to the GP who requested the test.
// - A rule match goes to the rule's owner. So does "couldn't check" for a test
//   the owner has a rule on.
// - If a GP is away with a colleague covering, the colleague gets it (one step only).
import type { AlertReason, Evaluation } from "./types";

export interface ClinicianAvailability {
  id: string;
  away: boolean;
  coveringClinicianId: string | null;
}

export interface PlannedAlert {
  recipientId: string;
  originalId: string;
  reasons: AlertReason[];
  ruleIds: string[];
  /** The GP is away but their covering colleague is away too (or not set). */
  handoverUnavailable: boolean;
}

const REASON_ORDER: AlertReason[] = ["lab_flag", "outside_range", "gp_rule", "couldnt_check"];

function sortReasons(reasons: Iterable<AlertReason>): AlertReason[] {
  const set = new Set(reasons);
  return REASON_ORDER.filter((r) => set.has(r));
}

export function planAlerts(
  evaluation: Evaluation,
  requestingClinicianId: string,
  clinicians: Map<string, ClinicianAvailability>,
): PlannedAlert[] {
  const byOriginal = new Map<string, { reasons: Set<AlertReason>; ruleIds: Set<string> }>();
  const entry = (id: string) => {
    let e = byOriginal.get(id);
    if (!e) byOriginal.set(id, (e = { reasons: new Set(), ruleIds: new Set() }));
    return e;
  };

  if (evaluation.labFlag) entry(requestingClinicianId).reasons.add("lab_flag");
  if (evaluation.outsideRange) entry(requestingClinicianId).reasons.add("outside_range");
  if (evaluation.couldntCheck) entry(requestingClinicianId).reasons.add("couldnt_check");
  for (const rule of evaluation.matchedRules) {
    const e = entry(rule.clinicianId);
    e.reasons.add("gp_rule");
    e.ruleIds.add(rule.id);
  }
  for (const rule of evaluation.unevaluatedRules) entry(rule.clinicianId).reasons.add("couldnt_check");

  const byRecipient = new Map<string, PlannedAlert>();
  for (const [originalId, { reasons, ruleIds }] of byOriginal) {
    if (reasons.size === 0) continue;

    let recipientId = originalId;
    let handoverUnavailable = false;
    const gp = clinicians.get(originalId);
    if (gp?.away) {
      const cover = gp.coveringClinicianId ? clinicians.get(gp.coveringClinicianId) : undefined;
      if (cover && !cover.away && cover.id !== originalId) recipientId = cover.id;
      else handoverUnavailable = true;
    }

    const existing = byRecipient.get(recipientId);
    if (existing) {
      existing.reasons = sortReasons([...existing.reasons, ...reasons]);
      existing.ruleIds = [...new Set([...existing.ruleIds, ...ruleIds])];
      existing.handoverUnavailable ||= handoverUnavailable;
    } else {
      byRecipient.set(recipientId, {
        recipientId,
        originalId,
        reasons: sortReasons(reasons),
        ruleIds: [...ruleIds],
        handoverUnavailable,
      });
    }
  }
  return [...byRecipient.values()];
}
