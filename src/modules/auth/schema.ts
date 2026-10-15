import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "../../db/columns";

export const authTokenKind = pgEnum("auth_token_kind", ["verify_email", "reset_password"]);

/** Nutzerkonten. Phase 1: ein Nutzer (Builder und Plattform-Admin). */
export const users = pgTable("users", {
  id: id(),
  /** Normalisiert (Kleinschreibung, getrimmt). */
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  locale: text("locale").notNull().default("de"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  /** Vorbereitet für TOTP (2FA), verschlüsselt. Phase 1 ungenutzt. */
  totpSecretEnc: text("totp_secret_enc"),
  ...timestamps,
});

/** Serverseitige Sessions. `id` ist der SHA-256-Hash des Cookie-Tokens. */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  userAgent: text("user_agent"),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Einmal-Tokens für E-Mail-Verifizierung und Passwort-Reset (nur Hash gespeichert). */
export const authTokens = pgTable("auth_tokens", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: authTokenKind("kind").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Login-Bremse ohne Redis: Zähler pro Schlüssel (ip:…, email:…) und Zeitfenster. */
export const authRateLimits = pgTable("auth_rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
