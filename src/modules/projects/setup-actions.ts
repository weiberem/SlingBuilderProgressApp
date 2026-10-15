"use server";

import { revalidatePath } from "next/cache";
import type { ConfigDiff } from "@/modules/progress/service";
import { previewConfigChange } from "@/modules/progress/service";
import { Forbidden, getProjectContext } from "./context";
import {
  deleteDeviation,
  getProjectConfig,
  getWizardData,
  markOnboardingComplete,
  saveBuildType,
  saveProjectOption,
  upsertDeviation,
} from "./service";
import {
  checkAnswerForDimension,
  deleteDeviationInput,
  deviationInput,
  previewInput,
  projectIdInput,
  saveBuildTypeInput,
  saveOptionInput,
} from "./setup-input";

export type SetupError =
  | "invalid_input"
  | "unknown_dimension"
  | "unknown_value"
  | "single_value_only"
  | "wrong_kind"
  | "forbidden"
  | "save_failed";

export type SetupResult = { ok: true } | { ok: false; error: SetupError };

/** Diff je Handbuch für die Vorschau vor dem Speichern. */
export type DiffByManual = {
  manual: string;
  added: { pageNumber: number; title: string }[];
  removed: { pageNumber: number; title: string }[];
  toClarify: { pageNumber: number; title: string }[];
};

export type PreviewResult = { ok: true; changes: DiffByManual[]; total: number } | { ok: false; error: SetupError };

function groupDiff(diff: ConfigDiff): DiffByManual[] {
  const by = new Map<string, DiffByManual>();
  const get = (manual: string) => {
    let g = by.get(manual);
    if (!g) {
      g = { manual, added: [], removed: [], toClarify: [] };
      by.set(manual, g);
    }
    return g;
  };
  for (const d of diff.added) get(d.manual).added.push({ pageNumber: d.pageNumber, title: d.title });
  for (const d of diff.removed) get(d.manual).removed.push({ pageNumber: d.pageNumber, title: d.title });
  for (const d of diff.toClarify) get(d.manual).toClarify.push({ pageNumber: d.pageNumber, title: d.title });
  return [...by.values()];
}

function failure(e: unknown): { ok: false; error: SetupError } {
  if (e instanceof Forbidden) return { ok: false, error: "forbidden" };
  return { ok: false, error: "save_failed" };
}

function setupPath(projectId: string) {
  return `/p/${projectId}/setup`;
}

/** Vorschau: welche Seiten kommen dazu, fallen weg oder sind zu klären, wenn diese Antwort gespeichert wird. */
export async function previewSetupChangeAction(raw: unknown): Promise<PreviewResult> {
  const parsed = previewInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { projectId, change } = parsed.data;
  try {
    const ctx = await getProjectContext(projectId);
    const { config } = await getProjectConfig(ctx);
    const next =
      change.kind === "option"
        ? { ...config, options: { ...config.options, [change.dimensionCode]: change.answer } }
        : { ...config, buildTypes: { ...config.buildTypes, [change.assemblyGroup]: change.buildType } };
    const diff = await previewConfigChange(ctx, next);
    const changes = groupDiff(diff);
    return { ok: true, changes, total: diff.added.length + diff.removed.length + diff.toClarify.length };
  } catch (e) {
    return failure(e);
  }
}

/** Speichert eine Onboarding-Antwort. Unbekannte Achsen oder Werte werden abgelehnt. */
export async function saveOptionAction(raw: unknown): Promise<SetupResult> {
  const parsed = saveOptionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { projectId, dimensionCode, answer } = parsed.data;
  try {
    const ctx = await getProjectContext(projectId);
    const wizard = await getWizardData(ctx);
    const dim = wizard.groups.flatMap((g) => g.dimensions).find((d) => d.code === dimensionCode);
    if (!dim) return { ok: false, error: "unknown_dimension" };
    const check = checkAnswerForDimension(dim, dim.values, answer);
    if (!check.ok) return { ok: false, error: check.error };
    await saveProjectOption(ctx, dimensionCode, answer);
    revalidatePath(setupPath(projectId));
    revalidatePath(`/p/${projectId}`, "layout");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function saveBuildTypeAction(raw: unknown): Promise<SetupResult> {
  const parsed = saveBuildTypeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { projectId, assemblyGroup, buildType } = parsed.data;
  try {
    const ctx = await getProjectContext(projectId);
    const wizard = await getWizardData(ctx);
    if (!wizard.buildTypes.some((b) => b.group.code === assemblyGroup)) return { ok: false, error: "unknown_dimension" };
    await saveBuildType(ctx, assemblyGroup, buildType);
    revalidatePath(setupPath(projectId));
    revalidatePath(`/p/${projectId}`, "layout");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function saveDeviationAction(raw: unknown): Promise<SetupResult & { id?: string }> {
  const parsed = deviationInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { projectId, ...input } = parsed.data;
  try {
    const ctx = await getProjectContext(projectId);
    const id = await upsertDeviation(ctx, {
      id: input.id,
      title: input.title,
      category: input.category || undefined,
      description: input.description || undefined,
      status: input.status,
    });
    revalidatePath(setupPath(projectId));
    return { ok: true, id };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteDeviationAction(raw: unknown): Promise<SetupResult> {
  const parsed = deleteDeviationInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  try {
    const ctx = await getProjectContext(parsed.data.projectId);
    await deleteDeviation(ctx, parsed.data.id);
    revalidatePath(setupPath(parsed.data.projectId));
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function completeOnboardingAction(raw: unknown): Promise<SetupResult> {
  const parsed = projectIdInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  try {
    const ctx = await getProjectContext(parsed.data.projectId);
    await markOnboardingComplete(ctx);
    revalidatePath(`/p/${parsed.data.projectId}`, "layout");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
