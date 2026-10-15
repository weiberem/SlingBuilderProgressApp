import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, resetTestDb } from "@/test/db";
import { getDb } from "@/lib/db";
import { auditLog } from "@/modules/audit/schema";
import { buildProjectContext, Forbidden, type ProjectContext } from "@/modules/projects/context";
import { getManualView } from "./service";
import { applySyncBatch, syncRequestSchema, type SyncChange } from "./sync";
import { applyPageChange, applySectionChange, applyStatusRows, toManualViewDto } from "./view-dto";

let ctx: ProjectContext;

beforeAll(async () => {
  const { userId, projectId } = await resetTestDb();
  ctx = await buildProjectContext(userId, projectId, { isPlatformAdmin: true, userName: "Test" });
});

afterAll(async () => {
  await closeDb();
});

async function empennage() {
  const v = await getManualView(ctx, "empennage");
  if (!v) throw new Error("Empennage fehlt");
  return v;
}

describe("Offline-Sync: Stapel anwenden", () => {
  it("validiert die Anfrage", () => {
    expect(syncRequestSchema.safeParse({ changes: [] }).success).toBe(false);
    expect(syncRequestSchema.safeParse({ changes: [{ clientChangeId: "x", kind: "page_status", payload: {} }] }).success).toBe(false);
    const ok = syncRequestSchema.safeParse({
      changes: [{ clientChangeId: "11111111-1111-4111-8111-111111111111", kind: "page_status", payload: { pageId: "22222222-2222-4222-8222-222222222222", status: "done" } }],
    });
    expect(ok.success).toBe(true);
  });

  it("wendet Seiten- und Abschnittsänderungen an und liefert den Serverstand der berührten Seiten", async () => {
    const emp = await empennage();
    const sec = emp.sections[0];
    const p1 = sec.pages[0].page;
    const p2 = sec.pages[1].page;
    const changes: SyncChange[] = [
      { clientChangeId: "c-page-1", kind: "page_status", payload: { pageId: p1.id, status: "done", doneAt: "2026-10-01", note: "Erste Seite" } },
      { clientChangeId: "c-page-2", kind: "page_status", payload: { pageId: p2.id, status: "problem" } },
      { clientChangeId: "c-sec-1", kind: "section_status", payload: { sectionId: sec.section.id, status: "done" } },
    ];
    const res = await applySyncBatch(ctx, changes);
    expect(res.results).toEqual([
      { clientChangeId: "c-page-1", ok: true, affected: 1 },
      { clientChangeId: "c-page-2", ok: true, affected: 1 },
      // Abschnitt: alle zutreffenden Seiten ausser der bereits erledigten
      { clientChangeId: "c-sec-1", ok: true, affected: sec.progress.relevant - 1 },
    ]);
    expect(res.pageIds).toEqual(expect.arrayContaining(sec.pages.map((p) => p.page.id)));
    const byId = new Map(res.statuses.map((s) => [s.pageId, s]));
    expect(byId.get(p1.id)).toMatchObject({ status: "done", doneAt: "2026-10-01", note: "Erste Seite" });
    expect(byId.get(p2.id)?.status).toBe("done");
    const after = await empennage();
    expect(after.sections[0].progress.done).toBe(sec.progress.relevant);
  });

  it("ist idempotent: bekannte clientChangeIds ändern nichts und schreiben kein zweites Audit", async () => {
    const emp = await empennage();
    const p1 = emp.sections[0].pages[0].page;
    const before = await getDb().select().from(auditLog).where(eq(auditLog.entityId, p1.id));
    const res = await applySyncBatch(ctx, [{ clientChangeId: "c-page-1", kind: "page_status", payload: { pageId: p1.id, status: "open" } }]);
    expect(res.results[0]).toMatchObject({ ok: true });
    expect(res.statuses.find((s) => s.pageId === p1.id)?.status).toBe("done");
    const after = await getDb().select().from(auditLog).where(eq(auditLog.entityId, p1.id));
    expect(after).toHaveLength(before.length);
    // Dieselbe Abschnittsänderung erneut gesendet (z. B. Antwort ging verloren): kein weiteres Audit
    const sectionPageIds = emp.sections[0].pages.map((p) => p.page.id);
    const auditsBefore = (await getDb().select().from(auditLog)).filter((a) => sectionPageIds.includes(a.entityId));
    const again = await applySyncBatch(ctx, [{ clientChangeId: "c-sec-1", kind: "section_status", payload: { sectionId: emp.sections[0].section.id, status: "done" } }]);
    expect(again.results[0]).toMatchObject({ ok: true, affected: 0 });
    const auditsAfter = (await getDb().select().from(auditLog)).filter((a) => sectionPageIds.includes(a.entityId));
    expect(auditsAfter).toHaveLength(auditsBefore.length);
    const view = await empennage();
    expect(view.sections[0].progress.done).toBe(emp.sections[0].progress.done);
  });

  it("meldet Fehler je Änderung, ohne den Stapel abzubrechen", async () => {
    const emp = await empennage();
    const p = emp.sections[1].pages[0].page;
    const res = await applySyncBatch(ctx, [
      { clientChangeId: "c-bad-section", kind: "section_status", payload: { sectionId: "00000000-0000-4000-8000-000000000000", status: "done" } },
      { clientChangeId: "c-dup", kind: "page_status", payload: { pageId: p.id, status: "in_progress" } },
      { clientChangeId: "c-dup", kind: "page_status", payload: { pageId: p.id, status: "done" } },
    ]);
    expect(res.results[0]).toMatchObject({ ok: false });
    expect(res.results[1]).toMatchObject({ ok: true });
    expect(res.results[2]).toEqual({ clientChangeId: "c-dup", ok: false, error: "duplicate_in_batch" });
    expect(res.statuses.find((s) => s.pageId === p.id)?.status).toBe("in_progress");
  });

  it("verlangt Schreibrecht", async () => {
    const viewer: ProjectContext = { ...ctx, role: "viewer", isPlatformAdmin: false };
    await expect(applySyncBatch(viewer, [{ clientChangeId: "c-forbidden", kind: "page_status", payload: { pageId: "x", status: "done" } }])).rejects.toBeInstanceOf(Forbidden);
  });
});

describe("Client-Sicht (DTO) spiegelt den Service", () => {
  it("optimistische Änderungen ergeben denselben Stand wie der Server", async () => {
    const emp = await empennage();
    const dto = toManualViewDto(emp);
    const sec = dto.sections[2];
    const page = sec.pages[0];
    const optimistic = applySectionChange(applyPageChange(dto, { pageId: page.id, status: "problem" }), { sectionId: sec.id, status: "done" });

    const res = await applySyncBatch(ctx, [
      { clientChangeId: "c-dto-1", kind: "page_status", payload: { pageId: page.id, status: "problem" } },
      { clientChangeId: "c-dto-2", kind: "section_status", payload: { sectionId: sec.id, status: "done" } },
    ]);
    const server = toManualViewDto(await empennage());
    const strip = (v: typeof dto) => v.sections.map((s) => ({ progress: s.progress, pages: s.pages.map((p) => ({ id: p.id, status: p.status, stored: p.stored })) }));
    expect(strip(optimistic)).toEqual(strip(server));
    // Serverstand aus der Sync-Antwort auf die alte Sicht angewandt = Serverstand
    expect(strip(applyStatusRows(dto, res.pageIds, res.statuses))).toEqual(strip(server));
    expect(optimistic.progress).toEqual(server.progress);
  });

  it("DTO ist JSON-sicher", async () => {
    const dto = toManualViewDto(await empennage());
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });
});
