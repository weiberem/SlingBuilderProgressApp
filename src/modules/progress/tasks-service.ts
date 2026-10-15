import { and, asc, desc, eq, max } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { recordAudit } from "@/modules/audit/service";
import { manualRevisions, manuals, pages, sections } from "@/modules/manuals/schema";
import { assertCan, type ProjectContext } from "@/modules/projects/context-core";
import { projects } from "@/modules/projects/schema";
import { extraTasks, missingParts, type ExtraTask, type MissingPart } from "./schema";

export type TaskFilter = "open" | "done" | "all";

export type PageRef = { manualCode: string; manualTitle: string; pageNumber: number };

export type TaskWithLink = ExtraTask & { pageRef: PageRef | null };

/** Zusatzarbeiten mit Verweis auf Handbuch/Seite (über die Revision aufgelöst). */
export async function listTasks(ctx: ProjectContext, filter: TaskFilter = "open"): Promise<TaskWithLink[]> {
  assertCan(ctx, "project.read");
  const db = getDb();
  const rows = await db
    .select({ task: extraTasks })
    .from(extraTasks)
    .where(eq(extraTasks.projectId, ctx.projectId))
    .orderBy(asc(extraTasks.done), asc(extraTasks.sortOrder), asc(extraTasks.createdAt));
  const linked = rows.filter((r) => r.task.pageId);
  const refs = new Map<string, PageRef>();
  if (linked.length) {
    const refRows = await db
      .select({ pageId: pages.id, pageNumber: pages.pageNumber, manualCode: manuals.code, manualTitle: manuals.title })
      .from(pages)
      .innerJoin(sections, eq(sections.id, pages.sectionId))
      .innerJoin(manualRevisions, eq(manualRevisions.id, sections.revisionId))
      .innerJoin(manuals, eq(manuals.id, manualRevisions.manualId));
    for (const r of refRows) refs.set(r.pageId, { manualCode: r.manualCode, manualTitle: r.manualTitle, pageNumber: r.pageNumber });
  }
  return rows
    .filter((r) => (filter === "all" ? true : filter === "done" ? r.task.done : !r.task.done))
    .map((r) => ({ ...r.task, pageRef: r.task.pageId ? (refs.get(r.task.pageId) ?? null) : null }));
}

export async function listTaskCategories(ctx: ProjectContext): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ category: extraTasks.category })
    .from(extraTasks)
    .where(eq(extraTasks.projectId, ctx.projectId));
  return rows.map((r) => r.category).filter((c): c is string => !!c).sort((a, b) => a.localeCompare(b, "de"));
}

/**
 * Verweis auf eine Handbuchseite (Handbuch + Seitennummer) für Formulare, die eine Seite verknüpfen.
 * Null, wenn die Seite nicht existiert oder nicht zum Flugzeugmodell des Projekts gehört.
 */
export async function getPageRef(ctx: ProjectContext, pageId: string): Promise<(PageRef & { pageId: string }) | null> {
  assertCan(ctx, "project.read");
  const db = getDb();
  const [row] = await db
    .select({ pageId: pages.id, pageNumber: pages.pageNumber, manualCode: manuals.code, manualTitle: manuals.title, modelId: manuals.aircraftModelId })
    .from(pages)
    .innerJoin(manualRevisions, eq(manualRevisions.id, pages.revisionId))
    .innerJoin(manuals, eq(manuals.id, manualRevisions.manualId))
    .where(eq(pages.id, pageId))
    .limit(1);
  if (!row) return null;
  const [project] = await db.select({ aircraftModelId: projects.aircraftModelId }).from(projects).where(eq(projects.id, ctx.projectId)).limit(1);
  if (!project || project.aircraftModelId !== row.modelId) return null;
  return { pageId: row.pageId, pageNumber: row.pageNumber, manualCode: row.manualCode, manualTitle: row.manualTitle };
}

export type TaskInput = {
  title: string;
  category?: string | null;
  note?: string | null;
  dueDate?: string | null;
  pageId?: string | null;
};

