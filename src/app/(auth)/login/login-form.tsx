"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction, type ActionResult } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/field";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth.login");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(loginAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <h2 className="text-2xl">{t("title")}</h2>
      {state && !state.ok ? <Notice tone="error">{t(`errors.${state.error}` as "errors.invalid_credentials")}</Notice> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label={t("email")}>
        <Input name="email" type="email" autoComplete="username" inputMode="email" required autoFocus />
      </Field>
      <Field label={t("password")}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {t("submit")}
      </Button>
      <Link href="/forgot-password" className="text-center text-sm text-ink-muted underline underline-offset-2">
        {t("forgot")}
      </Link>
    </form>
  );
}
