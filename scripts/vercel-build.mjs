import { spawnSync } from "node:child_process";

/**
 * Build-Schritt für Vercel (`vercel-build` in package.json, wird von Vercel statt `build` ausgeführt):
 * 1. Migrationen anwenden, wenn eine Datenbank konfiguriert ist (DIRECT_DATABASE_URL bevorzugt, sonst DATABASE_URL).
 * 2. Stammdaten und ersten Nutzer säen (idempotent), wenn SEED_ADMIN_EMAIL/-PASSWORD gesetzt sind.
 * 3. Service Worker bündeln und `next build`.
 * Ohne Datenbank-URL werden Schritt 1 und 2 übersprungen, der Build läuft trotzdem (Vorschau-Deployments).
 */
const directUrl = process.env.DIRECT_DATABASE_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

function run(cmd, args, extraEnv = {}) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (directUrl) {
  run("pnpm", ["exec", "tsx", "scripts/migrate.ts"], { DATABASE_URL: directUrl, MIGRATE_WAIT_SECONDS: "20" });
  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    run("pnpm", ["exec", "tsx", "seed/run.ts"], { DATABASE_URL: directUrl });
  } else {
    console.log("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD nicht gesetzt: Seed übersprungen.");
  }
} else {
  console.log("Keine DATABASE_URL: Migrationen und Seed übersprungen.");
}
run("pnpm", ["build"]);
