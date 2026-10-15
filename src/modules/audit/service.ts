import { desc, eq, and } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { auditLog } from "./schema";

export type AuditInput = {
  projectId: string | null;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  clientChangeId?: string | null;
};

type Executor = Pick<Db, "insert" | "select">;

/** Schreibt einen Audit-Eintrag (append-only). */
export async function recordAudit(db: Executor, input: AuditInput): Promise<void> {
  await db.insert(auditLog).values({
    projectId: input.projectId,
    userId: input.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    clientChangeId: input.clientChangeId ?? null,
  });
}

/** Wurde diese Client-Änderung (Offline-Sync) schon verarbeitet? */
export async function hasClientChange(db: Executor, clientChangeId: string): Promise<boolean> {
  const rows = await db.select({ id: auditLog.id }).from(auditLog).where(eq(auditLog.clientChangeId, clientChangeId)).limit(1);
  return rows.length > 0;
}

export async function listAuditForEntity(db: Executor, projectId: string, entityType: string, entityId: string, limit = 50) {
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.projectId, projectId), eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)))
    .orderBy(desc(auditLog.at))
    .limit(limit);
}

export async function listAuditForProject(db: Executor, projectId: string, limit = 200) {
  return db.select().from(auditLog).where(eq(auditLog.projectId, projectId)).orderBy(desc(auditLog.at)).limit(limit);
}
