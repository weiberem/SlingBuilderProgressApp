import { asc, eq } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import { recordAudit } from "@/modules/audit/service";
import { users } from "@/modules/auth/schema";
import { Forbidden } from "@/modules/projects/context-core";
import {
  aircraftModels,
  aliases,
  applicabilityRules,
  manualRevisions,
  manuals,
  pages,
  sections,
  type AircraftModel,
  type Alias,
  type ApplicabilityRule,
  type Manual,
  type ManualRevision,
} from "./schema";
import { applyRevisionPageCount } from "./service";

/**
 * Stammdaten-Verwaltung für den Plattform-Admin. Kein ProjectContext: Stammdaten sind global.
 * Jede schreibende Funktion prüft `is_platform_admin` in der Datenbank und schreibt ins Audit-Log.
 */
export type AdminUser = { id: string; isPlatformAdmin: boolean };

async function assertPlatformAdmin(db: Db, userId: string): Promise<void> {
  const [u] = await db.select({ isPlatformAdmin: users.isPlatformAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u?.isPlatformAdmin) throw new Forbidden("manuals.admin");
}

export type AdminRule = ApplicabilityRule & {
  /** Lesbare Zielbeschreibung: Seitennummer oder Abschnittstitel. */
  target: { kind: "page"; pageNumber: number } | { kind: "section"; title: string; pageFrom: number; pageTo: number } | { kind: "missing" };
};

export type AdminRevision = {
  revision: ManualRevision;
  sectionCount: number;
  untitledSectionCount: number;
  pageRowCount: number;
  /** Alle Abschnitte ohne Titel oder gar keine → Seitenzahl darf manuell erfasst werden. */
  canSetPageCount: boolean;
  rules: AdminRule[];
  aliases: Alias[];
};

export type AdminManual = { manual: Manual; revisions: AdminRevision[]; aliases: Alias[] };

export type AdminModel = { model: AircraftModel; manuals: AdminManual[]; aliases: Alias[] };

/** Gesamter Stammdaten-Katalog: Modelle → Handbücher → Revisionen mit Regeln und Aliasen. */
export async function listAdminCatalog(db: Db = getDb()): Promise<AdminModel[]> {
  const [models, ms, revs, secs, pgs, rules, als] = await Promise.all([
    db.select().from(aircraftModels).orderBy(asc(aircraftModels.name)),
    db.select().from(manuals).orderBy(asc(manuals.sortOrder)),
    db.select().from(manualRevisions).orderBy(asc(manualRevisions.createdAt)),
    db.select({ id: sections.id, revisionId: sections.revisionId, titleOriginal: sections.titleOriginal, pageFrom: sections.pageFrom, pageTo: sections.pageTo, isUntitled: sections.isUntitled }).from(sections),
    db.select({ id: pages.id, revisionId: pages.revisionId, pageNumber: pages.pageNumber }).from(pages),
    db.select().from(applicabilityRules).orderBy(asc(applicabilityRules.createdAt)),
    db.select().from(aliases).orderBy(asc(aliases.sortOrder), asc(aliases.createdAt)),
  ]);
  const secById = new Map(secs.map((s) => [s.id, s]));
  const pageById = new Map(pgs.map((p) => [p.id, p]));

  const rulesByRevision = new Map<string, AdminRule[]>();
  for (const r of rules) {
    let revisionId: string | undefined;
    let target: AdminRule["target"] = { kind: "missing" };
    if (r.targetType === "page") {
      const p = pageById.get(r.targetId);
      if (p) {
        revisionId = p.revisionId;
        target = { kind: "page", pageNumber: p.pageNumber };
      }
    } else {
      const s = secById.get(r.targetId);
      if (s) {
        revisionId = s.revisionId;
        target = { kind: "section", title: s.titleOriginal, pageFrom: s.pageFrom, pageTo: s.pageTo };
      }
    }
    if (!revisionId) continue;
    rulesByRevision.set(revisionId, [...(rulesByRevision.get(revisionId) ?? []), { ...r, target }]);
  }
  const sortRules = (list: AdminRule[]) =>
    list.sort((a, b) => {
      const pa = a.target.kind === "page" ? a.target.pageNumber : a.target.kind === "section" ? a.target.pageFrom : 0;
      const pb = b.target.kind === "page" ? b.target.pageNumber : b.target.kind === "section" ? b.target.pageFrom : 0;
      return pa - pb;
    });

  return models.map((model) => ({
    model,
    aliases: als.filter((a) => a.scopeModelId === model.id && !a.scopeManualId && !a.scopeRevisionId),
    manuals: ms
      .filter((m) => m.aircraftModelId === model.id)
      .map((manual) => ({
        manual,
        aliases: als.filter((a) => a.scopeManualId === manual.id && !a.scopeRevisionId),
        revisions: revs
          .filter((r) => r.manualId === manual.id)
          .map((revision) => {
            const rs = secs.filter((s) => s.revisionId === revision.id);
            const untitled = rs.filter((s) => s.isUntitled).length;
            return {
              revision,
              sectionCount: rs.length,
              untitledSectionCount: untitled,
              pageRowCount: pgs.filter((p) => p.revisionId === revision.id).length,
              canSetPageCount: untitled === rs.length,
              rules: sortRules(rulesByRevision.get(revision.id) ?? []),
              aliases: als.filter((a) => a.scopeRevisionId === revision.id),
            };
          }),
      })),
  }));
}

/** Admin-Variante von `setRevisionPageCount`: prüft den Plattform-Admin statt eines Projektkontexts. */
export async function setRevisionPageCountAsAdmin(user: AdminUser, revisionId: string, pageCount: number): Promise<void> {
  const db = getDb();
  if (!user.isPlatformAdmin) throw new Forbidden("manuals.admin");
  await assertPlatformAdmin(db, user.id);
  await applyRevisionPageCount(user.id, revisionId, pageCount);
}

/**
 * Bestätigt eine vorgeschlagene Regel (oder zieht die Bestätigung zurück). Unbestätigte Regeln
 * wirken nicht, sie markieren die Seite nur als «Variante klären». Mit Audit-Eintrag.
 */
export async function confirmRule(userId: string, ruleId: string, confirmed: boolean): Promise<ApplicabilityRule> {
  const db = getDb();
  await assertPlatformAdmin(db, userId);
  const [old] = await db.select().from(applicabilityRules).where(eq(applicabilityRules.id, ruleId)).limit(1);
  if (!old) throw new Error("Regel nicht gefunden");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(applicabilityRules)
      .set(confirmed ? { confirmed: true, confirmedBy: userId, confirmedAt: new Date() } : { confirmed: false, confirmedBy: null, confirmedAt: null })
      .where(eq(applicabilityRules.id, ruleId))
      .returning();
    await recordAudit(tx, {
      projectId: null,
      userId,
      entityType: "applicability_rule",
      entityId: ruleId,
      action: confirmed ? "confirm" : "unconfirm",
      oldValue: { confirmed: old.confirmed, confirmedBy: old.confirmedBy },
      newValue: { confirmed: row.confirmed, confirmedBy: row.confirmedBy },
    });
    return row;
  });
}
