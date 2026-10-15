import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, resetTestDb } from "@/test/db";
import { buildProjectContext, type ProjectContext } from "@/modules/projects/context-core";
import { getManualView, getManualsOverview, previewConfigChange, setPageStatus, setSectionStatus } from "./service";
import { getProjectConfig, saveProjectOption } from "@/modules/projects/service";
import { getDb } from "@/lib/db";
import { auditLog } from "@/modules/audit/schema";
import { eq } from "drizzle-orm";

/**
 * Erwartung aus dem Auftrag (Testprojekt HB-YMR):
 * Die MATCO-Seiten, die Parachute-Seiten und die Standardbremsen-Seiten fallen weg.
 * Die Long-Range-Seiten bleiben. Die Canopy-Version bleibt «klären», bis sie beantwortet ist.
 */
let ctx: ProjectContext;

beforeAll(async () => {
  const { userId, projectId } = await resetTestDb();
  ctx = await buildProjectContext(userId, projectId, { isPlatformAdmin: true, userName: "Test" });
});

afterAll(async () => {
  await closeDb();
});

const pageNumbers = (view: NonNullable<Awaited<ReturnType<typeof getManualView>>>, pred: (s: { relevant: boolean; needsVariantDecision: boolean; status: string; naReason: string | null }) => boolean) =>
  view.sections.flatMap((s) => s.pages).filter((p) => pred(p.status)).map((p) => p.page.pageNumber);

describe("HB-YMR Applicability", () => {
  it("Fahrwerk: MATCO- und Standardbremsen-Seiten fallen weg, Beringer Toe Brakes bleiben", async () => {
    const uc = await getManualView(ctx, "undercarriage");
    expect(uc).not.toBeNull();
    const na = pageNumbers(uc!, (s) => !s.relevant);
    expect(na).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 29]);
    const relevant = pageNumbers(uc!, (s) => s.relevant);
    expect(relevant).toEqual([11, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31]);
    expect(uc!.progress.relevant).toBe(14);
    expect(uc!.progress.needsVariantDecision).toBe(0);
  });

  it("Wing: Long-Range-Seiten bleiben, unbestätigte Regeln markieren «klären»", async () => {
    const wing = await getManualView(ctx, "wing");
    const relevant = new Set(pageNumbers(wing!, (s) => s.relevant));
    for (const n of [18, 31, 33, 43, 44, 45, 46, 47, 48, 49, 53]) expect(relevant.has(n), `Seite ${n}`).toBe(true);
    expect(wing!.progress.relevant).toBe(67);
    const clarify = pageNumbers(wing!, (s) => s.needsVariantDecision);
    expect(clarify).toEqual([22, 32]);
  });

  it("Canopy: Parachute-Seite fällt weg, Versionsseiten bleiben als «klären»", async () => {
    const can = await getManualView(ctx, "canopy");
    expect(pageNumbers(can!, (s) => !s.relevant)).toEqual([6]);
    expect(pageNumbers(can!, (s) => s.needsVariantDecision)).toEqual([5, 7, 8, 9, 25, 26, 27, 28]);
    expect(can!.revision.importReport.conflicts.length).toBeGreaterThan(0);
  });

  it("Finishing: Parachute-Seiten fallen weg, Autopilot-Seiten bleiben; QB-Hinweis ohne Build-Art → klären", async () => {
    const fin = await getManualView(ctx, "finishing");
    expect(pageNumbers(fin!, (s) => !s.relevant)).toEqual([26, 27, 28, 29, 30, 31, 32, 33]);
    const relevant = new Set(pageNumbers(fin!, (s) => s.relevant));
    for (const n of [7, 8, 9, 10]) expect(relevant.has(n)).toBe(true);
    // Build-Art unbekannt und QB-Hinweis vorhanden → Klärung nötig
    expect(fin!.progress.needsVariantDecision).toBe(fin!.progress.relevant);
  });

  it("Übersicht: Fuselage/FWF/Electrics ohne Struktur, Introduction ohne Seiten", async () => {
    const ov = await getManualsOverview(ctx);
    const byCode = Object.fromEntries(ov.manuals.map((m) => [m.manual.code, m]));
    expect(byCode.fuselage.hasStructure).toBe(false);
    expect(byCode.fwf.hasStructure).toBe(false);
    expect(byCode.empennage.progress?.relevant).toBe(27);
    expect(ov.total.relevant).toBe(27 + 67 + 14 + 27 + 50 + 12);
  });

  it("Alias: Motorbezeichnung aus Projektkonfiguration", async () => {
    const { aliasVars } = await getProjectConfig(ctx);
    expect(aliasVars["project.engine"]).toBe("916 iS");
  });
});

