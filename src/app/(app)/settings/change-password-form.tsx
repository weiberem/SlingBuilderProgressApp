"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changePasswordAction, type ActionResult } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/field";

export function ChangePasswordForm() {
  const t = useTranslations("auth.settings");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(changePasswordAction, null);
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      {state?.ok ? <Notice tone="success">{t("passwordChanged")}</Notice> : null}
      {state && !state.ok ? <Notice tone="error">{t(`errors.${state.error}` as "errors.invalid_credentials")}</Notice> : null}
      <Field label={t("currentPassword")}>
        <Input name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label={t("newPassword")}>
        <Input name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        {t("changePassword")}
      </Button>
    </form>
  );
}
