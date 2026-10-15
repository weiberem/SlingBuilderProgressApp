"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import type { MissingPart } from "@/modules/progress/schema";
import { createMissingPartAction, deleteMissingPartAction, updateMissingPartStatusAction, type ActionResult } from "@/modules/progress/progress-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select } from "@/components/ui/field";

const PART_STATUSES = ["needed", "ordered", "received", "installed"] as const;

/** Fehlteile einer Seite: Liste mit Status und Löschen, Formular zum Anlegen. */
export function MissingPartsPanel({ projectId, pageId, parts }: { projectId: string; pageId: string; parts: MissingPart[] }) {
  const t = useTranslations("page.parts");
  const te = useTranslations("page.errors");
  const [createState, createAction, creating] = useActionState<ActionResult | null, FormData>(createMissingPartAction, null);
  const [deleteState, deleteAction] = useActionState<ActionResult | null, FormData>(deleteMissingPartAction, null);
  const [statusState, statusAction] = useActionState<ActionResult | null, FormData>(updateMissingPartStatusAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (createState?.ok) formRef.current?.reset();
  }, [createState]);

  const error = [createState, deleteState, statusState].find((s) => s && !s.ok);

  return (
    <div className="flex flex-col gap-4">
      {error && !error.ok ? <Notice tone="error">{te(error.error)}</Notice> : null}
      {parts.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {parts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {p.position ? <span className="mr-2 font-mono text-ink-muted">{p.position}</span> : null}
                  {p.description}
                </p>
                <p className="text-sm text-ink-muted">
                  {p.partNumber ? <span className="font-mono">{p.partNumber} · </span> : null}
                  {Number(p.quantity)} {p.unit}
                </p>
              </div>
              <form action={statusAction} className="flex items-center gap-2">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="pageId" value={pageId} />
                <input type="hidden" name="id" value={p.id} />
                <label className="sr-only" htmlFor={`part-status-${p.id}`}>
                  {t("status")}
                </label>
                <Select id={`part-status-${p.id}`} name="status" defaultValue={p.status} className="w-auto min-w-36" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
                  {PART_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`statusValue.${s}`)}
                    </option>
                  ))}
                </Select>
              </form>
              <form
                action={deleteAction}
                onSubmit={(e) => {
                  if (!window.confirm(t("deleteConfirm"))) e.preventDefault();
                }}
              >
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="pageId" value={pageId} />
                <input type="hidden" name="id" value={p.id} />
                <Button type="submit" variant="danger" aria-label={`${t("delete")}: ${p.description}`}>
                  <Trash2 className="size-5" aria-hidden />
                  <span className="hidden sm:inline">{t("delete")}</span>
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={createAction} className="grid gap-3 rounded border border-line bg-bg p-3 sm:grid-cols-6">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="pageId" value={pageId} />
        <Field label={t("position")} className="sm:col-span-1">
          <Input name="position" maxLength={50} inputMode="numeric" />
        </Field>
        <Field label={t("partNumber")} className="sm:col-span-2">
          <Input name="partNumber" maxLength={100} />
        </Field>
        <Field label={t("description")} className="sm:col-span-3">
          <Input name="description" required maxLength={500} />
        </Field>
        <Field label={t("quantity")} className="sm:col-span-1">
          <Input name="quantity" type="number" min={0.01} step="any" defaultValue={1} inputMode="decimal" />
        </Field>
        <Field label={t("unit")} className="sm:col-span-1">
          <Input name="unit" defaultValue="Stk" maxLength={20} />
        </Field>
        <div className="flex items-end sm:col-span-4">
          <Button type="submit" variant="secondary" disabled={creating}>
            <Plus className="size-5" aria-hidden />
            {t("add")}
          </Button>
        </div>
      </form>
    </div>
  );
}
