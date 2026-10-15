import type { SyncChangeResult, SyncResponse } from "@/modules/progress/sync";
import { ENQUEUED_EVENT, listPending, markFailed, notifyPending, removeChanges } from "./queue";
import type { QueuedChange } from "./db";

/**
 * Sync-Läufer: schickt wartende Änderungen an `/api/p/<projectId>/sync`, sobald das Gerät online ist,
 * die Seite sichtbar wird oder etwas Neues in die Warteschlange kommt. Fehler → erneuter Versuch mit Backoff.
 *
 * Ereignisse (window):
 * - `sbt:synced`  detail: { projectId, pageIds, statuses, failed }  → Ansichten übernehmen den Serverstand
 * - `sbt:sync-error` detail: { error }
 */
export const SYNCED_EVENT = "sbt:synced";
export const SYNC_ERROR_EVENT = "sbt:sync-error";

export type SyncedDetail = {
  projectId: string;
  pageIds: string[];
  statuses: SyncResponse["statuses"];
  failed: SyncChangeResult[];
};

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 3;
const BACKOFF_MIN = 1_000;
const BACKOFF_MAX = 60_000;

let started = false;
let running = false;
let rerun = false;
let backoff = BACKOFF_MIN;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function emit<T>(name: string, detail: T) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void syncNow();
  }, backoff);
  backoff = Math.min(BACKOFF_MAX, backoff * 2);
}

/** Startet den Läufer einmalig (idempotent). */
export function startSyncRunner(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  window.addEventListener(ENQUEUED_EVENT, () => void syncNow());
  void notifyPending();
  void syncNow();
}

export class SyncHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function postBatch(projectId: string, batch: QueuedChange[]): Promise<SyncResponse> {
  const res = await fetch(`/api/p/${encodeURIComponent(projectId)}/sync`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ changes: batch.map((c) => ({ clientChangeId: c.clientChangeId, kind: c.kind, payload: c.payload })) }),
  });
  if (!res.ok) throw new SyncHttpError(res.status, `HTTP ${res.status}`);
  return (await res.json()) as SyncResponse;
}

export type SyncOutcome = { synced: number; failed: number } | { skipped: "offline" | "busy" };

/** Schickt alle wartenden Änderungen. Läuft nie doppelt; ein weiterer Aufruf während des Laufs wird nachgeholt. */
export async function syncNow(): Promise<SyncOutcome> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { skipped: "offline" };
  if (running) {
    rerun = true;
    return { skipped: "busy" };
  }
  running = true;
  let synced = 0;
  let failed = 0;
  try {
    const pending = await listPending();
    const byProject = new Map<string, QueuedChange[]>();
    for (const c of pending) byProject.set(c.projectId, [...(byProject.get(c.projectId) ?? []), c]);
    for (const [projectId, changes] of byProject) {
      for (let i = 0; i < changes.length; i += BATCH_SIZE) {
        const batch = changes.slice(i, i + BATCH_SIZE);
        let data: SyncResponse;
        try {
          data = await postBatch(projectId, batch);
        } catch (e) {
          if (e instanceof SyncHttpError && e.status !== 401 && e.status < 500) {
            // Dauerhafter Fehler (ungültiger Stapel, keine Berechtigung): nach MAX_ATTEMPTS verwerfen.
            const ids = batch.map((c) => c.clientChangeId);
            await markFailed(ids, e.message);
            const drop = batch.filter((c) => c.attempts + 1 >= MAX_ATTEMPTS).map((c) => c.clientChangeId);
            if (drop.length) {
              await removeChanges(drop);
              failed += drop.length;
              emit<SyncedDetail>(SYNCED_EVENT, { projectId, pageIds: [], statuses: [], failed: drop.map((id) => ({ clientChangeId: id, ok: false, error: e.message })) });
            }
          }
          throw e;
        }
        const okIds = data.results.filter((r) => r.ok).map((r) => r.clientChangeId);
        const failedResults = data.results.filter((r): r is Extract<SyncChangeResult, { ok: false }> => !r.ok);
        await removeChanges(okIds);
        synced += okIds.length;
        const dropped: SyncChangeResult[] = [];
        if (failedResults.length) {
          const byId = new Map(batch.map((c) => [c.clientChangeId, c]));
          await markFailed(
            failedResults.map((r) => r.clientChangeId),
            failedResults.map((r) => r.error).join("; "),
          );
          const drop = failedResults.filter((r) => (byId.get(r.clientChangeId)?.attempts ?? 0) + 1 >= MAX_ATTEMPTS);
          if (drop.length) {
            await removeChanges(drop.map((r) => r.clientChangeId));
            dropped.push(...drop);
            failed += drop.length;
          }
        }
        emit<SyncedDetail>(SYNCED_EVENT, { projectId, pageIds: data.pageIds, statuses: data.statuses, failed: dropped });
        if (failedResults.length > dropped.length) scheduleRetry();
      }
    }
    backoff = BACKOFF_MIN;
    return { synced, failed };
  } catch (e) {
    emit(SYNC_ERROR_EVENT, { error: e instanceof Error ? e.message : String(e) });
    scheduleRetry();
    return { synced, failed };
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      void syncNow();
    }
  }
}
