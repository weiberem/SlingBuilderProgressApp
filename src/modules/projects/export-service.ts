import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { auditLog } from "@/modules/audit/schema";
import { manualRevisions, manuals, optionDimensions, pages } from "@/modules/manuals/schema";
import { extraTasks, missingParts, pageStatus } from "@/modules/progress/schema";
import { assertCan, type ProjectContext } from "./context-core";
import { projectBuildTypes, projectDeviations, projectManualRevisions, projectOptions, projects, type ProjectSettings } from "./schema";
import { getProject } from "./service";

/**
 * JSON-Export des ganzen Projekts (Datensicherung durch den Erbauer, Grundsatz «Fortschritt gehört dem Erbauer»).
 * Enthält nur Projektdaten und stabile Schlüssel der Stammdaten (Handbuch-Code, Revision, Seitennummer),
 * keine PDFs und keine Datenbank-IDs der Stammdaten; damit ist der Export auch nach einem Neuaufbau lesbar.
 * Solange es kein automatisches Backup gibt (Entscheid 16.10.2026), erinnert die App alle EXPORT_REMINDER_DAYS Tage daran.
 */
export const EXPORT_FORMAT = "sling-builder-tracker/project-export";
export const EXPORT_VERSION = 1;
export const EXPORT_REMINDER_DAYS = 3;

export type ProjectExport = {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  project: {
    registration: string;
    kitNumber: string | null;
    name: string;
    modelCode: string;
    modelName: string;
    plannedInspectionDate: string | null;
    settings: ProjectSettings;
    createdAt: string;
  };
  options: { dimension: string; value: unknown; updatedAt: string }[];
  buildTypes: { assemblyGroup: string; buildType: string }[];
  deviations: { title: string; description: string | null; category: string | null; status: string; sortOrder: number }[];
  manualRevisions: { manualCode: string; docNumber: string | null; revision: string; activatedAt: string }[];
  pageStatus: {
    manualCode: string;
    revision: string;
    pageNumber: number;
    status: string;
    naReason: string | null;
    doneAt: string | null;
    note: string | null;
    updatedAt: string;
  }[];
  extraTasks: {
    title: string;
    category: string | null;
    note: string | null;
    dueDate: string | null;
    done: boolean;
    doneAt: string | null;
    sortOrder: number;
    page: { manualCode: string; revision: string; pageNumber: number } | null;
    origin: string;
    externalRef: string | null;
    createdAt: string;
  }[];
  missingParts: {
    page: { manualCode: string; revision: string; pageNumber: number } | null;
    position: string | null;
    partNumber: string | null;
    description: string;
    quantity: string;
    unit: string;
    status: string;
    note: string | null;
    createdAt: string;
  }[];
  auditLog: { at: string; entityType: string; entityId: string; action: string; oldValue: unknown; newValue: unknown; clientChangeId: string | null }[];
};

type PageRef = { manualCode: string; revision: string; pageNumber: number };

const iso = (d: Date | string | null | undefined) => (d instanceof Date ? d.toISOString() : (d ?? null));

