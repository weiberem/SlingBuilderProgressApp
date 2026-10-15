import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb, resetTestDb } from "@/test/db";
import { buildProjectContext, Forbidden, type ProjectContext } from "@/modules/projects/context-core";
import { auditLog } from "@/modules/audit/schema";
import { getManualView } from "./service";
import {
  countOpenTasks,
  createMissingPart,
  createTask,
  deleteMissingPart,
  deleteTask,
  getPageRef,
  listMissingParts,
  listTaskCategories,
  listTasks,
  updateMissingPartStatus,
  updateTask,
} from "./tasks-service";

let ctx: ProjectContext;
let pageId: string;

beforeAll(async () => {
  const { userId, projectId } = await resetTestDb();
  ctx = await buildProjectContext(userId, projectId, { isPlatformAdmin: true, userName: "Test" });
  const emp = await getManualView(ctx, "empennage");
  pageId = emp!.sections[0].pages[0].page.id;
});

afterAll(async () => {
  await closeDb();
});

describe("Zusatzarbeiten", () => {
  it("Seitenverweis liefert Handbuch und Seitennummer, unbekannte Seite → null", async () => {
    const ref = await getPageRef(ctx, pageId);
    expect(ref).toEqual({ pageId, pageNumber: 1, manualCode: "empennage", manualTitle: expect.any(String) });
    expect(await getPageRef(ctx, "00000000-0000-7000-8000-000000000000")).toBeNull();
  });

  it("anlegen, filtern, Bereiche, Seitenverweis", async () => {
    const a = await createTask(ctx, { title: "  Nieten nachsetzen ", category: " Struktur ", note: "Rumpf hinten", dueDate: "2026-11-01", pageId });
    const b = await createTask(ctx, { title: "Kabelbaum prüfen", category: "Avionik" });
    const c = await createTask(ctx, { title: "Ohne Bereich", category: "" });
    expect(a.title).toBe("Nieten nachsetzen");
    expect(a.category).toBe("Struktur");
    expect(c.category).toBeNull();
    expect(b.sortOrder).toBeGreaterThan(a.sortOrder);

    const open = await listTasks(ctx, "open");
    expect(open.map((t) => t.id)).toEqual([a.id, b.id, c.id]);
    expect(open[0].pageRef).toEqual({ manualCode: "empennage", manualTitle: expect.any(String), pageNumber: 1 });
    expect(open[1].pageRef).toBeNull();
    expect(await listTaskCategories(ctx)).toEqual(["Avionik", "Struktur"]);
    expect(await countOpenTasks(ctx)).toBe(3);
  });

  it("erledigt setzen und wieder öffnen schreibt Audit-Einträge", async () => {
    const [t] = await listTasks(ctx, "open");
    const done = await updateTask(ctx, t.id, { done: true });
    expect(done.done).toBe(true);
    expect(done.doneAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await listTasks(ctx, "open")).map((x) => x.id)).not.toContain(t.id);
    expect((await listTasks(ctx, "done")).map((x) => x.id)).toEqual([t.id]);
    expect((await listTasks(ctx, "all")).length).toBe(3);
    expect(await countOpenTasks(ctx)).toBe(2);

    const reopened = await updateTask(ctx, t.id, { done: false });
    expect(reopened.done).toBe(false);
    expect(reopened.doneAt).toBeNull();
    const audits = await getDb().select().from(auditLog).where(eq(auditLog.entityId, t.id));
    expect(audits.map((a) => a.action)).toEqual(["create", "done", "reopen"]);
  });

  it("bearbeiten behält die Seitenverknüpfung, wenn pageId nicht übergeben wird", async () => {
    const [t] = await listTasks(ctx, "open");
    const upd = await updateTask(ctx, t.id, { title: "Nieten nachsetzen (hinten)", category: "Struktur & Eigenbau", note: "", dueDate: null });
    expect(upd.title).toBe("Nieten nachsetzen (hinten)");
    expect(upd.note).toBeNull();
    expect(upd.dueDate).toBeNull();
    expect(upd.pageId).toBe(pageId);
  });

  it("löschen entfernt die Zusatzarbeit und ist idempotent", async () => {
    const [t] = await listTasks(ctx, "open");
    await deleteTask(ctx, t.id);
    await deleteTask(ctx, t.id);
    expect((await listTasks(ctx, "all")).map((x) => x.id)).not.toContain(t.id);
  });

  it("Betrachter dürfen nicht schreiben", async () => {
    const viewer: ProjectContext = { ...ctx, role: "viewer", isPlatformAdmin: false };
    await expect(createTask(viewer, { title: "x" })).rejects.toBeInstanceOf(Forbidden);
    expect((await listTasks(viewer, "all")).length).toBe(2);
  });
});

describe("Fehlteile", () => {
  it("anlegen mit und ohne Seite, Handbuch wird aufgelöst", async () => {
    const withPage = await createMissingPart(ctx, { pageId, position: "12", partNumber: "SL-123", description: "Niete 3.2", quantity: "20", unit: "Stk" });
    const noPage = await createMissingPart(ctx, { description: "Schlauchschelle", note: "Grösse klären" });
    expect(withPage.status).toBe("needed");
    expect(Number(noPage.quantity)).toBe(1);
    const list = await listMissingParts(ctx);
    const a = list.find((p) => p.id === withPage.id)!;
    const b = list.find((p) => p.id === noPage.id)!;
    expect(a.pageNumber).toBe(1);
    expect(a.manualCode).toBe("empennage");
    expect(a.manualTitle).toEqual(expect.any(String));
    expect(b.pageNumber).toBeNull();
    expect(b.manualCode).toBeNull();
  });

  it("Status wechseln und löschen", async () => {
    const [p] = await listMissingParts(ctx);
    await updateMissingPartStatus(ctx, p.id, "ordered");
    expect((await listMissingParts(ctx)).find((x) => x.id === p.id)!.status).toBe("ordered");
    await expect(updateMissingPartStatus(ctx, "00000000-0000-7000-8000-000000000000", "received")).rejects.toThrow();
    await deleteMissingPart(ctx, p.id);
    expect((await listMissingParts(ctx)).map((x) => x.id)).not.toContain(p.id);
  });
});
