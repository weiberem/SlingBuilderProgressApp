import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import { hasClientChange, listAuditForEntity, recordAudit } from "@/modules/audit/service";
import {
  effectiveStatus,
  pageApplicability,
  type EffectiveStatus,
  type NaReason,
  type PageApplicability,
  type ProjectConfig,
  type StatusKind,
} from "@/modules/manuals/applicability";
import type { AliasRule } from "@/modules/manuals/aliases";
import { pages as pagesTbl, sections as sectionsTbl, type Manual, type ManualRevision, type Page, type Section } from "@/modules/manuals/schema";
import {
  displayTitle,
  findManualByCode,
  listManualsWithActiveRevision,
  loadAliasesForModel,
  loadRevisionStructure,
  rulesForPage,
  type RevisionStructure,
} from "@/modules/manuals/service";
import { assertCan, type ProjectContext } from "@/modules/projects/context-core";
import { getProject, getProjectConfig } from "@/modules/projects/service";
import { mergeProgress, summarizeProgress, type ProgressSummary } from "./progress";
import { extraTasks, missingParts, pageStatus, visas, type PageStatus } from "./schema";

export type PageView = {
  page: Page;
  titleDisplay: string;
  titleOriginal: string;
  titleChanged: boolean;
  status: EffectiveStatus;
  applicability: PageApplicability;
  stored: PageStatus | null;
};

export type SectionView = {
  section: Section;
  titleDisplay: string;
  titleChanged: boolean;
  pages: PageView[];
  progress: ProgressSummary;
};

export type ManualView = {
  manual: Manual;
  revision: ManualRevision;
  sections: SectionView[];
  progress: ProgressSummary;
  hasStructure: boolean;
};

async function loadContextData(ctx: ProjectContext, db: Db) {
  const project = await getProject(ctx);
  const { config, aliasVars } = await getProjectConfig(ctx, db);
  const aliasRules = await loadAliasesForModel(db, project.aircraftModelId);
  return { project, config, aliasVars, aliasRules };
}

function buildManualView(
  structure: RevisionStructure,
  stored: Map<string, PageStatus>,
  config: ProjectConfig,
  aliasRules: AliasRule[],
  aliasVars: Record<string, string>,
  modelId: string,
): ManualView {
  const scope = { modelId, manualId: structure.manual.id, revisionId: structure.revision.id };
  const sectionViews: SectionView[] = structure.sections.map((s) => {
    const sectionTitle = displayTitle(s.titleOriginal, aliasRules, scope, aliasVars);
    const pageViews: PageView[] = s.pages.map((p) => {
      const applicability = pageApplicability(p, rulesForPage(structure, p), config, structure.manual.assemblyGroup);
      const row = stored.get(p.id) ?? null;
      const status = effectiveStatus(row ? { status: row.status, naReason: row.naReason } : null, applicability);
      const original = p.titleOriginal ?? s.titleOriginal;
      const t = p.titleOriginal ? displayTitle(p.titleOriginal, aliasRules, scope, aliasVars) : sectionTitle;
      return { page: p, titleDisplay: t.display, titleOriginal: original, titleChanged: t.changed, status, applicability, stored: row };
    });
    return {
      section: s,
      titleDisplay: sectionTitle.display,
      titleChanged: sectionTitle.changed,
      pages: pageViews,
      progress: summarizeProgress(pageViews.map((v) => v.status)),
    };
  });
  return {
    manual: structure.manual,
    revision: structure.revision,
    sections: sectionViews,
    progress: mergeProgress(sectionViews.map((s) => s.progress)),
    hasStructure: sectionViews.some((s) => s.pages.length > 0),
  };
}

/** Alle gespeicherten Seitenstatus des Projekts (Seiten fremder Revisionen stören nicht, sie werden nie nachgeschlagen). */
async function loadStoredStatuses(db: Db, projectId: string): Promise<Map<string, PageStatus>> {
  const rows = await db.select().from(pageStatus).where(eq(pageStatus.projectId, projectId));
  return new Map(rows.map((r) => [r.pageId, r]));
}

export type ManualOverview = {
  manual: Manual;
  revision: ManualRevision | null;
  progress: ProgressSummary | null;
  hasStructure: boolean;
};

/** Übersicht aller Handbücher mit Fortschritt (nur zutreffende Seiten). */
export async function getManualsOverview(ctx: ProjectContext): Promise<{ manuals: ManualOverview[]; total: ProgressSummary }> {
  assertCan(ctx, "project.read");
  const db = getDb();
  const { project, config, aliasVars, aliasRules } = await loadContextData(ctx, db);
  const list = await listManualsWithActiveRevision(db, ctx.projectId);
  const stored = await loadStoredStatuses(db, ctx.projectId);
  const out: ManualOverview[] = [];
  for (const { manual, revision } of list) {
    if (!revision) {
      out.push({ manual, revision: null, progress: null, hasStructure: false });
      continue;
    }
    const structure = await loadRevisionStructure(db, revision.id);
    const view = buildManualView(structure, stored, config, aliasRules, aliasVars, project.aircraftModelId);
    out.push({ manual, revision, progress: view.hasStructure ? view.progress : null, hasStructure: view.hasStructure });
  }
  const total = mergeProgress(out.map((o) => o.progress).filter((p): p is ProgressSummary => !!p));
  return { manuals: out, total };
}

