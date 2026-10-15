"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentSession } from "./dal";
import { PASSWORD_MIN_LENGTH } from "./password";
import { AuthFailure, changePassword, login, requestPasswordReset, resetPassword } from "./service";
import { SESSION_COOKIE, invalidateSession, sessionCookieOptions } from "./session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const h = await headers();
  try {
    const { token, expiresAt } = await login({
      email: parsed.data.email,
      password: parsed.data.password,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  } catch (e) {
    if (e instanceof AuthFailure) return { ok: false, error: e.code };
    throw e;
  }
  redirect(safeNext(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  const s = await getCurrentSession();
  if (s) await invalidateSession(s.session.id);
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

const resetRequestSchema = z.object({ email: z.string().email() });

export async function requestPasswordResetAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  await requestPasswordReset(parsed.data.email);
  return { ok: true };
}

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(PASSWORD_MIN_LENGTH),
});

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "weak_password" };
  try {
    await resetPassword(parsed.data.token, parsed.data.password);
  } catch (e) {
    if (e instanceof AuthFailure) return { ok: false, error: e.code };
    throw e;
  }
  return { ok: true };
}

const changeSchema = z.object({
  current: z.string().min(1),
  password: z.string().min(PASSWORD_MIN_LENGTH),
});

export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const s = await getCurrentSession();
  if (!s) return { ok: false, error: "unauthenticated" };
  const parsed = changeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "weak_password" };
  try {
    await changePassword(s.user.id, parsed.data.current, parsed.data.password);
  } catch (e) {
    if (e instanceof AuthFailure) return { ok: false, error: e.code };
    throw e;
  }
  return { ok: true };
}
