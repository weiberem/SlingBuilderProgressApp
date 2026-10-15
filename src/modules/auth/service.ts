import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { sendSystemMail } from "@/lib/mailer";
import { hashPassword, verifyPassword } from "./password";
import { checkRateLimit, LOGIN_LIMIT_PER_EMAIL, LOGIN_LIMIT_PER_IP, RESET_LIMIT_PER_EMAIL } from "./rate-limit";
import { authTokens, users, type User } from "./schema";
import { createSession, invalidateUserSessions } from "./session";

export type AuthError = "invalid_credentials" | "rate_limited" | "email_taken" | "invalid_token" | "weak_password" | "registration_disabled";

export class AuthFailure extends Error {
  constructor(public readonly code: AuthError) {
    super(code);
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Dummy-Hash, damit ein unbekannter Nutzer gleich lange braucht wie ein falsches Passwort. */
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  dummyHash ??= await hashPassword(randomToken(16));
  return dummyHash;
}

export async function login(input: { email: string; password: string; ip?: string | null; userAgent?: string | null }) {
  const email = normalizeEmail(input.email);
  const [byEmail, byIp] = await Promise.all([
    checkRateLimit(`login:email:${email}`, LOGIN_LIMIT_PER_EMAIL.limit, LOGIN_LIMIT_PER_EMAIL.windowSeconds),
    checkRateLimit(`login:ip:${input.ip ?? "unknown"}`, LOGIN_LIMIT_PER_IP.limit, LOGIN_LIMIT_PER_IP.windowSeconds),
  ]);
  if (!byEmail.allowed || !byIp.allowed) throw new AuthFailure("rate_limited");

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const ok = user ? await verifyPassword(user.passwordHash, input.password) : await verifyPassword(await getDummyHash(), input.password);
  if (!user || !ok) throw new AuthFailure("invalid_credentials");

  const session = await createSession(user.id, { ip: input.ip, userAgent: input.userAgent });
  logger.info({ userId: user.id }, "Login");
  return { user, ...session };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) throw new AuthFailure("invalid_credentials");
  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, userId));
}

/** Passwort-Reset anfordern. Antwortet immer gleich, ob die Adresse existiert oder nicht. */
export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const rl = await checkRateLimit(`reset:${email}`, RESET_LIMIT_PER_EMAIL.limit, RESET_LIMIT_PER_EMAIL.windowSeconds);
  if (!rl.allowed) return;
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return;
  const token = randomToken(32);
  await db.insert(authTokens).values({
    userId: user.id,
    kind: "reset_password",
    tokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const url = `${env().APP_URL}/reset-password/${token}`;
  await sendSystemMail({
    to: user.email,
    subject: "Sling Builder Tracker: Passwort zurücksetzen",
    text: `Hallo ${user.name}\n\nMit diesem Link setzt du dein Passwort zurück (gültig 1 Stunde):\n${url}\n\nFalls du das nicht angefordert hast, ignoriere diese Mail.`,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, sha256Hex(token)), eq(authTokens.kind, "reset_password"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .limit(1);
  if (!row) throw new AuthFailure("invalid_token");
  await db.transaction(async (tx) => {
    await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
    await tx.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, row.userId));
  });
  await invalidateUserSessions(row.userId);
}

/**
 * Registrierung: implementiert, aber in Phase 1 nicht verlinkt (Feature-Flag REGISTRATION_ENABLED).
 */
export async function registerUser(input: { email: string; name: string; password: string }): Promise<User> {
  if (process.env.REGISTRATION_ENABLED !== "true") throw new AuthFailure("registration_disabled");
  const email = normalizeEmail(input.email);
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new AuthFailure("email_taken");
  const [user] = await db
    .insert(users)
    .values({ email, name: input.name.trim(), passwordHash: await hashPassword(input.password) })
    .returning();
  await sendVerificationMail(user);
  return user;
}

export async function sendVerificationMail(user: User): Promise<void> {
  const token = randomToken(32);
  await getDb().insert(authTokens).values({
    userId: user.id,
    kind: "verify_email",
    tokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await sendSystemMail({
    to: user.email,
    subject: "Sling Builder Tracker: E-Mail bestätigen",
    text: `Hallo ${user.name}\n\nBitte bestätige deine E-Mail-Adresse:\n${env().APP_URL}/verify-email/${token}`,
  });
}

export async function verifyEmail(token: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, sha256Hex(token)), eq(authTokens.kind, "verify_email"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .limit(1);
  if (!row) throw new AuthFailure("invalid_token");
  await db.transaction(async (tx) => {
    await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
    await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId));
  });
}
