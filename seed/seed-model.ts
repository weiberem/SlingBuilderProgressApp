import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  aircraftModels,
  aliases,
  applicabilityRules,
  assemblyGroups,
  manualRevisions,
  manuals,
  optionDimensions,
  optionGroups,
  optionValues,
  pages,
  sections,
} from "@/modules/manuals/schema";
import type { SeedAircraftModel, SeedRule, SeedSection } from "./types";

/**
 * Idempotenter Seed der Handbuch-Stammdaten eines Modells.
 * Stabile Schlüssel: Modell-Code, Handbuch-Code, Revision, (Revision, Seitennummer), seedKey.
 * Bestehende Seiten werden nie gelöscht (Status hängt daran); überzählige werden nur gemeldet.
 * `confirmed` von Regeln wird nur beim ersten Anlegen aus den Seeds übernommen (Admin kann es ändern).
 */
export async function seedAircraftModel(db: Db, seed: SeedAircraftModel): Promise<{ modelId: string }> {
  const log = logger.child({ seed: seed.code });

  const [model] = await db
    .insert(aircraftModels)
    .values({ code: seed.code, name: seed.name, manufacturer: seed.manufacturer })
    .onConflictDoUpdate({ target: aircraftModels.code, set: { name: seed.name, manufacturer: seed.manufacturer } })
    .returning();
  const modelId = model.id;

  for (const g of seed.assemblyGroups) {
    await db
      .insert(assemblyGroups)
      .values({ aircraftModelId: modelId, code: g.code, label: g.label, sortOrder: g.sortOrder })
      .onConflictDoUpdate({
        target: [assemblyGroups.aircraftModelId, assemblyGroups.code],
        set: { label: g.label, sortOrder: g.sortOrder },
      });
  }

  for (const g of seed.optionGroups) {
    await db
      .insert(optionGroups)
      .values({ aircraftModelId: modelId, code: g.code, label: g.label, help: g.help, sortOrder: g.sortOrder })
      .onConflictDoUpdate({
        target: [optionGroups.aircraftModelId, optionGroups.code],
        set: { label: g.label, help: g.help ?? null, sortOrder: g.sortOrder },
      });
  }

  for (const d of seed.optionDimensions) {
    const [dim] = await db
      .insert(optionDimensions)
      .values({
        aircraftModelId: modelId,
        code: d.code,
        kind: d.kind,
        label: d.label,
        help: d.help,
        groupCode: d.groupCode,
        sortOrder: d.sortOrder,
        required: d.required ?? false,
      })
      .onConflictDoUpdate({
        target: [optionDimensions.aircraftModelId, optionDimensions.code],
        set: {
          kind: d.kind,
          label: d.label,
          help: d.help ?? null,
          groupCode: d.groupCode,
          sortOrder: d.sortOrder,
          required: d.required ?? false,
        },
      })
      .returning();
    for (const v of d.values ?? []) {
      await db
        .insert(optionValues)
        .values({ dimensionId: dim.id, code: v.code, label: v.label, help: v.help, aliasValue: v.aliasValue, sortOrder: v.sortOrder ?? 0 })
        .onConflictDoUpdate({
          target: [optionValues.dimensionId, optionValues.code],
          set: { label: v.label, help: v.help ?? null, aliasValue: v.aliasValue ?? null, sortOrder: v.sortOrder ?? 0 },
        });
    }
  }

  const manualIdByCode = new Map<string, string>();
  const revisionIdByKey = new Map<string, string>();

  for (const m of seed.manuals) {
    const [manual] = await db
      .insert(manuals)
      .values({
        aircraftModelId: modelId,
        code: m.code,
        docNumber: m.docNumber,
        title: m.title,
        assemblyGroup: m.assemblyGroup,
        kind: m.kind ?? "kai",
        sortOrder: m.sortOrder,
        notes: m.notes,
      })
      .onConflictDoUpdate({
        target: [manuals.aircraftModelId, manuals.code],
        set: {
          docNumber: m.docNumber,
          title: m.title,
          assemblyGroup: m.assemblyGroup,
          kind: m.kind ?? "kai",
          sortOrder: m.sortOrder,
          notes: m.notes ?? null,
        },
      })
      .returning();
    manualIdByCode.set(m.code, manual.id);

    for (const r of m.revisions) {
      const report = { notes: r.importReport?.notes ?? [], conflicts: r.importReport?.conflicts ?? [] };
      const [rev] = await db
        .insert(manualRevisions)
        .values({
          manualId: manual.id,
          revision: r.revision,
          revisionDate: r.revisionDate,
          coverLabel: r.coverLabel,
          status: r.status,
          sourceName: r.sourceName,
          sourceSize: r.sourceSize,
          pageCount: r.pageCount,
          importReport: report,
          notes: r.notes,
          releasedAt: r.status === "released" ? new Date() : null,
        })
        .onConflictDoUpdate({
          target: [manualRevisions.manualId, manualRevisions.revision],
          set: {
            revisionDate: r.revisionDate ?? null,
            coverLabel: r.coverLabel ?? null,
            status: r.status,
            sourceName: r.sourceName ?? null,
            sourceSize: r.sourceSize ?? null,
            pageCount: r.pageCount ?? null,
            importReport: report,
            notes: r.notes ?? null,
          },
        })
        .returning();
      revisionIdByKey.set(`${m.code}@${r.revision}`, rev.id);

      if (r.sections) {
        await seedSections(db, rev.id, r.sections, `${m.code}-${r.revision}`);
      }
    }
  }

  for (const a of seed.aliases) {
    const scopeManualId = a.scopeManualCode ? manualIdByCode.get(a.scopeManualCode) : undefined;
    if (a.scopeManualCode && !scopeManualId) throw new Error(`Alias ${a.key}: Handbuch ${a.scopeManualCode} unbekannt`);
    const scopeRevisionId = a.scopeRevision && a.scopeManualCode ? revisionIdByKey.get(`${a.scopeManualCode}@${a.scopeRevision}`) : undefined;
    if (a.scopeRevision && !scopeRevisionId) throw new Error(`Alias ${a.key}: Revision ${a.scopeRevision} unbekannt`);
    await db
      .insert(aliases)
      .values({
        seedKey: a.key,
        scopeModelId: modelId,
        scopeManualId: scopeManualId ?? null,
        scopeRevisionId: scopeRevisionId ?? null,
        kind: a.kind,
        matchText: a.matchText,
        isRegex: a.isRegex ?? false,
        replacement: a.replacement,
        rationale: a.rationale,
        sortOrder: a.sortOrder ?? 0,
      })
      .onConflictDoUpdate({
        target: aliases.seedKey,
        set: {
          scopeModelId: modelId,
          scopeManualId: scopeManualId ?? null,
          scopeRevisionId: scopeRevisionId ?? null,
          kind: a.kind,
          matchText: a.matchText,
          isRegex: a.isRegex ?? false,
          replacement: a.replacement,
          rationale: a.rationale,
          sortOrder: a.sortOrder ?? 0,
        },
      });
  }

  log.info({ manuals: seed.manuals.length, dimensions: seed.optionDimensions.length, aliases: seed.aliases.length }, "Modell-Stammdaten gesät");
  return { modelId };
}

