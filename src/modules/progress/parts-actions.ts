"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { Forbidden, getProjectContext } from "@/modules/projects/context";
import { MISSING_PART_STATUSES, createMissingPart, deleteMissingPart, updateMissingPartStatus, type MissingPartStatus } from "./tasks-service";

export type PartActionError = "invalid_input" | "forbidden" | "not_found" | "generic";
export type PartActionResult = { ok: true; id?: string } | { ok: false; error: PartActionError };

const uuid = z.string().uuid();
/** Menge als Dezimalzahl mit Punkt oder Komma, maximal zwei Nachkommastellen. */
const quantity = z
  .string()
  .trim()
  .regex(/^\d{1,8}([.,]\d{1,2})?$/)
  .transform((s) => s.replace(",", "."));

const createSchema = z.object({
  projectId: uuid,
  pageId: z.union([z.literal(""), uuid]).default(""),
  position: z.string().trim().max(50).default(""),
  partNumber: z.string().trim().max(100).default(""),
  description: z.string().trim().min(1).max(500),
  quantity: quantity.default("1"),
  unit: z.string().trim().min(1).max(20).default("Stk"),
  note: z.string().trim().max(2000).default(""),
});

const statusSchema = z.object({ projectId: uuid, id: uuid, status: z.enum(MISSING_PART_STATUSES) });
const deleteSchema = z.object({ projectId: uuid, id: uuid });

function mapError(e: unknown): PartActionResult {
  if (e instanceof Forbidden) return { ok: false, error: "forbidden" };
  if (e instanceof Error && /nicht gefunden/i.test(e.message)) return { ok: false, error: "not_found" };
  logger.error(e, "Fehlteil: Aktion fehlgeschlagen");
  return { ok: false, error: "generic" };
}

function revalidateProject(projectId: string) {
  revalidatePath(`/p/${projectId}`, "layout");
}

export async function createMissingPartAction(_prev: PartActionResult | null, formData: FormData): Promise<PartActionResult> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { projectId, pageId, ...input } = parsed.data;
  const ctx = await getProjectContext(projectId);
  let id: string;
  try {
    const row = await createMissingPart(ctx, { ...input, pageId: pageId || null });
    id = row.id;
  } catch (e) {
    return mapError(e);
  }
  revalidateProject(projectId);
  return { ok: true, id };
}

export async function setMissingPartStatusAction(input: { projectId: string; id: string; status: MissingPartStatus }): Promise<PartActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const ctx = await getProjectContext(parsed.data.projectId);
  try {
    await updateMissingPartStatus(ctx, parsed.data.id, parsed.data.status);
  } catch (e) {
    return mapError(e);
  }
  revalidateProject(parsed.data.projectId);
  return { ok: true, id: parsed.data.id };
}

export async function deleteMissingPartAction(input: { projectId: string; id: string }): Promise<PartActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const ctx = await getProjectContext(parsed.data.projectId);
  try {
    await deleteMissingPart(ctx, parsed.data.id);
  } catch (e) {
    return mapError(e);
  }
  revalidateProject(parsed.data.projectId);
  return { ok: true, id: parsed.data.id };
}
