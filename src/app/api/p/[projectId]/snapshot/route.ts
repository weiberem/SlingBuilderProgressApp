import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/dal";
import { getProjectContext } from "@/modules/projects/context";
import { getManualView } from "@/modules/progress/service";
import { toManualViewDto } from "@/modules/progress/view-dto";

/** Offline-Snapshot eines Handbuchs (`?manual=<code>`) zum Auffrischen des Zwischenspeichers im Browser. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const manualCode = request.nextUrl.searchParams.get("manual")?.trim();
  if (!manualCode || !/^[a-z0-9_-]{1,64}$/i.test(manualCode)) return Response.json({ error: "invalid_input" }, { status: 400 });
  const ctx = await getProjectContext(projectId);
  const view = await getManualView(ctx, manualCode);
  if (!view) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(toManualViewDto(view), { headers: { "Cache-Control": "no-store" } });
}
