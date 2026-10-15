import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb, resetTestDb } from "@/test/db";
import { sessions } from "@/modules/auth/schema";
import { createSession, deleteExpiredSessions } from "@/modules/auth/session";
import { CLEANUP_SESSIONS_CRON, QUEUES, SCHEDULE_TZ, registerJobs, type JobRegistry } from "./jobs";

type Handler = (jobs: { id: string; name: string; data: object }[]) => Promise<unknown>;

function fakeBoss() {
  const queues: string[] = [];
  const schedules: { name: string; cron: string; tz?: string }[] = [];
  const handlers = new Map<string, Handler>();
  const boss: JobRegistry = {
    createQueue: async (name) => {
      queues.push(name);
    },
    schedule: async (name, cron, _data, options) => {
      schedules.push({ name, cron, tz: options?.tz });
    },
    work: async (name, handler) => {
      handlers.set(name, handler as Handler);
      return name;
    },
  };
  return { boss, queues, schedules, handlers };
}

const silentLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe("Worker: Job-Registrierung", () => {
  it("legt Queues, Zeitplan und Handler an", async () => {
    const { boss, queues, schedules, handlers } = fakeBoss();
    const deleteExpired = vi.fn(async () => {});
    await registerJobs(boss, { deleteExpiredSessions: deleteExpired, log: silentLog });

    expect(queues).toEqual([QUEUES.cleanupSessions, QUEUES.noop]);
    expect(schedules).toEqual([{ name: QUEUES.cleanupSessions, cron: CLEANUP_SESSIONS_CRON, tz: SCHEDULE_TZ }]);
    expect([...handlers.keys()]).toEqual([QUEUES.cleanupSessions, QUEUES.noop]);

    await handlers.get(QUEUES.cleanupSessions)!([{ id: "1", name: QUEUES.cleanupSessions, data: {} }]);
    expect(deleteExpired).toHaveBeenCalledTimes(1);

    await handlers.get(QUEUES.noop)!([{ id: "2", name: QUEUES.noop, data: { message: "hallo" } }]);
    expect(silentLog.info).toHaveBeenCalledWith(expect.objectContaining({ message: "hallo" }), expect.any(String));
  });
});

describe("Worker: Session-Bereinigung gegen die Datenbank", () => {
  let userId: string;

  beforeAll(async () => {
    ({ userId } = await resetTestDb());
  });

  afterAll(async () => {
    await closeDb();
  });

  it("löscht nur abgelaufene Sessions", async () => {
    const db = getDb();
    const live = await createSession(userId);
    const expiredId = "0".repeat(64);
    await db.insert(sessions).values({ id: expiredId, userId, expiresAt: new Date(Date.now() - 1000) });

    await deleteExpiredSessions();

    const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
    expect(rows.map((r) => r.id)).not.toContain(expiredId);
    expect(rows.length).toBe(1);
    expect(live.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
