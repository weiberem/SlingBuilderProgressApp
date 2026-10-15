"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth/dal";
import { Forbidden } from "@/modules/projects/context";
import { confirmRule, setRevisionPageCountAsAdmin } from "./admin-service";

export type AdminError = "unauthenticated" | "forbidden" | "invalid_input" | "has_structure" | "has_status" | "not_found" | "failed";
export type AdminResult = { ok: true } | { ok: false; error: AdminError };

const pageCountSchema = z.object({
  revisionId: z.uuid(),
  pageCount: z.coerce.number().int().min(1).max(400),
});

const confirmSchema = z.object({ ruleId: z.uuid(), confirmed: z.boolean() });

async function admin(): Promise<{ id: string; isPlatformAdmin: boolean } | null> {
  const user = await getCurrentUser();
  if (!user?.isPlatformAdmin) return null;
  return { id: user.id, isPlatformAdmin: user.isPlatformAdmin };
}

function mapError(e: unknown): AdminResult {
  if (e instanceof Forbidden) return { ok: false, error: "forbidden" };
  const msg = e instanceof Error ? e.message : "";
  if (msg.includes("bereits erfasste Abschnitte")) return { ok: false, error: "has_structure" };
  if (msg.includes("Seiten mit Status")) return { ok: false, error: "has_status" };
  if (msg.includes("nicht gefunden")) return { ok: false, error: "not_found" };
  return { ok: false, error: "failed" };
}

/** Formular «Anzahl Bauseiten erfassen» (useActionState). */
export async function setPageCountAction(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  const user = await admin();
  if (!user) return { ok: false, error: "unauthenticated" };
  const parsed = pageCountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  try {
    await setRevisionPageCountAsAdmin(user, parsed.data.revisionId, parsed.data.pageCount);
  } catch (e) {
    return mapError(e);
  }
  revalidatePath("/admin/manuals");
  revalidatePath("/p", "layout");
  return { ok: true };
}

/** Regel bestätigen oder Bestätigung zurückziehen. */
export async function confirmRuleAction(raw: unknown): Promise<AdminResult> {
  const user = await admin();
  if (!user) return { ok: false, error: "unauthenticated" };
  const parsed = confirmSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  try {
    await confirmRule(user.id, parsed.data.ruleId, parsed.data.confirmed);
  } catch (e) {
    return mapError(e);
  }
  revalidatePath("/admin/manuals");
  revalidatePath("/p", "layout");
  return { ok: true };
}
