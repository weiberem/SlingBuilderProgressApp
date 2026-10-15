"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { Forbidden, getProjectContext } from "@/modules/projects/context";
import { createTask, deleteTask, updateTask } from "./tasks-service";

export type TaskActionError = "invalid_input" | "forbidden" | "not_found" | "generic";
export type TaskActionResult = { ok: true; id?: string } | { ok: false; error: TaskActionError };

const uuid = z.string().uuid();
const isoDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);
const optionalUuid = z.union([z.literal(""), uuid]);

const taskFields = {
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100).default(""),
  note: z.string().trim().max(4000).default(""),
  dueDate: isoDate.default(""),
};

const createSchema = z.object({
  projectId: uuid,
  pageId: optionalUuid.default(""),
  redirectTo: z.string().default(""),
  ...taskFields,
});

const updateSchema = z.object({ projectId: uuid, id: uuid, ...taskFields });
const toggleSchema = z.object({ projectId: uuid, id: uuid, done: z.boolean() });
const deleteSchema = z.object({ projectId: uuid, id: uuid });

/** Fehler der Service-Schicht auf die Ergebniscodes der UI abbilden. */
function mapError(e: unknown): TaskActionResult {
  if (e instanceof Forbidden) return { ok: false, error: "forbidden" };
  if (e instanceof Error && /nicht gefunden/i.test(e.message)) return { ok: false, error: "not_found" };
  logger.error(e, "Zusatzarbeit: Aktion fehlgeschlagen");
  return { ok: false, error: "generic" };
}

/** Alle Ansichten des Projekts (Liste, Dashboard-Zähler, Seitendetail) neu laden. */
function revalidateProject(projectId: string) {
  revalidatePath(`/p/${projectId}`, "layout");
}

/** Nur Ziele innerhalb des eigenen Projekts (kein offener Redirect). */
function safeRedirect(projectId: string, target: string): string | null {
  return target.startsWith(`/p/${projectId}/`) && !target.startsWith("//") ? target : null;
}

export async function createTaskAction(_prev: TaskActionResult | null, formData: FormData): Promise<TaskActionResult> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { projectId, pageId, redirectTo, ...input } = parsed.data;
  const ctx = await getProjectContext(projectId);
  let id: string;
  try {
    const row = await createTask(ctx, { ...input, pageId: pageId || null });
    id = row.id;
  } catch (e) {
    return mapError(e);
  }
  revalidateProject(projectId);
  const target = safeRedirect(projectId, redirectTo);
  if (target) redirect(target);
  return { ok: true, id };
}

export async function updateTaskAction(_prev: TaskActionResult | null, formData: FormData): Promise<TaskActionResult> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { projectId, id, ...input } = parsed.data;
  const ctx = await getProjectContext(projectId);
  try {
    // pageId wird bewusst nicht übergeben: die Seitenverknüpfung bleibt erhalten.
    await updateTask(ctx, id, input);
  } catch (e) {
    return mapError(e);
  }
  revalidateProject(projectId);
  return { ok: true, id };
}

export async function toggleTaskDoneAction(input: { projectId: string; id: string; done: boolean }): Promise<TaskActionResult> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const ctx = await getProjectContext(parsed.data.projectId);
  try {
    await updateTask(ctx, parsed.data.id, { done: parsed.data.done });
  } catch (e) {
    return mapError(e);
  }
  revalidateProject(parsed.data.projectId);
  return { ok: true, id: parsed.data.id };
}

export async function deleteTaskAction(input: { projectId: string; id: string }): Promise<TaskActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const ctx = await getProjectContext(parsed.data.projectId);
  try {
    await deleteTask(ctx, parsed.data.id);
  } catch (e) {
    return mapError(e);
  }
  revalidateProject(parsed.data.projectId);
  return { ok: true, id: parsed.data.id };
}
