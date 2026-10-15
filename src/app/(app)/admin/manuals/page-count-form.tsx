"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setPageCountAction, type AdminResult } from "@/modules/manuals/admin-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/field";

/** «Anzahl Bauseiten erfassen» für Revisionen ohne erfasste Abschnitte. */
export function PageCountForm({ revisionId, current }: { revisionId: string; current: number | null }) {
  const t = useTranslations("admin.manuals");
  const [state, action, pending] = useActionState<AdminResult | null, FormData>(setPageCountAction, null);
  return (
    <form action={action} className="flex flex-col gap-2 rounded border border-dashed border-line-strong bg-surface-2 p-3">
      <p className="text-sm font-semibold">{t("pageCountForm.title")}</p>
      <p className="text-xs text-ink-muted">{t("pageCountForm.hint")}</p>
      {state?.ok ? <Notice tone="success">{t("pageCountForm.saved")}</Notice> : null}
      {state && !state.ok ? <Notice tone="error">{t(`errors.${state.error}`)}</Notice> : null}
      <input type="hidden" name="revisionId" value={revisionId} />
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("pageCountForm.label")} className="w-full sm:w-64">
          <Input name="pageCount" type="number" inputMode="numeric" min={1} max={400} required defaultValue={current ?? ""} />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending}>
          {t("pageCountForm.submit")}
        </Button>
      </div>
    </form>
  );
}
