import { describe, expect, it } from "vitest";
import { openDb, resetDemo } from "./index";
import { DEMO_GP_ID, TEST_TYPES } from "./seed";

const noContacts = { demoGpEmail: null, demoGpMobile: null, now: new Date("2026-10-11T00:00:00Z") };

function count(db: ReturnType<typeof openDb>, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

describe("demo database", () => {
  it("creates the schema and seeds synthetic data on first open", () => {
    const db = openDb(":memory:", noContacts);
    expect(count(db, "clinicians")).toBe(3);
    expect(count(db, "patients")).toBe(6);
    expect(count(db, "test_types")).toBe(TEST_TYPES.length);
    expect(count(db, "reports")).toBe(13);
    expect(count(db, "rules")).toBe(1);
    expect(count(db, "alerts")).toBe(0);
    expect(count(db, "audit_events")).toBe(1);
  });

  it("flags seeded history results consistently with their printed ranges", () => {
    const db = openDb(":memory:", noContacts);
    const flagged = db
      .prepare("SELECT test_type_id, value, lab_flag_raw FROM results WHERE lab_flagged = 1 ORDER BY test_type_id")
      .all();
    expect(flagged).toEqual([
      { test_type_id: "CREAT", value: 94, lab_flag_raw: "H" },
      { test_type_id: "EGFR", value: 57, lab_flag_raw: "L" },
    ]);
  });

  it("only enables email and SMS for the demo GP when contact details are provided", () => {
    const withContacts = openDb(":memory:", { ...noContacts, demoGpEmail: "gp@example.com", demoGpMobile: "+61400000000" });
    const gp = withContacts.prepare("SELECT notify_email, notify_sms, notify_voice FROM clinicians WHERE id = ?").get(DEMO_GP_ID);
    expect(gp).toEqual({ notify_email: 1, notify_sms: 1, notify_voice: 0 });

    const without = openDb(":memory:", noContacts);
    const gp2 = without.prepare("SELECT notify_email, notify_sms FROM clinicians WHERE id = ?").get(DEMO_GP_ID);
    expect(gp2).toEqual({ notify_email: 0, notify_sms: 0 });
  });

  it("enforces one report per source message id", () => {
    const db = openDb(":memory:", noContacts);
    expect(() =>
      db
        .prepare(
          `INSERT INTO reports (id, source_message_id, patient_id, requesting_clinician_id, lab_name,
                                collected_at, received_at, origin, created_at)
           VALUES ('dup', 'HIST-1', 'pt_nguyen', 'gp_chen', 'x', 'x', 'x', 'simulator', 'x')`,
        )
        .run(),
    ).toThrow(/UNIQUE/);
  });

  it("reset clears demo activity but keeps the extraction cache", () => {
    const db = openDb(":memory:", noContacts);
    db.prepare(
      `INSERT INTO extraction_cache (file_hash, model, extraction_json, created_at) VALUES ('abc', 'm', '{}', 'x')`,
    ).run();
    db.prepare("UPDATE clinicians SET away = 1 WHERE id = ?").run(DEMO_GP_ID);

    resetDemo(db, noContacts);

    expect(count(db, "extraction_cache")).toBe(1);
    expect(count(db, "clinicians")).toBe(3);
    const gp = db.prepare("SELECT away FROM clinicians WHERE id = ?").get(DEMO_GP_ID);
    expect(gp).toEqual({ away: 0 });
  });
});
