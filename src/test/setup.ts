// Globale Test-Vorbereitung (Vitest). Vitest setzt NODE_ENV=test selbst.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/sling_test";
process.env.APP_ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString("base64");
