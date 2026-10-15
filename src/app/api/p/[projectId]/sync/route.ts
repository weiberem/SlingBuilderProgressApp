import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/dal";
import { Forbidden, getProjectContext } from "@/modules/projects/context";
import { applySyncBatch, syncRequestSchema } from "@/modules/progress/sync";

/**
 * Offline-Sync: nimmt einen Stapel Client-Änderungen entgegen und wendet sie idempotent an.
 * Session und Mitgliedschaft werden über `getProjectContext` geprüft (404 bei fremden Projekten).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }
  const ctx = await getProjectContext(projectId);
  const body = await request.json().catch(() => null);
  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  try {
    const result = await applySyncBatch(ctx, parsed.data.changes);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof Forbidden) return Response.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }
}
