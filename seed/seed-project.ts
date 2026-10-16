import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { users } from "@/modules/auth/schema";
import { hashPassword } from "@/modules/auth/password";
import { aircraftModels, manualRevisions, manuals, optionDimensions } from "@/modules/manuals/schema";
import {
  projectBuildTypes,
  projectDeviations,
  projectManualRevisions,
  projectMembers,
  projectOptions,
  projects,
} from "@/modules/projects/schema";
import type { SeedProject } from "./types";

export type SeedUser = { email: string; name: string; password: string };

/** Legt den ersten Nutzer an, falls er fehlt. Bestehende Passwörter werden nie überschrieben. */
export async function seedUser(db: Db, u: SeedUser): Promise<{ userId: string; created: boolean }> {
  const email = u.email.trim().toLowerCase();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    await db.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, existing[0].id));
    return { userId: existing[0].id, created: false };
  }
  const [created] = await db
    .insert(users)
    .values({
      email,
      name: u.name,
      passwordHash: await hashPassword(u.password),
      emailVerifiedAt: new Date(),
      isPlatformAdmin: true,
      locale: "de",
    })
    .returning();
  logger.info({ email }, "Nutzer angelegt");
  return { userId: created.id, created: true };
}

/**
 * Idempotenter Seed eines Projekts: Antworten, Build-Arten und Abweichungen werden nur angelegt,
 * wenn sie fehlen (spätere Änderungen des Builders bleiben erhalten).
 */
export async function seedProject(db: Db, ownerUserId: string, seed: SeedProject): Promise<{ projectId: string }> {
  const [model] = await db.select().from(aircraftModels).where(eq(aircraftModels.code, seed.modelCode)).limit(1);
  if (!model) throw new Error(`Modell ${seed.modelCode} fehlt (zuerst Stammdaten säen)`);

  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.registration, seed.registration)))
    .limit(1);
  let projectId: string;
  if (existing[0]) {
    projectId = existing[0].id;
  } else {
    const [p] = await db
      .insert(projects)
      .values({
        ownerUserId,
        aircraftModelId: model.id,
        registration: seed.registration,
        kitNumber: seed.kitNumber,
        name: seed.name,
      })
      .returning();
    projectId = p.id;
    logger.info({ registration: seed.registration }, "Projekt angelegt");
  }

  await db
    .insert(projectMembers)
    .values({ projectId, userId: ownerUserId, role: "owner", acceptedAt: new Date() })
    .onConflictDoNothing();

  const dims = await db.select().from(optionDimensions).where(eq(optionDimensions.aircraftModelId, model.id));
  const dimByCode = new Map(dims.map((d) => [d.code, d]));
  for (const [code, answer] of Object.entries(seed.options)) {
    const dim = dimByCode.get(code);
    if (!dim) throw new Error(`Projekt-Seed: Achse ${code} unbekannt`);
    // Antworten des Erbauers werden nie überschrieben. Einzige Ausnahme: eine noch offene Antwort
    // («weiss ich nicht») wird durch eine inzwischen bekannte Seed-Antwort ersetzt (nachgereichte Klärung).
    await db
      .insert(projectOptions)
      .values({ projectId, dimensionId: dim.id, value: answer, updatedBy: ownerUserId })
      .onConflictDoUpdate({
        target: [projectOptions.projectId, projectOptions.dimensionId],
        set: { value: answer, updatedBy: ownerUserId },
        setWhere: answer.unknown ? sql`false` : sql`(${projectOptions.value}->>'unknown')::boolean is true`,
      });
  }

  for (const [group, bt] of Object.entries(seed.buildTypes)) {
    await db.insert(projectBuildTypes).values({ projectId, assemblyGroup: group, buildType: bt }).onConflictDoNothing();
  }

  const existingDeviations = await db.select().from(projectDeviations).where(eq(projectDeviations.projectId, projectId));
  let order = existingDeviations.length;
  for (const d of seed.deviations) {
    if (existingDeviations.some((e) => e.title === d.title)) continue;
    await db.insert(projectDeviations).values({
      projectId,
      title: d.title,
      description: d.description,
      category: d.category,
      status: d.status ?? "planned",
      sortOrder: ++order,
    });
  }

  // Aktive Revision je Handbuch: neueste freigegebene, falls noch keine gewählt.
  const manualRows = await db.select().from(manuals).where(eq(manuals.aircraftModelId, model.id));
  for (const m of manualRows) {
    const released = await db
      .select()
      .from(manualRevisions)
      .where(and(eq(manualRevisions.manualId, m.id), eq(manualRevisions.status, "released")))
      .orderBy(desc(manualRevisions.releasedAt), desc(manualRevisions.createdAt))
      .limit(1);
    if (!released[0]) continue;
    await db
      .insert(projectManualRevisions)
      .values({ projectId, manualId: m.id, revisionId: released[0].id })
      .onConflictDoNothing();
  }

  return { projectId };
}
