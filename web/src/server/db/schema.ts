// SQLite schema for the BloodLine demo. All data is synthetic.
// Timestamps are ISO 8601 strings. JSON columns hold JSON text.

export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS clinicians (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  email                 TEXT,
  mobile                TEXT,
  notify_app            INTEGER NOT NULL DEFAULT 1,
  notify_email          INTEGER NOT NULL DEFAULT 0,
  notify_sms            INTEGER NOT NULL DEFAULT 0,
  notify_voice          INTEGER NOT NULL DEFAULT 0,
  away                  INTEGER NOT NULL DEFAULT 0,
  covering_clinician_id TEXT REFERENCES clinicians(id),
  created_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id                 TEXT PRIMARY KEY,
  display_name       TEXT NOT NULL,
  sex                TEXT NOT NULL CHECK (sex IN ('F', 'M', 'X')),
  date_of_birth      TEXT NOT NULL,
  practice_ref       TEXT NOT NULL UNIQUE,
  usual_clinician_id TEXT REFERENCES clinicians(id),
  created_at         TEXT NOT NULL
);

-- illustrative_ranges holds printed range text by sex, e.g.
-- {"M": "130 - 180", "F": "115 - 165"} or {"any": "> 59"}. It is only used to
-- generate synthetic PDFs and as a clearly labelled fallback when a GP sets a
-- rule. Checks never use it.
CREATE TABLE IF NOT EXISTS test_types (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  unit                TEXT NOT NULL,
  name_aliases        TEXT NOT NULL DEFAULT '[]',
  unit_aliases        TEXT NOT NULL DEFAULT '[]',
  illustrative_ranges TEXT NOT NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0
);

-- One row per incoming report. A report can hold several results.
CREATE TABLE IF NOT EXISTS reports (
  id                      TEXT PRIMARY KEY,
  source_message_id       TEXT NOT NULL UNIQUE,
  patient_id              TEXT NOT NULL REFERENCES patients(id),
  requesting_clinician_id TEXT NOT NULL REFERENCES clinicians(id),
  lab_name                TEXT NOT NULL,
  collected_at            TEXT NOT NULL,
  received_at             TEXT NOT NULL,
  origin                  TEXT NOT NULL CHECK (origin IN ('simulator', 'upload', 'history')),
  file_name               TEXT,
  file_hash               TEXT,
  status                  TEXT NOT NULL DEFAULT 'received'
                            CHECK (status IN ('received', 'read', 'checked', 'couldnt_read')),
  extraction_source       TEXT CHECK (extraction_source IN ('ai', 'cache')),
  error                   TEXT,
  created_at              TEXT NOT NULL
);

-- Survives "Reset demo" so the same PDF is never sent to the AI twice.
CREATE TABLE IF NOT EXISTS extraction_cache (
  file_hash       TEXT PRIMARY KEY,
  model           TEXT NOT NULL,
  extraction_json TEXT NOT NULL,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  cost_usd        REAL,
  created_at      TEXT NOT NULL
);

-- Raw fields are exactly what the report said; parsed fields are filled in
-- only when validation passes.
CREATE TABLE IF NOT EXISTS results (
  id                   TEXT PRIMARY KEY,
  report_id            TEXT NOT NULL REFERENCES reports(id),
  patient_id           TEXT NOT NULL REFERENCES patients(id),
  test_type_id         TEXT REFERENCES test_types(id),
  test_name_raw        TEXT NOT NULL,
  value_raw            TEXT NOT NULL,
  value                REAL,
  unit_raw             TEXT,
  range_raw            TEXT,
  range_low            REAL,
  range_high           REAL,
  range_low_inclusive  INTEGER NOT NULL DEFAULT 1,
  range_high_inclusive INTEGER NOT NULL DEFAULT 1,
  lab_flag_raw         TEXT,
  lab_flagged          INTEGER NOT NULL DEFAULT 0,
  lab_comment          TEXT,
  check_status         TEXT NOT NULL DEFAULT 'pending'
                         CHECK (check_status IN ('pending', 'checked', 'couldnt_check')),
  couldnt_check_reason TEXT,
  collected_at         TEXT NOT NULL,
  created_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS results_by_patient_test
  ON results (patient_id, test_type_id, collected_at);

-- Rules are ended, never deleted. Each change bumps version and is audited.
CREATE TABLE IF NOT EXISTS rules (
  id           TEXT PRIMARY KEY,
  clinician_id TEXT NOT NULL REFERENCES clinicians(id),
  patient_id   TEXT NOT NULL REFERENCES patients(id),
  test_type_id TEXT NOT NULL REFERENCES test_types(id),
  direction    TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  threshold    REAL NOT NULL,
  unit         TEXT NOT NULL,
  note         TEXT,
  starts_at    TEXT NOT NULL,
  ends_at      TEXT NOT NULL,
  ended_at     TEXT,
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rules_by_patient_test ON rules (patient_id, test_type_id);

-- Every check is logged, whether or not it alerts.
CREATE TABLE IF NOT EXISTS checks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  result_id  TEXT NOT NULL REFERENCES results(id),
  kind       TEXT NOT NULL CHECK (kind IN ('validation', 'lab_flag', 'range', 'rule')),
  rule_id    TEXT REFERENCES rules(id),
  outcome    TEXT NOT NULL CHECK (outcome IN ('triggered', 'clear', 'skipped', 'failed')),
  detail     TEXT,
  created_at TEXT NOT NULL
);

-- One alert per result per recipient, listing every reason that applies.
-- reasons: JSON array of 'lab_flag' | 'outside_range' | 'gp_rule' | 'couldnt_check'.
CREATE TABLE IF NOT EXISTS alerts (
  id                     TEXT PRIMARY KEY,
  result_id              TEXT NOT NULL REFERENCES results(id),
  report_id              TEXT NOT NULL REFERENCES reports(id),
  patient_id             TEXT NOT NULL REFERENCES patients(id),
  recipient_clinician_id TEXT NOT NULL REFERENCES clinicians(id),
  original_clinician_id  TEXT NOT NULL REFERENCES clinicians(id),
  reasons                TEXT NOT NULL,
  rule_ids               TEXT NOT NULL DEFAULT '[]',
  created_at             TEXT NOT NULL,
  seen_at                TEXT,
  seen_by_clinician_id   TEXT REFERENCES clinicians(id),
  UNIQUE (result_id, recipient_clinician_id)
);
CREATE INDEX IF NOT EXISTS alerts_by_recipient ON alerts (recipient_clinician_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id               TEXT PRIMARY KEY,
  alert_id         TEXT NOT NULL REFERENCES alerts(id),
  channel          TEXT NOT NULL CHECK (channel IN ('app', 'email', 'sms', 'voice')),
  recipient_masked TEXT,
  status           TEXT NOT NULL CHECK (status IN ('sent', 'simulated', 'failed')),
  provider_id      TEXT,
  error            TEXT,
  created_at       TEXT NOT NULL
);

-- detail never contains secrets.
CREATE TABLE IF NOT EXISTS audit_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  detail      TEXT
);
`;

// Tables cleared by "Reset demo", in foreign-key-safe order.
// extraction_cache is deliberately absent.
export const RESETTABLE_TABLES = [
  "notifications",
  "alerts",
  "checks",
  "rules",
  "results",
  "reports",
  "audit_events",
  "patients",
  "test_types",
  "clinicians",
] as const;
