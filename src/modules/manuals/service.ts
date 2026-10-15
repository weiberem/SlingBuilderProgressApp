import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import { recordAudit } from "@/modules/audit/service";
import { pageStatus } from "@/modules/progress/schema";
import { projectManualRevisions, projects } from "@/modules/projects/schema";
import { assertCan, type ProjectContext } from "@/modules/projects/context";
import { applyAliases, selectAliases, type AliasRule } from "./aliases";
import {
  aliases,
  applicabilityRules,
  manualRevisions,
  manuals,
  pages,
  sections,
  type ApplicabilityRule,
  type Manual,
  type ManualRevision,
  type Page,
  type Section,
} from "./schema";

export type RevisionStructure = {
  revision: ManualRevision;
  manual: Manual;
  sections: (Section & { pages: Page[] })[];
  /** Regeln je Ziel: `page:<id>` oder `section:<id>`. */
  rulesByTarget: Map<string, ApplicabilityRule[]>;
};

export async function loadRevisionStructure(db: Db, revisionId: string): Promise<RevisionStructure> {
  const [row] = await db
    .select({ revision: manualRevisions, manual: manuals })
    .from(manualRevisions)
    .innerJoin(manuals, eq(manuals.id, manualRevisions.manualId))
    .where(eq(manualRevisions.id, revisionId))
    .limit(1);
  if (!row) throw new Error("Revision nicht gefunden");
  const secs = await db.select().from(sections).where(eq(sections.revisionId, revisionId)).orderBy(asc(sections.sortOrder));
  const pgs = await db.select().from(pages).where(eq(pages.revisionId, revisionId)).orderBy(asc(pages.pageNumber));
  const targetIds = [...secs.map((s) => s.id), ...pgs.map((p) => p.id)];
  const rules = targetIds.length ? await db.select().from(applicabilityRules).where(inArray(applicabilityRules.targetId, targetIds)) : [];
  const rulesByTarget = new Map<string, ApplicabilityRule[]>();
  for (const r of rules) {
    const key = `${r.targetType}:${r.targetId}`;
    rulesByTarget.set(key, [...(rulesByTarget.get(key) ?? []), r]);
  }
  return {
    revision: row.revision,
    manual: row.manual,
    sections: secs.map((s) => ({ ...s, pages: pgs.filter((p) => p.sectionId === s.id) })),
    rulesByTarget,
  };
}

/** Regeln einer Seite = Seitenregeln + Abschnittsregeln. */
export function rulesForPage(structure: RevisionStructure, page: Page): ApplicabilityRule[] {
  return [...(structure.rulesByTarget.get(`page:${page.id}`) ?? []), ...(structure.rulesByTarget.get(`section:${page.sectionId}`) ?? [])];
}

export async function loadAliasesForModel(db: Db, modelId: string): Promise<AliasRule[]> {
  return db.select().from(aliases).where(eq(aliases.scopeModelId, modelId));
}

export function displayTitle(
  original: string,
  all: AliasRule[],
  scope: { modelId: string; manualId: string; revisionId: string },
  vars: Record<string, string>,
) {
  return applyAliases(original, selectAliases(all, scope), vars);
}

export type ManualWithRevision = { manual: Manual; revision: ManualRevision | null };

