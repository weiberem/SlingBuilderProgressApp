"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestPasswordResetAction, type ActionResult } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/field";

export function ForgotForm() {
  const t = useTranslations("auth.forgot");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(requestPasswordResetAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <h2 className="text-2xl">{t("title")}</h2>
      <p className="text-sm text-ink-muted">{t("text")}</p>
      {state?.ok ? <Notice tone="success">{t("sent")}</Notice> : null}
      <Field label="E-Mail">
        <Input name="email" type="email" autoComplete="username" required />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {t("submit")}
      </Button>
      <Link href="/login" className="text-center text-sm text-ink-muted underline underline-offset-2">
        {t("backToLogin")}
      </Link>
    </form>
  );
}
