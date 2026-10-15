import type { PageStatusPayload, SectionStatusPayload } from "@/modules/progress/view-dto";
import { withDb, type QueuedChange } from "./db";

/**
 * Warteschlange der Offline-Änderungen. Nach jeder Änderung wird `sbt:pending` (Anzahl wartender
 * Änderungen) ausgelöst; `sbt:enqueued` stösst den Sync-Läufer an.
 */
export const PENDING_EVENT = "sbt:pending";
export const ENQUEUED_EVENT = "sbt:enqueued";

function newClientChangeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback für sehr alte Browser ohne randomUUID (nur Zufall, kein v4-Format nötig).
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export async function countPending(projectId?: string): Promise<number> {
  return withDb(async (db) => (projectId ? db.changes.where("projectId").equals(projectId).count() : db.changes.count()), 0);
}

export async function notifyPending(): Promise<number> {
  const n = await countPending();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PENDING_EVENT, { detail: n }));
  return n;
}

export type EnqueueInput =
  | { projectId: string; kind: "page_status"; payload: PageStatusPayload }
  | { projectId: string; kind: "section_status"; payload: SectionStatusPayload };

/** Legt eine Änderung in die Warteschlange und meldet die neue Anzahl. Liefert die Client-Änderungs-ID. */
export async function enqueueChange(input: EnqueueInput): Promise<QueuedChange> {
  const change: QueuedChange = { ...input, clientChangeId: newClientChangeId(), createdAt: new Date().toISOString(), attempts: 0 } as QueuedChange;
  await withDb(async (db) => {
    await db.changes.add(change);
  }, undefined);
  await notifyPending();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(ENQUEUED_EVENT, { detail: { projectId: input.projectId } }));
  return change;
}

export async function listPending(projectId?: string): Promise<QueuedChange[]> {
  return withDb(async (db) => {
    const rows = projectId ? await db.changes.where("projectId").equals(projectId).toArray() : await db.changes.toArray();
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, []);
}

export async function removeChanges(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await withDb(async (db) => {
    await db.changes.bulkDelete(ids);
  }, undefined);
  await notifyPending();
}

export async function markFailed(ids: string[], error: string): Promise<void> {
  if (!ids.length) return;
  await withDb(async (db) => {
    await db.transaction("rw", db.changes, async () => {
      for (const id of ids) {
        const c = await db.changes.get(id);
        if (c) await db.changes.put({ ...c, attempts: c.attempts + 1, lastError: error });
      }
    });
  }, undefined);
}
