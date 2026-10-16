import "dotenv/config";
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { closeDb, getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { users } from "@/modules/auth/schema";
import { listManualsWithActiveRevision, loadRevisionStructure, setRevisionPageCount } from "@/modules/manuals/service";
import { buildProjectContext } from "@/modules/projects/context-core";
import { projects } from "@/modules/projects/schema";
import { extraTasks, pageStatus } from "@/modules/progress/schema";
import { setPageStatus } from "@/modules/progress/service";

/**
 * Einmaliger Import des Prototyp-Stands (Claude-Artifact «HB-YMR Baufortschritt»).
 *
 *   pnpm import:prototype seed/hb-ymr/prototype-export-2026-10-15.json [--registration HB-YMR] [--force]
 *
 * Format (Datenbank des Artifacts bzw. dessen JSON-Export):
 *   pages:  { "<manualId>:<page>": "done" | "na" | "open" }     manualId: emp|wing|fus|uc|can|fwf|fin|heat
 *   config: { "<manualId>": <letzte Bauseite> }                 für Handbücher ohne eingelesene Struktur
 *   tasks:  [{ id, title, cat, note, done, doneAt?, order?, ts? }]
 *
 * Idempotent: Seiten mit bereits gesetztem Status werden ohne --force übersprungen; Zusatzarbeiten
 * werden über `external_ref = prototype:<id>` aktualisiert statt dupliziert.
 *
 * Der Prototyp speicherte kein Datum des Abhakens. Importierte Seiten tragen deshalb `done_at = null`
 * («Datum unbekannt», Antwort Remy 16.10.2026). Früher importierte Zeilen mit dem Exportdatum als
 * Ersatzdatum werden beim erneuten Lauf bereinigt (eigener clientChangeId, einmalig).
 */
const IMPORT_NOTE = "Importiert aus dem Prototyp (Datum des Abhakens unbekannt).";
const exportSchema = z.object({
  source: z.string().optional(),
  exportedAt: z.string().optional(),
  pages: z.record(z.string(), z.enum(["done", "na", "open"])).default({}),
  config: z.record(z.string(), z.number().int().positive()).default({}),
  tasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        cat: z.string().optional().default(""),
        note: z.string().optional().default(""),
        done: z.boolean().optional().default(false),
        doneAt: z.string().nullable().optional(),
        order: z.number().optional(),
        ts: z.number().optional(),
      }),
    )
    .default([]),
});

