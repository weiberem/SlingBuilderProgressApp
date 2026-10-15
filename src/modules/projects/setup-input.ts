import { z } from "zod";
import type { OptionDimension, OptionValue } from "@/modules/manuals/schema";
import type { OptionAnswer } from "./schema";

/**
 * Eingabe-Validierung des Onboardings (reine Funktionen, ohne Datenbank).
 * Die Server Actions in `setup-actions.ts` nutzen diese Schemata; die Services prüfen zusätzlich.
 */

export const codeSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "code");

export const answerSchema = z
  .object({
    codes: z.array(codeSchema).max(50).optional(),
    text: z.string().trim().max(1000).optional(),
    bool: z.boolean().optional(),
    unknown: z.literal(true).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .superRefine((a, ctx) => {
    const present = [a.codes !== undefined, a.text !== undefined, a.bool !== undefined, a.unknown === true].filter(Boolean).length;
    if (present !== 1) ctx.addIssue({ code: "custom", message: "Genau eine Antwortform (codes, text, bool oder unknown) ist erlaubt." });
  });

export const saveOptionInput = z.object({
  projectId: z.uuid(),
  dimensionCode: codeSchema,
  answer: answerSchema,
});

export const buildTypeValue = z.enum(["standard", "quick_build", "unknown"]);

export const saveBuildTypeInput = z.object({
  projectId: z.uuid(),
  assemblyGroup: codeSchema,
  buildType: buildTypeValue,
});

export const previewInput = z.object({
  projectId: z.uuid(),
  change: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("option"), dimensionCode: codeSchema, answer: answerSchema }),
    z.object({ kind: z.literal("buildType"), assemblyGroup: codeSchema, buildType: buildTypeValue }),
  ]),
});

export const deviationStatus = z.enum(["planned", "in_progress", "done", "dropped"]);

export const deviationInput = z.object({
  projectId: z.uuid(),
  id: z.uuid().optional(),
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  status: deviationStatus.default("planned"),
});

export const deleteDeviationInput = z.object({ projectId: z.uuid(), id: z.uuid() });

export const projectIdInput = z.object({ projectId: z.uuid() });

export type AnswerCheck = { ok: true } | { ok: false; error: "unknown_value" | "single_value_only" | "wrong_kind" };

/**
 * Prüft eine Antwort gegen die Achse: nur bekannte Werte-Codes, bei `single` höchstens einer,
 * Antwortform passend zur Art der Achse. «weiss ich nicht» ist für jede Achse gültig.
 */
export function checkAnswerForDimension(dim: Pick<OptionDimension, "kind">, values: Pick<OptionValue, "code">[], answer: OptionAnswer): AnswerCheck {
  if (answer.unknown) return { ok: true };
  if (answer.codes) {
    if (dim.kind !== "single" && dim.kind !== "multi") return { ok: false, error: "wrong_kind" };
    const known = new Set(values.map((v) => v.code));
    if (answer.codes.some((c) => !known.has(c))) return { ok: false, error: "unknown_value" };
    if (dim.kind === "single" && answer.codes.length > 1) return { ok: false, error: "single_value_only" };
    return { ok: true };
  }
  if (typeof answer.bool === "boolean") return dim.kind === "bool" ? { ok: true } : { ok: false, error: "wrong_kind" };
  if (typeof answer.text === "string") return dim.kind === "text" ? { ok: true } : { ok: false, error: "wrong_kind" };
  return { ok: false, error: "wrong_kind" };
}

/** Ist die Antwort «offen» (fehlt, «weiss ich nicht» oder leer)? Für die Zusammenfassung. */
export function answerState(answer: OptionAnswer | null | undefined): "missing" | "unknown" | "answered" {
  if (!answer) return "missing";
  if (answer.unknown) return "unknown";
  if (answer.codes?.length) return "answered";
  if (typeof answer.bool === "boolean") return "answered";
  if (typeof answer.text === "string" && answer.text.trim() !== "") return "answered";
  return "missing";
}