/** Alle Handbücher des Projektmodells mit der aktiven Revision (null = keine freigegebene). */
export async function listManualsWithActiveRevision(db: Db, projectId: string): Promise<ManualWithRevision[]> {
  const [project] = await db.select({ aircraftModelId: projects.aircraftModelId }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw new Error("Projekt nicht gefunden");
  const ms = await db.select().from(manuals).where(eq(manuals.aircraftModelId, project.aircraftModelId)).orderBy(asc(manuals.sortOrder));
  const active = await db
    .select({ manualId: projectManualRevisions.manualId, revision: manualRevisions })
    .from(projectManualRevisions)
    .innerJoin(manualRevisions, eq(manualRevisions.id, projectManualRevisions.revisionId))
    .where(eq(projectManualRevisions.projectId, projectId));
  return ms.map((m) => ({ manual: m, revision: active.find((a) => a.manualId === m.id)?.revision ?? null }));
}

export async function listRevisionsForManual(db: Db, manualId: string): Promise<ManualRevision[]> {
  return db.select().from(manualRevisions).where(eq(manualRevisions.manualId, manualId)).orderBy(asc(manualRevisions.createdAt));
}

/**
 * Admin: Anzahl Bauseiten einer Revision ohne erfasste Struktur setzen (z. B. Fuselage 8.5 vor der OCR).
 * Legt einen Abschnitt «Seiten 1–n» mit Seiten ohne Titel an bzw. verlängert/kürzt ihn.
 * Seiten mit Status werden nie gelöscht.
 */
export async function setRevisionPageCount(ctx: ProjectContext, revisionId: string, pageCount: number): Promise<void> {
  assertCan(ctx, "manuals.admin");
  await applyRevisionPageCount(ctx.userId, revisionId, pageCount);
}

/** Kern von `setRevisionPageCount` ohne Rechteprüfung; der Aufrufer (Kontext oder Plattform-Admin) prüft. */
export async function applyRevisionPageCount(userId: string, revisionId: string, pageCount: number): Promise<void> {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 400) throw new Error("Seitenzahl ungültig (1–400)");
  const db = getDb();
  const structure = await loadRevisionStructure(db, revisionId);
  const titled = structure.sections.filter((s) => !s.isUntitled);
  if (titled.length > 0) throw new Error("Revision hat bereits erfasste Abschnitte; Seitenzahl kommt aus der Struktur.");

  await db.transaction(async (tx) => {
    let section = structure.sections[0];
    const title = `Seiten 1–${pageCount}`;
    if (!section) {
      const [ins] = await tx
        .insert(sections)
        .values({
          revisionId,
          sortOrder: 1,
          titleOriginal: title,
          pageFrom: 1,
          pageTo: pageCount,
          isUntitled: true,
          notes: "Abschnitte noch nicht erfasst (Seitenzahl manuell gesetzt).",
        })
        .returning();
      section = { ...ins, pages: [] };
    } else {
      const existingPageIds = section.pages.filter((p) => p.pageNumber > pageCount).map((p) => p.id);
      if (existingPageIds.length) {
        const withStatus = await tx.select({ id: pageStatus.pageId }).from(pageStatus).where(inArray(pageStatus.pageId, existingPageIds));
        if (withStatus.length) throw new Error("Seitenzahl kann nicht unter Seiten mit Status gekürzt werden.");
        await tx.delete(pages).where(inArray(pages.id, existingPageIds));
      }
      await tx.update(sections).set({ titleOriginal: title, pageTo: pageCount }).where(eq(sections.id, section.id));
    }
    const existing = new Set(section.pages.map((p) => p.pageNumber));
    const toInsert = [];
    for (let n = 1; n <= pageCount; n++) {
      if (!existing.has(n)) toInsert.push({ revisionId, sectionId: section.id, pageNumber: n, flags: { noText: true } });
    }
    if (toInsert.length) await tx.insert(pages).values(toInsert);
    await tx.update(manualRevisions).set({ pageCount }).where(eq(manualRevisions.id, revisionId));
    await recordAudit(tx, {
      projectId: null,
      userId,
      entityType: "manual_revision",
      entityId: revisionId,
      action: "set_page_count",
      oldValue: structure.revision.pageCount,
      newValue: pageCount,
    });
  });
}

export async function findManualByCode(db: Db, projectId: string, manualCode: string): Promise<Manual | null> {
  const [project] = await db.select({ aircraftModelId: projects.aircraftModelId }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return null;
  const [m] = await db
    .select()
    .from(manuals)
    .where(and(eq(manuals.aircraftModelId, project.aircraftModelId), eq(manuals.code, manualCode)))
    .limit(1);
  return m ?? null;
}