describe("Status setzen", () => {
  it("setzt Status mit Audit-Log, idempotent per clientChangeId", async () => {
    const emp = await getManualView(ctx, "empennage");
    const page = emp!.sections[0].pages[0].page;
    const row = await setPageStatus(ctx, { pageId: page.id, status: "done", clientChangeId: "c1" });
    expect(row.status).toBe("done");
    expect(row.doneAt).toBeTruthy();
    // Wiederholung derselben Änderung ändert nichts und schreibt keinen zweiten Audit-Eintrag.
    await setPageStatus(ctx, { pageId: page.id, status: "open", clientChangeId: "c1" });
    const after = await getManualView(ctx, "empennage");
    expect(after!.sections[0].pages[0].status.status).toBe("done");
    const audits = await getDb().select().from(auditLog).where(eq(auditLog.entityId, page.id));
    expect(audits).toHaveLength(1);
    expect(audits[0].oldValue).toBeNull();
    expect((audits[0].newValue as { status: string }).status).toBe("done");
  });

  it("Abschnitt erledigen überspringt nicht zutreffende Seiten", async () => {
    const uc = await getManualView(ctx, "undercarriage");
    const sec1314 = uc!.sections.find((s) => s.section.pageFrom === 13)!; // MATCO Standard → n/a
    const n = await setSectionStatus(ctx, { sectionId: sec1314.section.id, status: "done" });
    expect(n).toBe(0);
    const sec18 = uc!.sections.find((s) => s.section.pageFrom === 18)!;
    expect(await setSectionStatus(ctx, { sectionId: sec18.section.id, status: "done" })).toBe(1);
    const again = await getManualView(ctx, "undercarriage");
    expect(again!.sections.find((s) => s.section.pageFrom === 18)!.pages[0].status.status).toBe("done");
  });

  it("manueller Status hat Vorrang vor Konfiguration und wird als Konflikt gezählt", async () => {
    const uc = await getManualView(ctx, "undercarriage");
    const matcoPage = uc!.sections[0].pages[0].page; // Seite 1, MATCO
    await setPageStatus(ctx, { pageId: matcoPage.id, status: "done" });
    const again = await getManualView(ctx, "undercarriage");
    const pv = again!.sections[0].pages[0];
    expect(pv.status.status).toBe("done");
    expect(pv.status.conflictsWithConfig).toBe(true);
    expect(again!.progress.relevant).toBe(15);
  });
});

describe("Konfiguration ändern", () => {
  it("Diff zeigt, welche Seiten bei Wechsel auf MATCO dazukommen oder wegfallen", async () => {
    const { config } = await getProjectConfig(ctx);
    const diff = await previewConfigChange(ctx, { ...config, options: { ...config.options, brakes: { codes: ["matco"] } } });
    const added = diff.added.filter((d) => d.manual === "Undercarriage").map((d) => d.pageNumber);
    const removed = diff.removed.filter((d) => d.manual === "Undercarriage").map((d) => d.pageNumber);
    expect(added).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 16, 17]); // Seite 1 ist manuell «done» und bleibt
    expect(removed).toEqual([19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31]); // Seite 18 ist manuell «done»
  });

  it("Canopy-Version beantworten löst «klären» auf", async () => {
    await saveProjectOption(ctx, "canopy_version", { codes: ["2023"] });
    const can = await getManualView(ctx, "canopy");
    expect(pageNumbers(can!, (s) => !s.relevant)).toEqual([6, 7, 8, 9]);
    expect(pageNumbers(can!, (s) => s.needsVariantDecision)).toEqual([]);
  });
});
