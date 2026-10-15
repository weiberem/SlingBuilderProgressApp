import { eq, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { sessions, users, type Session, type User } from "./schema";

/**
 * Serverseitige Sessions nach dem Lucia-Muster: Das Cookie enthält ein zufälliges Token,
 * die Datenbank nur dessen SHA-256-Hash als Session-ID. 30 Tage gleitend.
 */
export const SESSION_COOKIE = "sbt_session";
const SESSION_DAYS = 30;
const REFRESH_AFTER_DAYS = 15;

export type SessionWithUser = { session: Session; user: User };

export async function createSession(userId: string, meta: { userAgent?: string | null; ip?: string | null } = {}) {
  const token = randomToken(32);
  const id = sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await getDb().insert(sessions).values({ id, userId, expiresAt, userAgent: meta.userAgent ?? null, ip: meta.ip ?? null });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string): Promise<SessionWithUser | null> {
  if (!token) return null;
  const id = sha256Hex(token);
  const db = getDb();
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const now = Date.now();
  if (row.session.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (row.session.expiresAt.getTime() - now < (SESSION_DAYS - REFRESH_AFTER_DAYS) * 86_400_000) {
    const expiresAt = new Date(now + SESSION_DAYS * 86_400_000);
    await db.update(sessions).set({ expiresAt, lastSeenAt: new Date() }).where(eq(sessions.id, id));
    row.session.expiresAt = expiresAt;
  }
  return row;
}

export async function invalidateSession(id: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.id, id));
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

export async function deleteExpiredSessions(): Promise<void> {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}
