import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Wendet die SQL-Migrationen aus drizzle/ an (Drizzle-Migrator, dieselbe Tabelle wie drizzle-kit).
 * Läuft beim Start des web-Containers (docker/web-entrypoint.sh) und lokal mit
 * `pnpm exec tsx scripts/migrate.ts`. Ohne drizzle-kit, damit das Produktions-Image klein bleibt.
 *
 * Wartet bei Verbindungsfehlern (DB startet noch) bis zu MIGRATE_WAIT_SECONDS (Standard 60).
 */
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt");
  process.exit(2);
}
const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");
const waitSeconds = Number(process.env.MIGRATE_WAIT_SECONDS ?? 60);

async function run() {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const started = Date.now();
    for (;;) {
      try {
        await pool.query("select 1");
        break;
      } catch (err) {
        if (Date.now() - started > waitSeconds * 1000) throw err;
        console.log("Datenbank noch nicht erreichbar, warte …");
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    await migrate(drizzle(pool), { migrationsFolder });
    console.log(`Migrationen angewendet (${migrationsFolder})`);
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Migration fehlgeschlagen:", err);
  process.exit(1);
});
