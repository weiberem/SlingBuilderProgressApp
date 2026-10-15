import type { ManualViewDto } from "@/modules/progress/view-dto";
import { snapshotKey, withDb, type CachedSnapshot } from "./db";

/** Zwischenspeicher der Handbuch-Ansicht je Projekt und Handbuch. */
export async function saveSnapshot(projectId: string, manualCode: string, view: ManualViewDto): Promise<void> {
  const row: CachedSnapshot = { key: snapshotKey(projectId, manualCode), projectId, manualCode, fetchedAt: view.generatedAt, view };
  await withDb(async (db) => {
    await db.snapshots.put(row);
  }, undefined);
}

export async function loadSnapshot(projectId: string, manualCode: string): Promise<CachedSnapshot | null> {
  return withDb(async (db) => (await db.snapshots.get(snapshotKey(projectId, manualCode))) ?? null, null);
}

export async function listCachedManuals(projectId: string): Promise<{ manualCode: string; title: string; fetchedAt: string }[]> {
  return withDb(
    async (db) => (await db.snapshots.where("projectId").equals(projectId).toArray()).map((s) => ({ manualCode: s.manualCode, title: s.view.manual.title, fetchedAt: s.fetchedAt })),
    [],
  );
}

/** Holt den aktuellen Stand vom Server; `null`, wenn offline oder der Server nicht antwortet. */
export async function fetchSnapshot(projectId: string, manualCode: string): Promise<ManualViewDto | null> {
  try {
    const res = await fetch(`/api/p/${encodeURIComponent(projectId)}/snapshot?manual=${encodeURIComponent(manualCode)}`, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const view = (await res.json()) as ManualViewDto;
    await saveSnapshot(projectId, manualCode, view);
    return view;
  } catch {
    return null;
  }
}
