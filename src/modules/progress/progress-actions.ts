"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { Forbidden, getProjectContext } from "@/modules/projects/context";
import { setPageStatus, setSectionStatus } from "./service";
import { createMissingPart, deleteMissingPart, updateMissingPartStatus } from "./tasks-service";

export type ActionResult = { ok: true } | { ok: false; error: "invalid_input" | "forbidden" | "generic" };

const statusKind = z.enum(["open", "in_progress", "done", "not_applicable", "problem"]);
const naReason = z.enum(["manual", "config", "quick_build"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();

function fail(e: unknown): ActionResult {
  if (e instanceof Forbidden) return { ok: false, error: "forbidden" };
  logger.error(e, "Aktion fehlgeschlagen");
  return { ok: false, error: "generic" };
}

function revalidatePage(projectId: string, pageId: string) {
  revalidatePath(`/p/${projectId}/pages/${pageId}`);
  revalidatePath(`/p/${projectId}`);
}

const setPageStatusSchema = z.object({
  projectId: uuid,
  pageId: uuid,
  status: statusKind,
  naReason: naReason.nullable().optional(),
  doneAt: isoDate.nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
});

/** Status einer Seite setzen (Seitendetail). Die Handbuch-Ansicht nutzt stattdessen die Offline-Warteschlange. */
export async function setPageStatusAction(input: z.input<typeof setPageStatusSchema>): Promise<ActionResult> {
  const parsed = setPageStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { projectId, ...rest } = parsed.data;
  try {
    const ctx = await getProjectContext(projectId);
    await setPageStatus(ctx, rest);
  } catch (e) {
    return fail(e);
  }
  revalidatePage(projectId, rest.pageId);
  return { ok: true };
}

const setSectionSchema = z.object({ projectId: uuid, sectionId: uuid, status: z.enum(["done", "open"]) });

export async function setSectionStatusAction(input: z.input<typeof setSectionSchema>): Promise<ActionResult> {
  const parsed = setSectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  try {
    const ctx = await getProjectContext(parsed.data.projectId);
    await setSectionStatus(ctx, { sectionId: parsed.data.sectionId, status: parsed.data.status });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/p/${parsed.data.projectId}`);
  return { ok: true };
}

const pageDetailsSchema = z.object({
  projectId: uuid,
  pageId: uuid,
  status: statusKind,
  naReason: naReason.nullable().optional(),
  doneAt: z.union([isoDate, z.literal("")]).optional(),
  note: z.string().max(4000).optional(),
});

/** Datum und Notiz einer Seite speichern (Status bleibt). */
export async function savePageDetailsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = pageDetailsSchema.safeParse({ ...raw, naReason: raw.naReason === "" ? null : raw.naReason });
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const d = parsed.data;
  try {
    const ctx = await getProjectContext(d.projectId);
    await setPageStatus(ctx, {
      pageId: d.pageId,
      status: d.status,
      naReason: d.naReason ?? null,
      doneAt: d.doneAt ? d.doneAt : null,
      note: d.note?.trim() ? d.note.trim() : null,
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePage(d.projectId, d.pageId);
  return { ok: true };
}

const createPartSchema = z.object({
  projectId: uuid,
  pageId: uuid,
  position: z.string().max(50).optional(),
  partNumber: z.string().max(100).optional(),
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive().max(9999).default(1),
  unit: z.string().trim().max(20).optional(),
});

export async function createMissingPartAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = createPartSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const d = parsed.data;
  try {
    const ctx = await getProjectContext(d.projectId);
    await createMissingPart(ctx, {
      pageId: d.pageId,
      position: d.position,
      partNumber: d.partNumber,
      description: d.description,
      quantity: String(d.quantity),
      unit: d.unit || "Stk",
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePage(d.projectId, d.pageId);
  revalidatePath(`/p/${d.projectId}/parts`);
  return { ok: true };
}

const partRefSchema = z.object({ projectId: uuid, pageId: uuid, id: uuid });

export async function deleteMissingPartAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = partRefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const d = parsed.data;
  try {
    const ctx = await getProjectContext(d.projectId);
    await deleteMissingPart(ctx, d.id);
  } catch (e) {
    return fail(e);
  }
  revalidatePage(d.projectId, d.pageId);
  revalidatePath(`/p/${d.projectId}/parts`);
  return { ok: true };
}

const partStatusSchema = partRefSchema.extend({ status: z.enum(["needed", "ordered", "received", "installed"]) });

export async function updateMissingPartStatusAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = partStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const d = parsed.data;
  try {
    const ctx = await getProjectContext(d.projectId);
    await updateMissingPartStatus(ctx, d.id, d.status);
  } catch (e) {
    return fail(e);
  }
  revalidatePage(d.projectId, d.pageId);
  revalidatePath(`/p/${d.projectId}/parts`);
  return { ok: true };
}
