import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { pages as pagesTbl } from "@/modules/manuals/schema";
import { assertCan, type ProjectContext } from "@/modules/projects/context";
import { listStatusesForPages, setPageStatus, setSectionStatus } from "./service";
import type { PageStatusRowDto } from "./view-dto";

/**
 * Offline-Sync: Ein Stapel Client-Änderungen (mit `clientChangeId`) wird über die Services angewandt.
 * Idempotent: bereits verarbeitete IDs ändern nichts mehr (Audit-Log). Die Antwort enthält je Änderung
 * ein Ergebnis und den aktuellen Serverstand aller betroffenen Seiten.
 */
const statusKind = z.enum(["open", "in_progress", "done", "not_applicable", "problem"]);
const naReason = z.enum(["manual", "config", "quick_build"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT");
const clientChangeId = z.string().min(8).max(64);

export const pageStatusPayloadSchema = z.object({
  pageId: z.string().uuid(),
  status: statusKind,
  naReason: naReason.nullable().optional(),
  doneAt: isoDate.nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
});

export const sectionStatusPayloadSchema = z.object({
  sectionId: z.string().uuid(),
  status: z.enum(["done", "open"]),
});

export const syncChangeSchema = z.discriminatedUnion("kind", [
  z.object({ clientChangeId, kind: z.literal("page_status"), payload: pageStatusPayloadSchema }),
  z.object({ clientChangeId, kind: z.literal("section_status"), payload: sectionStatusPayloadSchema }),
]);

export const syncRequestSchema = z.object({ changes: z.array(syncChangeSchema).min(1).max(200) });

export type SyncChange = z.infer<typeof syncChangeSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export type SyncChangeResult = { clientChangeId: string; ok: true; affected: number } | { clientChangeId: string; ok: false; error: string };

export type SyncResponse = {
  results: SyncChangeResult[];
  /** Alle Seiten, die der Stapel berührt hat (auch ohne gespeicherte Zeile → im Client `stored = null`). */
  pageIds: string[];
  /** Aktueller Serverstand der berührten Seiten mit gespeicherter Zeile. */
  statuses: PageStatusRowDto[];
};

/** Wendet die Änderungen der Reihe nach an; Fehler einzelner Änderungen stoppen den Stapel nicht. */
export async function applySyncBatch(ctx: ProjectContext, changes: SyncChange[]): Promise<SyncResponse> {
  assertCan(ctx, "progress.write");
  const db = getDb();
  const results: SyncChangeResult[] = [];
  const touched = new Set<string>();
  const seen = new Set<string>();
  for (const change of changes) {
    if (seen.has(change.clientChangeId)) {
      results.push({ clientChangeId: change.clientChangeId, ok: false, error: "duplicate_in_batch" });
      continue;
    }
    seen.add(change.clientChangeId);
    try {
      if (change.kind === "page_status") {
        const p = change.payload;
        await setPageStatus(ctx, {
          pageId: p.pageId,
          status: p.status,
          naReason: p.naReason ?? null,
          doneAt: p.doneAt ?? null,
          note: p.note,
          clientChangeId: change.clientChangeId,
        });
        touched.add(p.pageId);
        results.push({ clientChangeId: change.clientChangeId, ok: true, affected: 1 });
      } else {
        const n = await setSectionStatus(ctx, { sectionId: change.payload.sectionId, status: change.payload.status, clientChangeId: change.clientChangeId });
        const ids = await db.select({ id: pagesTbl.id }).from(pagesTbl).where(eq(pagesTbl.sectionId, change.payload.sectionId));
        for (const r of ids) touched.add(r.id);
        results.push({ clientChangeId: change.clientChangeId, ok: true, affected: n });
      }
    } catch (e) {
      results.push({ clientChangeId: change.clientChangeId, ok: false, error: e instanceof Error ? e.message : "unknown_error" });
    }
  }
  const pageIds = [...touched];
  const rows = await listStatusesForPages(db, ctx.projectId, pageIds);
  return {
    results,
    pageIds,
    statuses: rows.map((r) => ({ pageId: r.pageId, status: r.status, naReason: r.naReason, doneAt: r.doneAt, note: r.note })),
  };
}
