import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireUser } from "@/modules/auth/dal";
import { projectMembers } from "./schema";

/**
 * Mandantentrennung: Jede Service-Funktion, die Projektdaten liest oder schreibt, erhält diesen Kontext.
 * Er entsteht nur über eine geprüfte Mitgliedschaft (oder Plattform-Admin).
 */
export type Role = "owner" | "co_builder" | "advisor" | "viewer";

export type ProjectContext = {
  userId: string;
  userName: string;
  projectId: string;
  role: Role;
  isPlatformAdmin: boolean;
};

export type Action =
  | "project.read"
  | "project.configure"
  | "progress.write"
  | "tasks.write"
  | "parts.write"
  | "visa.write"
  | "manuals.admin";

const ROLE_ACTIONS: Record<Role, Action[]> = {
  owner: ["project.read", "project.configure", "progress.write", "tasks.write", "parts.write", "visa.write"],
  co_builder: ["project.read", "progress.write", "tasks.write", "parts.write"],
  advisor: ["project.read", "visa.write"],
  viewer: ["project.read"],
};

export function can(ctx: ProjectContext, action: Action): boolean {
  if (action === "manuals.admin") return ctx.isPlatformAdmin;
  return ROLE_ACTIONS[ctx.role].includes(action);
}

export class Forbidden extends Error {
  constructor(action: Action) {
    super(`Keine Berechtigung: ${action}`);
  }
}

export function assertCan(ctx: ProjectContext, action: Action): void {
  if (!can(ctx, action)) throw new Forbidden(action);
}

/** Lädt den Kontext für ein Projekt; unbekannte oder fremde Projekte → 404. */
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

/** Für Skripte und Tests: Kontext ohne Request (Mitgliedschaft wird trotzdem geprüft). */
export async function buildProjectContext(userId: string, projectId: string, opts: { isPlatformAdmin?: boolean; userName?: string } = {}): Promise<ProjectContext> {
  const [m] = await getDb()
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  if (!m) throw new Error("Keine Mitgliedschaft im Projekt");
  return { userId, userName: opts.userName ?? "", projectId, role: m.role, isPlatformAdmin: opts.isPlatformAdmin ?? false };
}