async function seedSections(db: Db, revisionId: string, seedSecs: SeedSection[], label: string) {
  const existingSections = await db.select().from(sections).where(eq(sections.revisionId, revisionId));
  const existingPages = await db.select().from(pages).where(eq(pages.revisionId, revisionId));
  const pageByNumber = new Map(existingPages.map((p) => [p.pageNumber, p]));
  const seenSectionIds = new Set<string>();
  const seenPageNumbers = new Set<number>();

  for (let i = 0; i < seedSecs.length; i++) {
    const s = seedSecs[i];
    const values = {
      revisionId,
      sortOrder: i + 1,
      titleOriginal: s.title,
      titleNote: s.titleNote ?? null,
      pageFrom: s.from,
      pageTo: s.to,
      drawingNumber: s.drawingNumber ?? null,
      isUntitled: s.untitled ?? false,
      flags: s.flags ?? {},
      notes: s.notes ?? null,
    };
    const existing = existingSections.find((e) => e.sortOrder === i + 1);
    let sectionId: string;
    if (existing) {
      await db.update(sections).set(values).where(eq(sections.id, existing.id));
      sectionId = existing.id;
    } else {
      const [ins] = await db.insert(sections).values(values).returning();
      sectionId = ins.id;
    }
    seenSectionIds.add(sectionId);

    for (let n = s.from; n <= s.to; n++) {
      const o = s.pages?.[n];
      const all = s.allPages;
      const pageValues = {
        revisionId,
        sectionId,
        pageNumber: n,
        titleOriginal: o?.title ?? null,
        drawingNumber: o?.drawingNumber ?? s.drawingNumber ?? null,
        quickBuild: o?.quickBuild ?? all?.quickBuild ?? ("none" as const),
        quickBuildSource: o?.quickBuildSource ?? all?.quickBuildSource ?? null,
        flags: { ...(all?.flags ?? {}), ...(o?.flags ?? {}) },
        notes: o?.notes ?? all?.notes ?? null,
      };
      const ex = pageByNumber.get(n);
      let pageId: string;
      if (ex) {
        await db.update(pages).set(pageValues).where(eq(pages.id, ex.id));
        pageId = ex.id;
      } else {
        const [ins] = await db.insert(pages).values(pageValues).returning();
        pageId = ins.id;
      }
      seenPageNumbers.add(n);
      await seedRules(db, "page", pageId, o?.rules ?? []);
    }
    await seedRules(db, "section", sectionId, s.rules ?? []);
  }

  const orphanSections = existingSections.filter((e) => !seenSectionIds.has(e.id));
  const orphanPages = existingPages.filter((p) => !seenPageNumbers.has(p.pageNumber));
  if (orphanSections.length || orphanPages.length) {
    logger.warn(
      { revision: label, orphanSections: orphanSections.map((s) => s.sortOrder), orphanPages: orphanPages.map((p) => p.pageNumber) },
      "Seed: Abschnitte/Seiten in der Datenbank, die nicht mehr im Seed stehen (nicht gelöscht)",
    );
  }
}

