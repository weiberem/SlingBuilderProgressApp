import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireUser } from "@/modules/auth/dal";
import { projectMembers } from "./schema";
import type { ProjectContext } from "./context-core";

export { assertCan, buildProjectContext, can, Forbidden, type Action, type ProjectContext, type Role } from "./context-core";

/** Lädt den Kontext für ein Projekt aus der Session; unbekannte oder fremde Projekte → 404. */
export const getProjectContext = cache(async (projectId: string): Promise<ProjectContext> => {
  const user = await requireUser();
  const [m] = await getDb()
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
    .limit(1);
  if (!m) notFound();
  return { userId: user.id, userName: user.name, projectId, role: m.role, isPlatformAdmin: user.isPlatformAdmin };
});
