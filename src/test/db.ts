import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "@/lib/db";
import { seedAircraftModel } from "../../seed/seed-model";
import { seedProject, seedUser } from "../../seed/seed-project";
import { sling4Tsi } from "../../seed/sling-4-tsi";
import { hbYmr } from "../../seed/hb-ymr/project";

/**
 * Test-Datenbank: Schema leeren, Migrationen anwenden, Stammdaten und HB-YMR säen.
 * Erwartet eine laufende PostgreSQL-Instanz (TEST_DATABASE_URL, Standard sling_test).
 */
export async function resetTestDb(): Promise<{ userId: string; projectId: string }> {
  const db = getDb();
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: "drizzle" });
  await seedAircraftModel(db, sling4Tsi);
  const { userId } = await seedUser(db, { email: "test@example.org", name: "Test", password: "test-password-123" });
  const { projectId } = await seedProject(db, userId, hbYmr);
  return { userId, projectId };
}

export { closeDb, getDb };
