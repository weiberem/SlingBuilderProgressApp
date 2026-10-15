"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { EffectiveStatus } from "@/modules/manuals/applicability";
import { savePageDetailsAction, type ActionResult } from "@/modules/progress/progress-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Textarea } from "@/components/ui/field";

/** Datum (erledigt am) und Notiz einer Seite; der Status bleibt unverändert. */
export function PageDetailsForm({
  projectId,
  pageId,
  status,
  doneAt,
  note,
}: {
  projectId: string;
  pageId: string;
  status: EffectiveStatus;
  doneAt: string | null;
  note: string | null;
}) {
  const t = useTranslations("page");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(savePageDetailsAction, null);
  // Ohne gespeicherte Zeile wird der abgeleitete Status (z. B. «trifft nicht zu laut Konfiguration») beibehalten.
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="status" value={status.status} />
      <input type="hidden" name="naReason" value={status.naReason ?? ""} />
      {state?.ok ? <Notice tone="success">{t("status.noteSaved")}</Notice> : null}
      {state && !state.ok ? <Notice tone="error">{t(`errors.${state.error}`)}</Notice> : null}
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <Field label={t("status.doneAt")}>
          <Input type="date" name="doneAt" defaultValue={doneAt ?? ""} />
        </Field>
        <Field label={t("status.note")}>
          <Textarea name="note" defaultValue={note ?? ""} rows={3} maxLength={4000} />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        {t("status.save")}
      </Button>
    </form>
  );
}
