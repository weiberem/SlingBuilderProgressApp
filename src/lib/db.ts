import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { env } from "./env";

export type Db = NodePgDatabase<typeof schema>;

declare global {
  // Verhindert mehrere Pools bei Hot Reload in der Entwicklung.
  var __slingPool: Pool | undefined;
  var __slingDb: Db | undefined;
}

function createPool(): Pool {
  return new Pool({
    connectionString: env().DATABASE_URL,
    max: 10,
  });
}

export function getDb(): Db {
  if (!globalThis.__slingDb) {
    globalThis.__slingPool = globalThis.__slingPool ?? createPool();
    globalThis.__slingDb = drizzle(globalThis.__slingPool, { schema });
  }
  return globalThis.__slingDb;
}

/** Für Tests: eine andere Datenbank (z. B. PGlite) einsetzen. */
export function setDb(db: Db | undefined): void {
  globalThis.__slingDb = db;
}

export async function closeDb(): Promise<void> {
  await globalThis.__slingPool?.end();
  globalThis.__slingPool = undefined;
  globalThis.__slingDb = undefined;
}

export { schema };
