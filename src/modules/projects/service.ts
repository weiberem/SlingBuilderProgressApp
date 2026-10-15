import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import type { ProjectConfig } from "@/modules/manuals/applicability";
import { recordAudit } from "@/modules/audit/service";
import {
  aircraftModels,
  assemblyGroups,
  optionDimensions,
  optionGroups,
  optionValues,
  type OptionDimension,
  type OptionValue,
} from "@/modules/manuals/schema";
import { assertCan, type ProjectContext } from "./context";
import {
  projectBuildTypes,
  projectDeviations,
  projectMembers,
  projectOptions,
  projects,
  type OptionAnswer,
  type Project,
} from "./schema";

export async function listProjectsForUser(userId: string): Promise<(Project & { role: string; modelName: string })[]> {
  const rows = await getDb()
    .select({ project: projects, role: projectMembers.role, modelName: aircraftModels.name })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .innerJoin(aircraftModels, eq(aircraftModels.id, projects.aircraftModelId))
    .where(eq(projectMembers.userId, userId))
    .orderBy(asc(projects.createdAt));
  return rows.map((r) => ({ ...r.project, role: r.role, modelName: r.modelName }));
}

export async function getProject(ctx: ProjectContext): Promise<Project & { modelName: string; modelCode: string }> {
  const [row] = await getDb()
    .select({ project: projects, modelName: aircraftModels.name, modelCode: aircraftModels.code })
    .from(projects)
    .innerJoin(aircraftModels, eq(aircraftModels.id, projects.aircraftModelId))
    .where(eq(projects.id, ctx.projectId))
    .limit(1);
  if (!row) throw new Error("Projekt nicht gefunden");
  return { ...row.project, modelName: row.modelName, modelCode: row.modelCode };
}

/** Konfiguration für die Applicability-Engine plus Variablen für Alias-Platzhalter. */
export async function getProjectConfig(ctx: ProjectContext, db: Db = getDb()): Promise<{ config: ProjectConfig; aliasVars: Record<string, string> }> {
  const [project] = await db.select({ aircraftModelId: projects.aircraftModelId }).from(projects).where(eq(projects.id, ctx.projectId)).limit(1);
  if (!project) throw new Error("Projekt nicht gefunden");
  const dims = await db.select().from(optionDimensions).where(eq(optionDimensions.aircraftModelId, project.aircraftModelId));
  const dimById = new Map(dims.map((d) => [d.id, d]));
  const answers = await db.select().from(projectOptions).where(eq(projectOptions.projectId, ctx.projectId));
  const options: Record<string, OptionAnswer | undefined> = {};
  for (const a of answers) {
    const d = dimById.get(a.dimensionId);
    if (d) options[d.code] = a.value;
  }
  const bts = await db.select().from(projectBuildTypes).where(eq(projectBuildTypes.projectId, ctx.projectId));
  const buildTypes: ProjectConfig["buildTypes"] = {};
  for (const b of bts) buildTypes[b.assemblyGroup] = b.buildType;

  const aliasVars: Record<string, string> = {};
  const singleCodes = answers
    .map((a) => ({ dim: dimById.get(a.dimensionId), code: a.value.codes?.[0] }))
    .filter((x): x is { dim: OptionDimension; code: string } => !!x.dim && !!x.code && x.dim.kind === "single");
  if (singleCodes.length) {
    const vals = await db
      .select()
      .from(optionValues)
      .where(inArray(optionValues.dimensionId, singleCodes.map((s) => s.dim.id)));
    for (const s of singleCodes) {
      const v = vals.find((v) => v.dimensionId === s.dim.id && v.code === s.code);
      if (v?.aliasValue) aliasVars[`project.${s.dim.code}`] = v.aliasValue;
    }
  }
  return { config: { options, buildTypes }, aliasVars };
}

export type WizardGroup = {
  code: string;
  label: { de: string; en?: string; fr?: string };
  help: { de: string; en?: string; fr?: string } | null;
  dimensions: (OptionDimension & { values: OptionValue[]; answer: OptionAnswer | null })[];
};

/** Daten für den Onboarding-Wizard: Gruppen, Achsen, Werte und aktuelle Antworten. */
export async function getWizardData(ctx: ProjectContext) {
  const db = getDb();
  const project = await getProject(ctx);
  const [groups, dims, values, answers, bts, agroups] = await Promise.all([
    db.select().from(optionGroups).where(eq(optionGroups.aircraftModelId, project.aircraftModelId)).orderBy(asc(optionGroups.sortOrder)),
    db.select().from(optionDimensions).where(eq(optionDimensions.aircraftModelId, project.aircraftModelId)).orderBy(asc(optionDimensions.sortOrder)),
    db.select().from(optionValues).orderBy(asc(optionValues.sortOrder)),
    db.select().from(projectOptions).where(eq(projectOptions.projectId, ctx.projectId)),
    db.select().from(projectBuildTypes).where(eq(projectBuildTypes.projectId, ctx.projectId)),
    db.select().from(assemblyGroups).where(eq(assemblyGroups.aircraftModelId, project.aircraftModelId)).orderBy(asc(assemblyGroups.sortOrder)),
  ]);
  const answerByDim = new Map(answers.map((a) => [a.dimensionId, a.value]));
  const wizardGroups: WizardGroup[] = groups.map((g) => ({
    code: g.code,
    label: g.label,
    help: g.help ?? null,
    dimensions: dims
      .filter((d) => d.groupCode === g.code)
      .map((d) => ({ ...d, values: values.filter((v) => v.dimensionId === d.id), answer: answerByDim.get(d.id) ?? null })),
  }));
  const buildTypes = agroups.map((g) => ({
    group: g,
    buildType: bts.find((b) => b.assemblyGroup === g.code)?.buildType ?? ("unknown" as const),
  }));
  const deviations = await db.select().from(projectDeviations).where(eq(projectDeviations.projectId, ctx.projectId)).orderBy(asc(projectDeviations.sortOrder));
  return { project, groups: wizardGroups, buildTypes, deviations };
}