export async function getManualView(ctx: ProjectContext, manualCode: string): Promise<ManualView | null> {
  assertCan(ctx, "project.read");
  const db = getDb();
  const manual = await findManualByCode(db, ctx.projectId, manualCode);
  if (!manual) return null;
  const list = await listManualsWithActiveRevision(db, ctx.projectId);
  const revision = list.find((l) => l.manual.id === manual.id)?.revision;
  if (!revision) return null;
  const { project, config, aliasVars, aliasRules } = await loadContextData(ctx, db);
  const structure = await loadRevisionStructure(db, revision.id);
  const stored = await loadStoredStatuses(db, ctx.projectId);
  return buildManualView(structure, stored, config, aliasRules, aliasVars, project.aircraftModelId);
}

export type PageDetail = PageView & {
  manual: Manual;
  revision: ManualRevision;
  section: Section;
  sectionTitleDisplay: string;
  rules: { sourceText: string | null; rationale: string | null; confirmed: boolean; effect: string }[];
  missingParts: (typeof missingParts.$inferSelect)[];
  tasks: (typeof extraTasks.$inferSelect)[];
  visas: (typeof visas.$inferSelect)[];
  history: Awaited<ReturnType<typeof listAuditForEntity>>;
  prev: { id: string; pageNumber: number } | null;
  next: { id: string; pageNumber: number } | null;
};

export async function getPageDetail(ctx: ProjectContext, pageId: string): Promise<PageDetail | null> {
  assertCan(ctx, "project.read");
  const db = getDb();
  const [p] = await db.select().from(pagesTbl).where(eq(pagesTbl.id, pageId)).limit(1);
  if (!p) return null;
  const list = await listManualsWithActiveRevision(db, ctx.projectId);
  const entry = list.find((l) => l.revision?.id === p.revisionId);
  if (!entry?.revision) return null;
  const { project, config, aliasVars, aliasRules } = await loadContextData(ctx, db);
  const structure = await loadRevisionStructure(db, entry.revision.id);
  const stored = await loadStoredStatuses(db, ctx.projectId);
  const view = buildManualView(structure, stored, config, aliasRules, aliasVars, project.aircraftModelId);
  const flat = view.sections.flatMap((s) => s.pages.map((pv) => ({ pv, s })));
  const idx = flat.findIndex((f) => f.pv.page.id === pageId);
  if (idx < 0) return null;
  const { pv, s } = flat[idx];
  const [parts, tasks, visaRows, history] = await Promise.all([
    db.select().from(missingParts).where(and(eq(missingParts.projectId, ctx.projectId), eq(missingParts.pageId, pageId))).orderBy(asc(missingParts.createdAt)),
    db.select().from(extraTasks).where(and(eq(extraTasks.projectId, ctx.projectId), eq(extraTasks.pageId, pageId))).orderBy(asc(extraTasks.sortOrder)),
    db.select().from(visas).where(and(eq(visas.projectId, ctx.projectId), eq(visas.targetType, "page"), eq(visas.targetId, pageId))),
    listAuditForEntity(db, ctx.projectId, "page_status", pageId),
  ]);
  const rules = rulesForPage(structure, pv.page).map((r) => ({ sourceText: r.sourceText, rationale: r.rationale, confirmed: r.confirmed, effect: r.effect }));
  return {
    ...pv,
    manual: view.manual,
    revision: view.revision,
    section: s.section,
    sectionTitleDisplay: s.titleDisplay,
    rules,
    missingParts: parts,
    tasks,
    visas: visaRows,
    history,
    prev: idx > 0 ? { id: flat[idx - 1].pv.page.id, pageNumber: flat[idx - 1].pv.page.pageNumber } : null,
    next: idx < flat.length - 1 ? { id: flat[idx + 1].pv.page.id, pageNumber: flat[idx + 1].pv.page.pageNumber } : null,
  };
}

