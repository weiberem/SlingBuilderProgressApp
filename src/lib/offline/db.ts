import Dexie, { type EntityTable } from "dexie";
import type { ManualViewDto, PageStatusPayload, SectionStatusPayload } from "@/modules/progress/view-dto";

/**
 * Offline-Speicher im Browser (IndexedDB über Dexie):
 * - `changes`: Warteschlange der noch nicht synchronisierten Änderungen (clientChangeId = UUID).
 * - `snapshots`: zuletzt geladene Handbuch-Ansicht je Projekt und Handbuch.
 * Alle Zugriffe laufen über `withDb`, damit ein fehlender/gesperrter Speicher (privater Modus) die App nie blockiert.
 */
export type QueuedChange =
  | { clientChangeId: string; projectId: string; kind: "page_status"; payload: PageStatusPayload; createdAt: string; attempts: number; lastError?: string }
  | { clientChangeId: string; projectId: string; kind: "section_status"; payload: SectionStatusPayload; createdAt: string; attempts: number; lastError?: string };

export type CachedSnapshot = {
  /** `${projectId}:${manualCode}` */
  key: string;
  projectId: string;
  manualCode: string;
  fetchedAt: string;
  view: ManualViewDto;
};

export type OfflineDb = Dexie & {
  changes: EntityTable<QueuedChange, "clientChangeId">;
  snapshots: EntityTable<CachedSnapshot, "key">;
};

let instance: OfflineDb | null = null;

export function getOfflineDb(): OfflineDb | null {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return null;
  if (!instance) {
    const db = new Dexie("sbt-offline") as OfflineDb;
    db.version(1).stores({
      changes: "clientChangeId, projectId, createdAt",
      snapshots: "key, projectId, fetchedAt",
    });
    instance = db;
  }
  return instance;
}

/** Führt eine Operation auf dem Offline-Speicher aus; bei Fehlern wird `fallback` geliefert. */
export async function withDb<T>(fn: (db: OfflineDb) => Promise<T>, fallback: T): Promise<T> {
  const db = getOfflineDb();
  if (!db) return fallback;
  try {
    return await fn(db);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("Offline-Speicher nicht verfügbar", e);
    return fallback;
  }
}

export function snapshotKey(projectId: string, manualCode: string): string {
  return `${projectId}:${manualCode}`;
}