export async function createTask(ctx: ProjectContext, input: TaskInput): Promise<ExtraTask> {
  assertCan(ctx, "tasks.write");
  const db = getDb();
  const [{ maxOrder }] = await db.select({ maxOrder: max(extraTasks.sortOrder) }).from(extraTasks).where(eq(extraTasks.projectId, ctx.projectId));
  const [row] = await db
    .insert(extraTasks)
    .values({
      projectId: ctx.projectId,
      title: input.title.trim(),
      category: input.category?.trim() || null,
      note: input.note?.trim() || null,
      dueDate: input.dueDate || null,
      pageId: input.pageId || null,
      sortOrder: (maxOrder ?? 0) + 1,
      createdBy: ctx.userId,
    })
    .returning();
  await recordAudit(db, { projectId: ctx.projectId, userId: ctx.userId, entityType: "extra_task", entityId: row.id, action: "create", newValue: row });
  return row;
}

export async function updateTask(ctx: ProjectContext, id: string, input: Partial<TaskInput> & { done?: boolean }): Promise<ExtraTask> {
  assertCan(ctx, "tasks.write");
  const db = getDb();
  const [old] = await db.select().from(extraTasks).where(and(eq(extraTasks.id, id), eq(extraTasks.projectId, ctx.projectId))).limit(1);
  if (!old) throw new Error("Zusatzarbeit nicht gefunden");
  const set: Partial<typeof extraTasks.$inferInsert> = {};
  if (input.title !== undefined) set.title = input.title.trim();
  if (input.category !== undefined) set.category = input.category?.trim() || null;
  if (input.note !== undefined) set.note = input.note?.trim() || null;
  if (input.dueDate !== undefined) set.dueDate = input.dueDate || null;
  if (input.pageId !== undefined) set.pageId = input.pageId || null;
  if (input.done !== undefined) {
    set.done = input.done;
    set.doneAt = input.done ? new Date().toISOString().slice(0, 10) : null;
  }
  const [row] = await db.update(extraTasks).set(set).where(eq(extraTasks.id, id)).returning();
  await recordAudit(db, {
    projectId: ctx.projectId,
    userId: ctx.userId,
    entityType: "extra_task",
    entityId: id,
    action: input.done !== undefined && Object.keys(set).length <= 2 ? (input.done ? "done" : "reopen") : "update",
    oldValue: { title: old.title, done: old.done, category: old.category, note: old.note, dueDate: old.dueDate },
    newValue: { title: row.title, done: row.done, category: row.category, note: row.note, dueDate: row.dueDate },
  });
  return row;
}

export async function deleteTask(ctx: ProjectContext, id: string): Promise<void> {
  assertCan(ctx, "tasks.write");
  const db = getDb();
  const [old] = await db.select().from(extraTasks).where(and(eq(extraTasks.id, id), eq(extraTasks.projectId, ctx.projectId))).limit(1);
  if (!old) return;
  await db.delete(extraTasks).where(eq(extraTasks.id, id));
  await recordAudit(db, { projectId: ctx.projectId, userId: ctx.userId, entityType: "extra_task", entityId: id, action: "delete", oldValue: old });
}

export async function countOpenTasks(ctx: ProjectContext): Promise<number> {
  const rows = await getDb().select({ id: extraTasks.id }).from(extraTasks).where(and(eq(extraTasks.projectId, ctx.projectId), eq(extraTasks.done, false)));
  return rows.length;
}

export const MISSING_PART_STATUSES = ["needed", "ordered", "received", "installed"] as const;
export type MissingPartStatus = (typeof MISSING_PART_STATUSES)[number];

export type MissingPartInput = {
  pageId?: string | null;
  position?: string | null;
  partNumber?: string | null;
  description: string;
  quantity?: string;
  unit?: string;
  note?: string | null;
};

export type MissingPartWithLink = MissingPart & { pageNumber: number | null; manualTitle: string | null; manualCode: string | null };