export async function saveProjectOption(ctx: ProjectContext, dimensionCode: string, answer: OptionAnswer): Promise<void> {
  assertCan(ctx, "project.configure");
  const db = getDb();
  const project = await getProject(ctx);
  const [dim] = await db
    .select()
    .from(optionDimensions)
    .where(and(eq(optionDimensions.aircraftModelId, project.aircraftModelId), eq(optionDimensions.code, dimensionCode)))
    .limit(1);
  if (!dim) throw new Error(`Achse ${dimensionCode} unbekannt`);
  if (answer.codes?.length) {
    const vals = await db.select({ code: optionValues.code }).from(optionValues).where(eq(optionValues.dimensionId, dim.id));
    const known = new Set(vals.map((v) => v.code));
    for (const c of answer.codes) if (!known.has(c)) throw new Error(`Wert ${c} unbekannt für ${dimensionCode}`);
    if (dim.kind === "single" && answer.codes.length > 1) throw new Error("Nur ein Wert erlaubt");
  }
  const [old] = await db
    .select()
    .from(projectOptions)
    .where(and(eq(projectOptions.projectId, ctx.projectId), eq(projectOptions.dimensionId, dim.id)))
    .limit(1);
  await db.transaction(async (tx) => {
    await tx
      .insert(projectOptions)
      .values({ projectId: ctx.projectId, dimensionId: dim.id, value: answer, updatedBy: ctx.userId })
      .onConflictDoUpdate({ target: [projectOptions.projectId, projectOptions.dimensionId], set: { value: answer, updatedBy: ctx.userId } });
    await recordAudit(tx, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      entityType: "project_option",
      entityId: dim.id,
      action: "set",
      oldValue: old?.value ?? null,
      newValue: answer,
    });
  });
}

export async function saveBuildType(ctx: ProjectContext, assemblyGroup: string, buildType: "standard" | "quick_build" | "unknown"): Promise<void> {
  assertCan(ctx, "project.configure");
  const db = getDb();
  const [old] = await db
    .select()
    .from(projectBuildTypes)
    .where(and(eq(projectBuildTypes.projectId, ctx.projectId), eq(projectBuildTypes.assemblyGroup, assemblyGroup)))
    .limit(1);
  await db.transaction(async (tx) => {
    await tx
      .insert(projectBuildTypes)
      .values({ projectId: ctx.projectId, assemblyGroup, buildType })
      .onConflictDoUpdate({ target: [projectBuildTypes.projectId, projectBuildTypes.assemblyGroup], set: { buildType } });
    await recordAudit(tx, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      entityType: "project_build_type",
      entityId: assemblyGroup,
      action: "set",
      oldValue: old?.buildType ?? null,
      newValue: buildType,
    });
  });
}

export async function upsertDeviation(
  ctx: ProjectContext,
  input: { id?: string; title: string; description?: string; category?: string; status?: "planned" | "in_progress" | "done" | "dropped" },
): Promise<string> {
  assertCan(ctx, "project.configure");
  const db = getDb();
  if (input.id) {
    await db
      .update(projectDeviations)
      .set({ title: input.title, description: input.description ?? null, category: input.category ?? null, status: input.status ?? "planned" })
      .where(and(eq(projectDeviations.id, input.id), eq(projectDeviations.projectId, ctx.projectId)));
    return input.id;
  }
  const [row] = await db
    .insert(projectDeviations)
    .values({ projectId: ctx.projectId, title: input.title, description: input.description, category: input.category, status: input.status ?? "planned" })
    .returning();
  return row.id;
}

export async function deleteDeviation(ctx: ProjectContext, id: string): Promise<void> {
  assertCan(ctx, "project.configure");
  await getDb().delete(projectDeviations).where(and(eq(projectDeviations.id, id), eq(projectDeviations.projectId, ctx.projectId)));
}

export async function markOnboardingComplete(ctx: ProjectContext): Promise<void> {
  assertCan(ctx, "project.configure");
  const db = getDb();
  const p = await getProject(ctx);
  await db
    .update(projects)
    .set({ settings: { ...p.settings, onboardingCompletedAt: new Date().toISOString() } })
    .where(eq(projects.id, ctx.projectId));
}
