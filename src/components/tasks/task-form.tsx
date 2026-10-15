"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";
import { createTaskAction, type TaskActionResult } from "@/modules/progress/task-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Textarea } from "@/components/ui/field";
import { pageHref } from "./page-href";
import type { PageRefDto } from "./types";

export function CategoryDatalist({ id, categories }: { id: string; categories: string[] }) {
  return (
    <datalist id={id}>
      {categories.map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );
}

/**
 * Formular «Neue Zusatzarbeit». Mit `pageRef` wird die Seite verknüpft; `pageMissing` zeigt an,
 * dass eine übergebene Seite nicht gefunden wurde (klären, nicht stillschweigend ignorieren).
 */
export function TaskForm({
  projectId,
  categories,
  pageRef = null,
  pageMissing = false,
  redirectTo,
  autoFocus = false,
  datalistId = "task-categories",
  renderDatalist = true,
}: {
  projectId: string;
  categories: string[];
  pageRef?: PageRefDto | null;
  pageMissing?: boolean;
  redirectTo?: string;
  autoFocus?: boolean;
  datalistId?: string;
  renderDatalist?: boolean;
}) {
  const t = useTranslations("tasks");
  const [state, action, pending] = useActionState<TaskActionResult | null, FormData>(createTaskAction, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="pageId" value={pageRef?.pageId ?? ""} />
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      {renderDatalist ? <CategoryDatalist id={datalistId} categories={categories} /> : null}

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

      <Field label={t("form.title")}>
        <Input name="title" required maxLength={200} placeholder={t("form.titlePlaceholder")} autoFocus={autoFocus} autoComplete="off" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("form.category")} hint={t("form.categoryHint")}>
          <Input name="category" list={datalistId} maxLength={100} autoComplete="off" />
        </Field>
        <Field label={t("form.dueDate")}>
          <Input name="dueDate" type="date" />
        </Field>
      </div>
      <Field label={t("form.note")}>
        <Textarea name="note" maxLength={4000} rows={3} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {t("form.submit")}
        </Button>
      </div>
    </form>
  );
}
