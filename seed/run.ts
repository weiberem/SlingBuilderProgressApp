import "dotenv/config";
import { closeDb, getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { hbYmr } from "./hb-ymr/project";
import { seedAircraftModel } from "./seed-model";
import { seedProject, seedUser } from "./seed-project";
import { sling4Tsi } from "./sling-4-tsi";

/**
 * `pnpm seed`: Stammdaten (Sling 4 TSi), erster Nutzer (aus SEED_ADMIN_*) und Projekt HB-YMR.
 * Idempotent; kann beliebig oft laufen.
 */
async function main() {
  const db = getDb();
  const e = env();
  await seedAircraftModel(db, sling4Tsi);

  if (!e.SEED_ADMIN_EMAIL || !e.SEED_ADMIN_PASSWORD) {
    logger.warn("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD fehlen: kein Nutzer und kein Projekt angelegt.");
    return;
  }
  const { userId, created } = await seedUser(db, {
    email: e.SEED_ADMIN_EMAIL,
    name: e.SEED_ADMIN_NAME ?? "Admin",
    password: e.SEED_ADMIN_PASSWORD,
  });
  if (created && e.SEED_ADMIN_PASSWORD === "change-me-now") {
    logger.warn("Der Nutzer wurde mit dem Beispielpasswort angelegt. Bitte nach dem ersten Login ändern.");
  }
  const { projectId } = await seedProject(db, userId, hbYmr);
  logger.info({ projectId }, "Seed abgeschlossen");
}

main()
  .catch((err) => {
    logger.error(err, "Seed fehlgeschlagen");
    process.exitCode = 1;
  })
  .finally(() => closeDb());