const MANUAL_CODES: Record<string, string> = {
  emp: "empennage",
  wing: "wing",
  fus: "fuselage",
  uc: "undercarriage",
  can: "canopy",
  fwf: "fwf",
  fin: "finishing",
  heat: "heater",
};

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Pfad zur Export-Datei fehlt");
  const force = args.includes("--force");
  const regIdx = args.indexOf("--registration");
  const registration = regIdx >= 0 ? args[regIdx + 1] : "HB-YMR";

  const data = exportSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const db = getDb();
  const e = env();
  const [user] = await db.select().from(users).where(eq(users.email, (e.SEED_ADMIN_EMAIL ?? "").toLowerCase())).limit(1);
  if (!user) throw new Error("Admin-Nutzer fehlt (zuerst pnpm seed)");
  const [project] = await db.select().from(projects).where(and(eq(projects.ownerUserId, user.id), eq(projects.registration, registration))).limit(1);
  if (!project) throw new Error(`Projekt ${registration} fehlt (zuerst pnpm seed)`);
  const ctx = await buildProjectContext(user.id, project.id, { isPlatformAdmin: user.isPlatformAdmin, userName: user.name });

  const report = { pagesImported: 0, pagesSkippedExisting: 0, pagesDateCleared: 0, pagesNotFound: [] as string[], pagesOpen: 0, tasksCreated: 0, tasksUpdated: 0, pageCountsSet: [] as string[] };

  const list = await listManualsWithActiveRevision(db, project.id);
  const byCode = new Map(list.map((l) => [l.manual.code, l]));

  // Seitenzahlen für Handbücher ohne Struktur (config)
  for (const [pid, count] of Object.entries(data.config)) {
    const code = MANUAL_CODES[pid];
    const entry = code ? byCode.get(code) : undefined;
    if (!entry?.revision) {
      report.pagesNotFound.push(`config:${pid}`);
      continue;
    }
    const structure = await loadRevisionStructure(db, entry.revision.id);
    if (structure.sections.some((s) => !s.isUntitled)) continue;
    await setRevisionPageCount(ctx, entry.revision.id, count);
    report.pageCountsSet.push(`${code}=${count}`);
  }

  const structures = new Map<string, Awaited<ReturnType<typeof loadRevisionStructure>>>();
  const existing = await db.select().from(pageStatus).where(eq(pageStatus.projectId, project.id));
  const existingByPage = new Map(existing.map((s) => [s.pageId, s]));

  for (const [key, value] of Object.entries(data.pages)) {
    const [pid, numStr] = key.split(":");
    const code = MANUAL_CODES[pid];
    const entry = code ? byCode.get(code) : undefined;
    const pageNumber = Number(numStr);
    if (!entry?.revision || !Number.isInteger(pageNumber)) {
      report.pagesNotFound.push(key);
      continue;
    }
    if (value === "open") {
      report.pagesOpen++;
      continue;
    }
    let structure = structures.get(entry.revision.id);
    if (!structure) {
      structure = await loadRevisionStructure(db, entry.revision.id);
      structures.set(entry.revision.id, structure);
    }
    const page = structure.sections.flatMap((s) => s.pages).find((p) => p.pageNumber === pageNumber);
    if (!page) {
      report.pagesNotFound.push(key);
      continue;
    }
    const existingRow = existingByPage.get(page.id);
    if (existingRow && !force) {
      // Altlast: Ersatzdatum (Exportdatum) aus früheren Importläufen auf «unbekannt» setzen.
      if (existingRow.status === "done" && existingRow.doneAt && existingRow.note === IMPORT_NOTE) {
        await setPageStatus(ctx, { pageId: page.id, status: "done", doneAt: null, clientChangeId: `prototype-import:${key}:date-unknown` });
        report.pagesDateCleared++;
      } else {
        report.pagesSkippedExisting++;
      }
      continue;
    }
    await setPageStatus(ctx, {
      pageId: page.id,
      status: value === "done" ? "done" : "not_applicable",
      naReason: value === "na" ? "manual" : null,
      note: IMPORT_NOTE,
      doneAt: null,
      clientChangeId: `prototype-import:${key}`,
    });
    report.pagesImported++;
  }

  for (const t of data.tasks) {
    const externalRef = `prototype:${t.id}`;
    const [ex] = await db.select().from(extraTasks).where(and(eq(extraTasks.projectId, project.id), eq(extraTasks.externalRef, externalRef))).limit(1);
    const values = {
      title: t.title,
      category: t.cat || null,
      note: t.note || null,
      done: t.done,
      doneAt: t.done ? (t.doneAt ?? data.exportedAt ?? null) : null,
      sortOrder: t.order ?? t.ts ?? 0,
    };
    if (ex) {
      await db.update(extraTasks).set(values).where(eq(extraTasks.id, ex.id));
      report.tasksUpdated++;
    } else {
      await db.insert(extraTasks).values({ projectId: project.id, origin: "import", externalRef, createdBy: user.id, ...values });
      report.tasksCreated++;
    }
  }

  logger.info(report, "Prototyp-Import abgeschlossen");
  if (report.pagesNotFound.length) {
    logger.warn({ keys: report.pagesNotFound }, "Nicht importiert: Seite/Handbuch in der aktiven Revision nicht vorhanden (z. B. Struktur noch nicht erfasst)");
  }
}

main()
  .catch((err) => {
    logger.error(err, "Import fehlgeschlagen");
    process.exitCode = 1;
  })
  .finally(() => closeDb());
