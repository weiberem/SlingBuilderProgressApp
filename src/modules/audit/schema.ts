import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id } from "../../db/columns";

/**
 * Audit-Log: jede Statusänderung mit wer, wann, alt → neu. Append-only.
 * `client_change_id` macht den Offline-Sync idempotent.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    projectId: uuid("project_id"),
    userId: uuid("user_id"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    clientChangeId: text("client_change_id"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_project_at_idx").on(t.projectId, t.at),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    uniqueIndex("audit_log_client_change_uq")
      .on(t.clientChangeId)
      .where(sql`${t.clientChangeId} is not null`),
  ],
);

export type AuditEntry = typeof auditLog.$inferSelect;
