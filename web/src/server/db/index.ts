import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { RESETTABLE_TABLES, SCHEMA_SQL, SCHEMA_VERSION } from "./schema";
import { seedDemoData, type SeedOptions } from "./seed";

export type Db = DatabaseSync;

export const DATA_DIR = path.join(process.cwd(), "data");
/** Where report PDFs are stored. Overridable for tests. */
export function reportsDir(): string {
  return process.env.BLOODLINE_REPORTS_DIR || path.join(DATA_DIR, "reports");
}
const DEFAULT_DB_PATH = path.join(DATA_DIR, "bloodline.db");

/** Opens a database, applies the schema, and seeds it if it's empty. */
export function openDb(filePath: string = DEFAULT_DB_PATH, seed: SeedOptions = seedOptionsFromEnv()): Db {
  if (filePath !== ":memory:") mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");

  // Demo data is synthetic, so a schema change simply rebuilds the demo
  // tables. The extraction cache and presenter settings are kept.
  const { user_version: version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (version !== 0 && version !== SCHEMA_VERSION) {
    db.exec("PRAGMA foreign_keys = OFF");
    for (const table of RESETTABLE_TABLES) db.exec(`DROP TABLE IF EXISTS ${table}`);
    db.exec("PRAGMA foreign_keys = ON");
  }
  db.exec(SCHEMA_SQL);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);

  const { n } = db.prepare("SELECT COUNT(*) AS n FROM clinicians").get() as { n: number };
  if (n === 0) {
    transaction(db, () => seedDemoData(db, seed));
  }
  return db;
}

// One connection per server process. Kept on globalThis so Next.js dev
// reloads don't open a new connection on every change.
const globalForDb = globalThis as unknown as { __bloodlineDb?: Db };

export function getDb(): Db {
  globalForDb.__bloodlineDb ??= openDb(process.env.BLOODLINE_DB_PATH || DEFAULT_DB_PATH);
  return globalForDb.__bloodlineDb;
}

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** Clears everything except the OCR cache, then reseeds. */
export function resetDemo(db: Db, seed: SeedOptions = seedOptionsFromEnv()): void {
  transaction(db, () => {
    for (const table of RESETTABLE_TABLES) db.exec(`DELETE FROM ${table}`);
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('checks', 'audit_events')");
    seedDemoData(db, seed);
  });
}

export function seedOptionsFromEnv(): SeedOptions {
  return {
    demoGpEmail: process.env.DEMO_GP_EMAIL?.trim() || null,
    demoGpMobile: process.env.DEMO_GP_MOBILE?.trim() || null,
  };
}

export { audit } from "./audit";
