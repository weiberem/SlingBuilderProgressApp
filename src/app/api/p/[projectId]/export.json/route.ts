import { todayIso } from "@/lib/format";
import { getProjectContext } from "@/modules/projects/context";
import { buildProjectExport, markExported } from "@/modules/projects/export-service";

/**
 * JSON-Export des Projekts als Download (Datensicherung durch den Erbauer). Zugriff wie überall über
 * getProjectContext (404 bei fremden Projekten). Der Zeitpunkt wird für die Erinnerung gespeichert.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await getProjectContext(projectId);
  const data = await buildProjectExport(ctx);
  await markExported(ctx, new Date(data.exportedAt));
  const safeRegistration = data.project.registration.replace(/[^A-Za-z0-9_-]/g, "_");
  const filename = `${safeRegistration}_Export_${todayIso()}.json`;
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
