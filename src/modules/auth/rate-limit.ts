import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { authRateLimits } from "./schema";

/**
 * Login-Bremse in Postgres (kein Redis): Zähler pro Schlüssel und festem Zeitfenster.
 * Gibt `allowed=false` zurück, sobald `limit` im Fenster überschritten ist.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; count: number }> {
  const db = getDb();
  const rows = await db
    .insert(authRateLimits)
    .values({ key, windowStart: new Date(), count: 1 })
    .onConflictDoUpdate({
      target: authRateLimits.key,
      set: {
        count: sql`case when ${authRateLimits.windowStart} < now() - make_interval(secs => ${windowSeconds}) then 1 else ${authRateLimits.count} + 1 end`,
        windowStart: sql`case when ${authRateLimits.windowStart} < now() - make_interval(secs => ${windowSeconds}) then now() else ${authRateLimits.windowStart} end`,
      },
    })
    .returning({ count: authRateLimits.count });
  const count = rows[0]?.count ?? 1;
  return { allowed: count <= limit, count };
}

export const LOGIN_LIMIT_PER_EMAIL = { limit: 10, windowSeconds: 15 * 60 };
export const LOGIN_LIMIT_PER_IP = { limit: 50, windowSeconds: 15 * 60 };
export const RESET_LIMIT_PER_EMAIL = { limit: 3, windowSeconds: 60 * 60 };
