import type { Logger } from "@/lib/logger";

/**
 * Job-Registrierung des Workers, getrennt vom pg-boss-Bootstrap, damit sie ohne Datenbank
 * testbar ist. Jeder Job: Queue anlegen, Handler registrieren, optional Zeitplan.
 *
 * Echte Jobs (PDF-Import, OCR, Dropbox→Drive, Mail-Sync) kommen in M2+ als eigene Dateien
 * unter worker/jobs/ und werden hier eingehängt.
 */
export const QUEUES = {
  cleanupSessions: "maintenance.cleanup-sessions",
  noop: "noop",
} as const;

export const CLEANUP_SESSIONS_CRON = "15 3 * * *";
export const SCHEDULE_TZ = "Europe/Zurich";

/** Die Untermenge von pg-boss, die der Worker braucht (für Tests leicht nachzubilden). */
export interface JobRegistry {
  createQueue(name: string, options?: { retryLimit?: number; retryDelay?: number; expireInSeconds?: number }): Promise<void>;
  schedule(name: string, cron: string, data?: object | null, options?: { tz?: string; key?: string }): Promise<void>;
  work<T extends object>(name: string, handler: (jobs: { id: string; name: string; data: T }[]) => Promise<unknown>): Promise<string>;
}

export interface JobDeps {
  deleteExpiredSessions: () => Promise<void>;
  log: Pick<Logger, "info" | "warn" | "error">;
}

export type NoopPayload = { message?: string };

export async function registerJobs(boss: JobRegistry, deps: JobDeps): Promise<void> {
  // Täglich abgelaufene Sessions löschen (sonst wächst die Tabelle nur durch Logins).
  await boss.createQueue(QUEUES.cleanupSessions, { retryLimit: 2, retryDelay: 60, expireInSeconds: 300 });
  await boss.work<Record<string, never>>(QUEUES.cleanupSessions, async (jobs) => {
    for (const job of jobs) {
      await deps.deleteExpiredSessions();
      deps.log.info({ job: job.name, id: job.id }, "Abgelaufene Sessions gelöscht");
    }
  });
  await boss.schedule(QUEUES.cleanupSessions, CLEANUP_SESSIONS_CRON, null, { tz: SCHEDULE_TZ });

  // Vorlage für weitere Jobs: nimmt eine Nachricht entgegen und loggt sie.
  await boss.createQueue(QUEUES.noop, { retryLimit: 0, expireInSeconds: 60 });
  await boss.work<NoopPayload>(QUEUES.noop, async (jobs) => {
    for (const job of jobs) {
      deps.log.info({ job: job.name, id: job.id, message: job.data?.message ?? null }, "noop ausgeführt");
    }
  });
}
