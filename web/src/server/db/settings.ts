import type { DatabaseSync } from "node:sqlite";

export function getSetting(db: DatabaseSync, key: string, fallback: string): string {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(db: DatabaseSync, key: string, value: string): void {
  db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

/** Real email/SMS/calls only go out when the presenter switches this on. */
export function liveMessagesOn(db: DatabaseSync): boolean {
  return getSetting(db, "live_messages", "off") === "on";
}
