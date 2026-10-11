// Recreates the demo database from synthetic seed data.
// Keeps the AI extraction cache. Usage: npm run db:reset
import { existsSync } from "node:fs";
import { getDb, resetDemo } from "../src/server/db";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const db = getDb();
resetDemo(db);

const count = (table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

console.log("Demo database reset.");
for (const table of ["clinicians", "patients", "test_types", "reports", "results", "rules", "extraction_cache"]) {
  console.log(`  ${table.padEnd(17)} ${count(table)}`);
}
