import type { DatabaseSync } from "node:sqlite";

export interface AuditEvent {
  actor: string;
  action: string;
  entityType?: string;
  entityId?: string;
  /** Serialised as JSON. Never pass secrets. */
  detail?: unknown;
}

export function audit(db: DatabaseSync, event: AuditEvent, at: string = new Date().toISOString()): void {
  db.prepare(
    `INSERT INTO audit_events (at, actor, action, entity_type, entity_id, detail)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    at,
    event.actor,
    event.action,
    event.entityType ?? null,
    event.entityId ?? null,
    event.detail === undefined ? null : JSON.stringify(event.detail),
  );
}