export async function listMissingParts(ctx: ProjectContext): Promise<MissingPartWithLink[]> {
  assertCan(ctx, "project.read");
  const db = getDb();
  const rows = await db
    .select({ part: missingParts, pageNumber: pages.pageNumber, revisionId: pages.revisionId })
    .from(missingParts)
    .leftJoin(pages, eq(pages.id, missingParts.pageId))
    .where(eq(missingParts.projectId, ctx.projectId))
    .orderBy(desc(missingParts.createdAt));
  const revIds = [...new Set(rows.map((r) => r.revisionId).filter((x): x is string => !!x))];
  const titles = new Map<string, { title: string; code: string }>();
  if (revIds.length) {
    const t = await db
      .select({ id: manualRevisions.id, title: manuals.title, code: manuals.code })
      .from(manualRevisions)
      .innerJoin(manuals, eq(manuals.id, manualRevisions.manualId));
    for (const x of t) titles.set(x.id, { title: x.title, code: x.code });
  }
  return rows.map((r) => {
    const m = r.revisionId ? titles.get(r.revisionId) : undefined;
    return { ...r.part, pageNumber: r.pageNumber ?? null, manualTitle: m?.title ?? null, manualCode: m?.code ?? null };
  });
}

export async function createMissingPart(ctx: ProjectContext, input: MissingPartInput): Promise<MissingPart> {
  assertCan(ctx, "parts.write");
  const db = getDb();
  const [row] = await db
    .insert(missingParts)
    .values({
      projectId: ctx.projectId,
      pageId: input.pageId || null,
      position: input.position?.trim() || null,
      partNumber: input.partNumber?.trim() || null,
      description: input.description.trim(),
      quantity: input.quantity ?? "1",
      unit: input.unit ?? "Stk",
      note: input.note?.trim() || null,
    })
    .returning();
  await recordAudit(db, { projectId: ctx.projectId, userId: ctx.userId, entityType: "missing_part", entityId: row.id, action: "create", newValue: row });
  return row;
}

export async function updateMissingPartStatus(ctx: ProjectContext, id: string, status: MissingPartStatus): Promise<void> {
  assertCan(ctx, "parts.write");
  const db = getDb();
  const [old] = await db.select().from(missingParts).where(and(eq(missingParts.id, id), eq(missingParts.projectId, ctx.projectId))).limit(1);
  if (!old) throw new Error("Fehlteil nicht gefunden");
  await db.update(missingParts).set({ status }).where(eq(missingParts.id, id));
  await recordAudit(db, { projectId: ctx.projectId, userId: ctx.userId, entityType: "missing_part", entityId: id, action: "status", oldValue: old.status, newValue: status });
}

export async function deleteMissingPart(ctx: ProjectContext, id: string): Promise<void> {
  assertCan(ctx, "parts.write");
  await getDb().delete(missingParts).where(and(eq(missingParts.id, id), eq(missingParts.projectId, ctx.projectId)));
}

export type MissingPartCsvRow = Pick<MissingPartWithLink, "manualTitle" | "pageNumber" | "position" | "partNumber" | "description" | "quantity" | "unit" | "status" | "note">;

/**
 * CSV-Export der Fehlteile (für eine Bestellung bei Sling). Trennzeichen `;` (Excel, de-CH),
 * Felder mit `;`, `"` oder Zeilenumbruch werden in Anführungszeichen gesetzt. Ohne BOM; den setzt der Download.
 * `statusLabels` übersetzt die Statuscodes (fehlt ein Eintrag, bleibt der Code).
 */
export function missingPartsToCsv(parts: MissingPartCsvRow[], statusLabels: Partial<Record<MissingPart["status"], string>> = {}): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Handbuch", "Seite", "Position", "Teilenummer", "Beschreibung", "Menge", "Einheit", "Status", "Notiz"];
  const lines = parts.map((p) =>
    [p.manualTitle, p.pageNumber, p.position, p.partNumber, p.description, p.quantity, p.unit, statusLabels[p.status] ?? p.status, p.note].map(esc).join(";"),
  );
  return [header.join(";"), ...lines].join("\n");
}
