import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, resetTestDb } from "@/test/db";
import { buildProjectContext, type ProjectContext } from "@/modules/projects/context-core";
import { getManualView, setPageStatus } from "@/modules/progress/service";
import { createTask } from "@/modules/progress/tasks-service";
import { EXPORT_FORMAT, EXPORT_REMINDER_DAYS, buildProjectExport, exportReminder, markExported } from "./export-service";
import { getProject } from "./service";

let ctx: ProjectContext;

beforeAll(async () => {
  const { userId, projectId } = await resetTestDb();
  ctx = await buildProjectContext(userId, projectId, { userName: "Test" });
});

afterAll(async () => {
  await closeDb();
});

describe("Projekt-Export (JSON)", () => {
  it("enthält Konfiguration, Status mit stabilen Schlüsseln, Zusatzarbeiten und Audit-Log", async () => {
    const emp = await getManualView(ctx, "empennage");
    const page = emp!.sections[0].pages[0].page;
    await setPageStatus(ctx, { pageId: page.id, status: "done", doneAt: null, note: "Datum unbekannt" });
    await createTask(ctx, { title: "Winglets laminieren", category: "Struktur", pageId: page.id });

    const data = await buildProjectExport(ctx);
    expect(data.format).toBe(EXPORT_FORMAT);
    expect(data.project.registration).toBe("HB-YMR");
    expect(data.options.find((o) => o.dimension === "brakes")?.value).toEqual({ codes: ["beringer"] });
    expect(data.buildTypes.length).toBe(9);
    expect(data.manualRevisions.some((r) => r.manualCode === "wing" && r.revision === "7")).toBe(true);
    expect(data.pageStatus).toEqual([{ manualCode: "empennage", revision: emp!.revision.revision, pageNumber: page.pageNumber, status: "done", naReason: null, doneAt: null, note: "Datum unbekannt", updatedAt: expect.any(String) }]);
    expect(data.extraTasks[0]).toMatchObject({ title: "Winglets laminieren", page: { manualCode: "empennage", pageNumber: page.pageNumber } });
    expect(data.auditLog.some((a) => a.entityType === "page_status" && a.entityId === page.id)).toBe(true);
    // Keine Datenbank-IDs der Stammdaten im Export (Lesbarkeit nach Neuaufbau).
    expect(JSON.stringify(data.pageStatus)).not.toContain(page.id);
  });

  it("merkt sich den Exportzeitpunkt; Erinnerung nach EXPORT_REMINDER_DAYS Tagen", async () => {
    const before = await getProject(ctx);
    expect(exportReminder(before.settings).due).toBe(true);
    const at = new Date("2026-10-16T08:00:00.000Z");
    await markExported(ctx, at);
    const after = await getProject(ctx);
    expect(after.settings.lastExportAt).toBe(at.toISOString());
    expect(after.settings.onboardingCompletedAt).toBe(before.settings.onboardingCompletedAt);
    expect(exportReminder(after.settings, new Date("2026-10-18T07:00:00.000Z"))).toEqual({ lastExportAt: at.toISOString(), daysSince: 1, due: false });
    expect(exportReminder(after.settings, new Date(at.getTime() + EXPORT_REMINDER_DAYS * 86_400_000))).toMatchObject({ daysSince: EXPORT_REMINDER_DAYS, due: true });
  });
});
