import "dotenv/config";
import { PgBoss } from "pg-boss";
import { closeDb } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { deleteExpiredSessions } from "@/modules/auth/session";
import { registerJobs } from "./jobs";

/**
 * Worker-Prozess (`pnpm worker`, im Container `node dist/worker.cjs`): pg-boss auf derselben
 * PostgreSQL-Datenbank wie die App (Schema `pgboss`), kein Redis. Hier laufen alle Jobs, die
 * nicht in einen Request gehören. M1 enthält nur die Wartung; echte Jobs folgen in M2+.
 */
const log = logger.child({ process: "worker" });

async function main() {
  const boss = new PgBoss({
    connectionString: env().DATABASE_URL,
    schema: "pgboss",
    application_name: "sling-worker",
    max: 5,
  });
  boss.on("error", (err) => log.error(err, "pg-boss Fehler"));
  boss.on("stopped", () => log.info("pg-boss gestoppt"));

  await boss.start({ attempts: 5 });
  log.info("pg-boss gestartet");

  await registerJobs(boss, { deleteExpiredSessions, log });
  log.info("Jobs registriert");

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info({ signal }, "Worker fährt herunter");
    const forced = setTimeout(() => {
      log.warn("Timeout beim Herunterfahren, beende hart");
      process.exit(1);
    }, 35_000);
    forced.unref();
    try {
      await boss.stop({ graceful: true, timeout: 30_000, close: true });
      await closeDb();
      log.info("Worker beendet");
      process.exit(0);
    } catch (err) {
      log.error(err, "Fehler beim Herunterfahren");
      process.exit(1);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  log.error(err, "Worker konnte nicht starten");
  process.exit(1);
});
