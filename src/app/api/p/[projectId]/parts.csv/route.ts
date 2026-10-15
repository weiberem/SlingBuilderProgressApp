import { getTranslations } from "next-intl/server";
import { todayIso } from "@/lib/format";
import { getProjectContext } from "@/modules/projects/context";
import { getProject } from "@/modules/projects/service";
import { MISSING_PART_STATUSES, listMissingParts, missingPartsToCsv } from "@/modules/progress/tasks-service";

/**
 * CSV-Download der Fehlteile. UTF-8 mit BOM, damit Excel Umlaute korrekt öffnet; Trennzeichen `;`.
 * Zugriff wie überall: Session und Projektmitgliedschaft über getProjectContext (404 bei fremden Projekten).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await getProjectContext(projectId);
  const [project, parts, t] = await Promise.all([getProject(ctx), listMissingParts(ctx), getTranslations("parts.status")]);
  const labels = Object.fromEntries(MISSING_PART_STATUSES.map((s) => [s, t(s)]));
  const csv = missingPartsToCsv(parts, labels);
  const safeRegistration = project.registration.replace(/[^A-Za-z0-9_-]/g, "_");
  const filename = `Fehlteile_${safeRegistration}_${todayIso()}.csv`;
  return new Response(`﻿${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
