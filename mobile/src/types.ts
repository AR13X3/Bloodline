// Shapes returned by the BloodLine API (see web/src/server/queries.ts).

export type AlertReason = "lab_flag" | "outside_range" | "gp_rule" | "couldnt_check";

export interface ClinicianSummary {
  id: string;
  name: string;
  unseen: number;
  away: boolean;
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

export interface AlertDetail extends AlertListItem {
  result: AlertListItem["result"] & {
    id: string;
    testTypeId: string | null;
    valueNumber: number | null;
    range: string | null;
    labFlagged: boolean;
    labComment: string | null;
    couldntCheckReason: string | null;
    couldntCheckLabel: string | null;
    ruleLimitationLabel: string | null;
    collectedAt: string;
  };
  rangePosition: "below" | "inside" | "above" | null;
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
  latestRange: string | null;
  illustrativeRange: string;
  latest: { value: string; collectedAt: string; labFlagged: boolean } | null;
}

export interface PatientDetail extends PatientSummary {
  rules: RuleView[];
  tests: TestForRules[];
}
