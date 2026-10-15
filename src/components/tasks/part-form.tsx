"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";
import { createMissingPartAction, type PartActionResult } from "@/modules/progress/parts-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Textarea } from "@/components/ui/field";
import { pageHref } from "./page-href";
import type { PageRefDto } from "./types";

/** Formular «Neues Fehlteil», optional mit verknüpfter Seite (Query-Parameter `pageId`). */
export function PartForm({ projectId, pageRef = null, pageMissing = false }: { projectId: string; pageRef?: PageRefDto | null; pageMissing?: boolean }) {
  const t = useTranslations("parts");
  const [state, action, pending] = useActionState<PartActionResult | null, FormData>(createMissingPartAction, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="pageId" value={pageRef?.pageId ?? ""} />
      {state?.ok ? <Notice tone="success">{t("form.created")}</Notice> : null}
      {state && !state.ok ? <Notice tone="error">{t(`errors.${state.error}`)}</Notice> : null}
      {pageMissing ? <Notice tone="warn">{t("form.pageUnknown")}</Notice> : null}
      {pageRef ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{t("form.pageLink")}:</span>
          <Link href={pageHref(projectId, pageRef.manualCode, pageRef.pageId)} className="inline-flex min-h-12 items-center gap-1">
            <BookOpen className="size-4" aria-hidden />
            {t("item.page", { manual: pageRef.manualTitle, page: pageRef.pageNumber })}
          </Link>
        </p>
      ) : null}
      <Field label={t("form.description")}>
        <Input name="description" required maxLength={500} placeholder={t("form.descriptionPlaceholder")} autoComplete="off" />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={t("form.position")}>
          <Input name="position" maxLength={50} placeholder={t("form.positionPlaceholder")} autoComplete="off" />
        </Field>
        <Field label={t("form.partNumber")}>
          <Input name="partNumber" maxLength={100} autoComplete="off" className="font-mono" />
        </Field>
        <Field label={t("form.quantity")}>
          <Input name="quantity" inputMode="decimal" pattern="\d{1,8}([.,]\d{1,2})?" defaultValue="1" required autoComplete="off" />
        </Field>
        <Field label={t("form.unit")}>
          <Input name="unit" defaultValue="Stk" maxLength={20} required autoComplete="off" />
        </Field>
      </div>
      <Field label={t("form.note")}>
        <Textarea name="note" maxLength={2000} rows={2} className="min-h-12" />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {t("form.submit")}
        </Button>
      </div>
    </form>
  );
}
