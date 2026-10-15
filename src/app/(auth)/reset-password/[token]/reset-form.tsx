"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetPasswordAction, type ActionResult } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/field";

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("auth.reset");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(resetPasswordAction, null);
  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="success">{t("done")}</Notice>
        <Link href="/login" className="text-center text-sm underline underline-offset-2">
          Anmelden
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <h2 className="text-2xl">{t("title")}</h2>
      {state && !state.ok ? <Notice tone="error">{t(`errors.${state.error}` as "errors.invalid_token")}</Notice> : null}
      <input type="hidden" name="token" value={token} />
      <Field label={t("password")}>
        <Input name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
