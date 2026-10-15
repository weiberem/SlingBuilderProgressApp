import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "./schema";
import { SESSION_COOKIE, validateSessionToken, type SessionWithUser } from "./session";

/**
 * Datenzugriffsschicht für die Session: pro Request einmal geprüft (React cache).
 * Nur hier wird das Cookie gelesen; Server Actions und Seiten rufen `requireUser()`.
 */
export const getCurrentSession = cache(async (): Promise<SessionWithUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

export async function getCurrentUser(): Promise<User | null> {
  const s = await getCurrentSession();
  return s?.user ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePlatformAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/");
  return user;
}