export async function buildProjectExport(ctx: ProjectContext): Promise<ProjectExport> {
  assertCan(ctx, "project.read");
  const db = getDb();
  const project = await getProject(ctx);

  const pageRefRows = await db
    .select({ pageId: pages.id, pageNumber: pages.pageNumber, manualCode: manuals.code, revision: manualRevisions.revision })
    .from(pages)
    .innerJoin(manualRevisions, eq(manualRevisions.id, pages.revisionId))
    .innerJoin(manuals, eq(manuals.id, manualRevisions.manualId));
  const pageRefs = new Map<string, PageRef>(pageRefRows.map((r) => [r.pageId, { manualCode: r.manualCode, revision: r.revision, pageNumber: r.pageNumber }]));
  const ref = (pageId: string | null) => (pageId ? (pageRefs.get(pageId) ?? null) : null);

  const [options, buildTypes, deviations, revisions, statuses, tasks, parts, audit] = await Promise.all([
    db
      .select({ dimension: optionDimensions.code, value: projectOptions.value, updatedAt: projectOptions.updatedAt })
      .from(projectOptions)
      .innerJoin(optionDimensions, eq(optionDimensions.id, projectOptions.dimensionId))
      .where(eq(projectOptions.projectId, ctx.projectId))
      .orderBy(asc(optionDimensions.code)),
    db.select().from(projectBuildTypes).where(eq(projectBuildTypes.projectId, ctx.projectId)).orderBy(asc(projectBuildTypes.assemblyGroup)),
    db.select().from(projectDeviations).where(eq(projectDeviations.projectId, ctx.projectId)).orderBy(asc(projectDeviations.sortOrder), asc(projectDeviations.createdAt)),
    db
      .select({ manualCode: manuals.code, docNumber: manuals.docNumber, revision: manualRevisions.revision, activatedAt: projectManualRevisions.activatedAt })
      .from(projectManualRevisions)
      .innerJoin(manuals, eq(manuals.id, projectManualRevisions.manualId))
      .innerJoin(manualRevisions, eq(manualRevisions.id, projectManualRevisions.revisionId))
      .where(eq(projectManualRevisions.projectId, ctx.projectId))
      .orderBy(asc(manuals.sortOrder)),
    db.select().from(pageStatus).where(eq(pageStatus.projectId, ctx.projectId)),
    db.select().from(extraTasks).where(eq(extraTasks.projectId, ctx.projectId)).orderBy(asc(extraTasks.sortOrder), asc(extraTasks.createdAt)),
    db.select().from(missingParts).where(eq(missingParts.projectId, ctx.projectId)).orderBy(asc(missingParts.createdAt)),
    db.select().from(auditLog).where(eq(auditLog.projectId, ctx.projectId)).orderBy(asc(auditLog.at)),
  ]);

  const pageStatusRows = statuses
    .map((s) => ({ s, r: ref(s.pageId) }))
    .filter((x): x is { s: (typeof statuses)[number]; r: PageRef } => x.r !== null)
    .map(({ s, r }) => ({ ...r, status: s.status, naReason: s.naReason, doneAt: s.doneAt, note: s.note, updatedAt: s.updatedAt.toISOString() }))
    .sort((a, b) => a.manualCode.localeCompare(b.manualCode) || a.revision.localeCompare(b.revision) || a.pageNumber - b.pageNumber);

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      registration: project.registration,
      kitNumber: project.kitNumber,
      name: project.name,
      modelCode: project.modelCode,
      modelName: project.modelName,
      plannedInspectionDate: project.plannedInspectionDate,
      settings: project.settings,
      createdAt: project.createdAt.toISOString(),
    },
    options: options.map((o) => ({ dimension: o.dimension, value: o.value, updatedAt: o.updatedAt.toISOString() })),
    buildTypes: buildTypes.map((b) => ({ assemblyGroup: b.assemblyGroup, buildType: b.buildType })),
    deviations: deviations.map((d) => ({ title: d.title, description: d.description, category: d.category, status: d.status, sortOrder: d.sortOrder })),
    manualRevisions: revisions.map((r) => ({ manualCode: r.manualCode, docNumber: r.docNumber, revision: r.revision, activatedAt: r.activatedAt.toISOString() })),
    pageStatus: pageStatusRows,
    extraTasks: tasks.map((t) => ({
      title: t.title,
      category: t.category,
      note: t.note,
      dueDate: t.dueDate,
      done: t.done,
      doneAt: t.doneAt,
      sortOrder: t.sortOrder,
      page: ref(t.pageId),
      origin: t.origin,
      externalRef: t.externalRef,
      createdAt: t.createdAt.toISOString(),
    })),
    missingParts: parts.map((p) => ({
      page: ref(p.pageId),
      position: p.position,
      partNumber: p.partNumber,
      description: p.description,
      quantity: p.quantity,
      unit: p.unit,
      status: p.status,
      note: p.note,
      createdAt: p.createdAt.toISOString(),
    })),
    auditLog: audit.map((a) => ({
      at: a.at.toISOString(),
      entityType: a.entityType,
      entityId: a.entityId,
      action: a.action,
      oldValue: a.oldValue,
      newValue: a.newValue,
      clientChangeId: a.clientChangeId,
    })),
  };
}

/** Merkt sich den Zeitpunkt des Exports (für die Erinnerung). Kein Audit: der Export ändert keine Projektdaten. */
export async function markExported(ctx: ProjectContext, at: Date = new Date()): Promise<void> {
  assertCan(ctx, "project.read");
  const db = getDb();
  const [p] = await db.select({ settings: projects.settings }).from(projects).where(eq(projects.id, ctx.projectId)).limit(1);
  if (!p) return;
  await db
    .update(projects)
    .set({ settings: { ...p.settings, lastExportAt: iso(at) ?? undefined } })
    .where(eq(projects.id, ctx.projectId));
}

export type ExportReminder = { lastExportAt: string | null; daysSince: number | null; due: boolean };

/** Erinnerung fällig, wenn nie exportiert wurde oder der letzte Export älter als EXPORT_REMINDER_DAYS Tage ist. */
export function exportReminder(settings: ProjectSettings, now: Date = new Date(), reminderDays = EXPORT_REMINDER_DAYS): ExportReminder {
  const last = settings.lastExportAt ? new Date(settings.lastExportAt) : null;
  if (!last || Number.isNaN(last.getTime())) return { lastExportAt: null, daysSince: null, due: true };
  const daysSince = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
  return { lastExportAt: last.toISOString(), daysSince, due: daysSince >= reminderDays };
}