export type SetPageStatusInput = {
  pageId: string;
  status: StatusKind;
  naReason?: NaReason | null;
  note?: string | null;
  doneAt?: string | null;
  clientChangeId?: string | null;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Setzt den Status einer Seite (idempotent über clientChangeId) und schreibt das Audit-Log. */
export async function setPageStatus(ctx: ProjectContext, input: SetPageStatusInput): Promise<PageStatus> {
  assertCan(ctx, "progress.write");
  const db = getDb();
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(pageStatus)
      .where(and(eq(pageStatus.projectId, ctx.projectId), eq(pageStatus.pageId, input.pageId)))
      .limit(1);
    if (input.clientChangeId && (await hasClientChange(tx, input.clientChangeId))) {
      if (existing) return existing;
    }
    const naReason = input.status === "not_applicable" ? (input.naReason ?? "manual") : null;
    const doneAt = input.status === "done" ? (input.doneAt ?? existing?.doneAt ?? today()) : input.status === "open" ? null : (existing?.doneAt ?? null);
    const note = input.note === undefined ? (existing?.note ?? null) : input.note;
    const values = { status: input.status, naReason, doneAt, note, updatedBy: ctx.userId };
    const [row] = await tx
      .insert(pageStatus)
      .values({ projectId: ctx.projectId, pageId: input.pageId, ...values })
      .onConflictDoUpdate({ target: [pageStatus.projectId, pageStatus.pageId], set: values })
      .returning();
    await recordAudit(tx, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      entityType: "page_status",
      entityId: input.pageId,
      action: "set",
      oldValue: existing ? { status: existing.status, naReason: existing.naReason, doneAt: existing.doneAt, note: existing.note } : null,
      newValue: { status: row.status, naReason: row.naReason, doneAt: row.doneAt, note: row.note },
      clientChangeId: input.clientChangeId ?? null,
    });
    return row;
  });
}

/**
 * Ganzen Abschnitt setzen. Seiten, die laut Konfiguration nicht zutreffen, werden nur bei «open» (Zurücksetzen) berührt.
 */
export async function setSectionStatus(
  ctx: ProjectContext,
  input: { sectionId: string; status: "done" | "open"; clientChangeId?: string | null },
): Promise<number> {
  assertCan(ctx, "progress.write");
  const db = getDb();
  const [sec] = await db.select().from(sectionsTbl).where(eq(sectionsTbl.id, input.sectionId)).limit(1);
  if (!sec) throw new Error("Abschnitt nicht gefunden");
  const list = await listManualsWithActiveRevision(db, ctx.projectId);
  if (!list.some((l) => l.revision?.id === sec.revisionId)) throw new Error("Abschnitt gehört nicht zur aktiven Revision");
  const { project, config, aliasVars, aliasRules } = await loadContextData(ctx, db);
  const structure = await loadRevisionStructure(db, sec.revisionId);
  const stored = await loadStoredStatuses(db, ctx.projectId);
  const view = buildManualView(structure, stored, config, aliasRules, aliasVars, project.aircraftModelId);
  const sv = view.sections.find((s) => s.section.id === input.sectionId);
  if (!sv) return 0;
  let n = 0;
  for (const pv of sv.pages) {
    if (input.status === "done") {
      if (!pv.status.relevant || pv.status.status === "done") continue;
    } else if (!pv.stored || pv.stored.status === "open") continue;
    await setPageStatus(ctx, {
      pageId: pv.page.id,
      status: input.status,
      clientChangeId: input.clientChangeId ? `${input.clientChangeId}:${pv.page.pageNumber}` : null,
    });
    n++;
  }
  return n;
}

export type ConfigDiff = {
  added: { manual: string; pageNumber: number; title: string }[];
  removed: { manual: string; pageNumber: number; title: string }[];
  toClarify: { manual: string; pageNumber: number; title: string }[];
};

/** Zeigt vor einer Konfigurationsänderung, welche Seiten dazukommen, wegfallen oder zu klären sind. */
export async function previewConfigChange(ctx: ProjectContext, next: ProjectConfig): Promise<ConfigDiff> {
  assertCan(ctx, "project.read");
  const db = getDb();
  const { project, config, aliasVars, aliasRules } = await loadContextData(ctx, db);
  const list = await listManualsWithActiveRevision(db, ctx.projectId);
  const stored = await loadStoredStatuses(db, ctx.projectId);
  const diff: ConfigDiff = { added: [], removed: [], toClarify: [] };
  for (const { manual, revision } of list) {
    if (!revision) continue;
    const structure = await loadRevisionStructure(db, revision.id);
    const before = buildManualView(structure, stored, config, aliasRules, aliasVars, project.aircraftModelId);
    const after = buildManualView(structure, stored, next, aliasRules, aliasVars, project.aircraftModelId);
    const bPages = before.sections.flatMap((s) => s.pages);
    const aPages = after.sections.flatMap((s) => s.pages);
    for (let i = 0; i < bPages.length; i++) {
      const b = bPages[i];
      const a = aPages[i];
      const ref = { manual: manual.title, pageNumber: b.page.pageNumber, title: a.titleDisplay };
      if (!b.status.relevant && a.status.relevant) diff.added.push(ref);
      else if (b.status.relevant && !a.status.relevant) diff.removed.push(ref);
      else if (!b.status.needsVariantDecision && a.status.needsVariantDecision) diff.toClarify.push(ref);
    }
  }
  return diff;
}

export async function listStatusesForPages(db: Db, projectId: string, pageIds: string[]): Promise<PageStatus[]> {
  if (!pageIds.length) return [];
  return db.select().from(pageStatus).where(and(eq(pageStatus.projectId, projectId), inArray(pageStatus.pageId, pageIds)));
}