async function seedRules(db: Db, targetType: "page" | "section", targetId: string, rules: SeedRule[]) {
  for (const r of rules) {
    const existing = await db.select().from(applicabilityRules).where(eq(applicabilityRules.seedKey, r.key)).limit(1);
    const values = {
      targetType,
      targetId,
      effect: r.effect ?? ("applies_only_if" as const),
      expression: r.expression,
      sourceText: r.sourceText,
      rationale: r.rationale ?? null,
    };
    if (existing[0]) {
      await db.update(applicabilityRules).set(values).where(eq(applicabilityRules.id, existing[0].id));
    } else {
      await db.insert(applicabilityRules).values({
        ...values,
        seedKey: r.key,
        confirmed: r.confirmed,
        confirmedAt: r.confirmed ? new Date() : null,
      });
    }
  }
}

export async function findRevisionId(db: Db, modelId: string, manualCode: string, revision: string): Promise<string | null> {
  const rows = await db
    .select({ id: manualRevisions.id })
    .from(manualRevisions)
    .innerJoin(manuals, eq(manuals.id, manualRevisions.manualId))
    .where(and(eq(manuals.aircraftModelId, modelId), eq(manuals.code, manualCode), eq(manualRevisions.revision, revision)))
    .limit(1);
  return rows[0]?.id ?? null;
}
