import { z } from "zod";

/**
 * Zentrale, validierte Umgebungskonfiguration. Wird nur serverseitig geladen.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@localhost:5432/sling_dev"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_ENCRYPTION_KEY: z.string().optional(),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_ADMIN_NAME: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("Sling Builder Tracker <noreply@localhost>"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Vercel-Integrationen (Supabase, Neon, Vercel Postgres) setzen `POSTGRES_URL` statt `DATABASE_URL`.
 * Diese Namen werden als Ersatz akzeptiert; `DATABASE_URL` hat Vorrang.
 */
function withFallbacks(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...source };
  if (!out.DATABASE_URL) out.DATABASE_URL = source.POSTGRES_URL ?? source.POSTGRES_PRISMA_URL ?? source.POSTGRES_URL_NON_POOLING;
  if (!out.APP_URL && source.VERCEL_PROJECT_PRODUCTION_URL) out.APP_URL = `https://${source.VERCEL_PROJECT_PRODUCTION_URL}`;
  return out;
}

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(withFallbacks(process.env));
    if (!parsed.success) {
      throw new Error(`Ungültige Umgebungsvariablen: ${parsed.error.message}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}
