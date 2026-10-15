"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteDeviationAction, saveDeviationAction, type SetupError } from "@/modules/projects/setup-actions";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select, Textarea } from "@/components/ui/field";
import type { DeviationDto } from "./types";

const STATUSES = ["planned", "in_progress", "done", "dropped"] as const;
const statusTone: Record<DeviationDto["status"], Tone> = { planned: "neutral", in_progress: "progress", done: "done", dropped: "na" };

type Draft = { id?: string; title: string; category: string; description: string; status: DeviationDto["status"] };

const emptyDraft = (): Draft => ({ title: "", category: "", description: "", status: "planned" });

/** Liste der eigenen Abweichungen mit Anlegen, Bearbeiten und Löschen (Löschen mit Rückfrage, kein Doppeltipp). */
export function DeviationsEditor({ projectId, deviations }: { projectId: string; deviations: DeviationDto[] }) {
  const t = useTranslations("setup");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const errorText = (e: SetupError) => t(`errors.${e}`);

  const save = (draft: Draft) => {
    startTransition(async () => {
      const res = await saveDeviationAction({
        projectId,
        id: draft.id,
        title: draft.title,
        category: draft.category || undefined,
        description: draft.description || undefined,
        status: draft.status,
      });
      if (res.ok) {
        setEditing(null);
        setNotice({ tone: "success", text: t("saved") });
      } else setNotice({ tone: "error", text: errorText(res.error) });
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deleteDeviationAction({ projectId, id });
      setConfirmDelete(null);
      setNotice(res.ok ? { tone: "success", text: t("deviations.deleted") } : { tone: "error", text: errorText(res.error) });
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {deviations.length === 0 && !editing ? <p className="text-sm text-ink-muted">{t("deviations.empty")}</p> : null}
      <ul className="flex flex-col gap-3">
        {deviations.map((d) =>
          editing?.id === d.id ? (
            <li key={d.id}>
              <DeviationForm draft={editing} onChange={setEditing} onSave={() => save(editing)} onCancel={() => setEditing(null)} pending={pending} />
            </li>
          ) : (
            <li key={d.id} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg">{d.title}</h3>
                <Badge tone={statusTone[d.status]}>{t(`deviations.statuses.${d.status}`)}</Badge>
                {d.category ? <Badge tone="neutral">{d.category}</Badge> : null}
              </div>
              {d.description ? <p className="text-sm text-ink-muted">{d.description}</p> : null}
              {confirmDelete === d.id ? (
                <div role="alertdialog" aria-label={t("deviations.confirmDelete")} className="flex flex-wrap items-center gap-2 rounded border border-status-problem bg-status-problem-soft p-2">
                  <span className="text-sm font-semibold">{t("deviations.confirmDelete")}</span>
                  <Button variant="danger" disabled={pending} onClick={() => remove(d.id)}>
                    {t("deviations.confirmDeleteYes")}
                  </Button>
                  <Button variant="secondary" disabled={pending} onClick={() => setConfirmDelete(null)}>
                    {t("deviations.cancel")}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      setNotice(null);
                      setEditing({ id: d.id, title: d.title, category: d.category ?? "", description: d.description ?? "", status: d.status });
                    }}
                  >
                    <Pencil className="size-4" aria-hidden />
                    {t("deviations.edit")}
                  </Button>
                  <Button variant="danger" disabled={pending} onClick={() => setConfirmDelete(d.id)}>
                    <Trash2 className="size-4" aria-hidden />
                    {t("deviations.delete")}
                  </Button>
                </div>
              )}
            </li>
          ),
        )}
      </ul>
      {editing && !editing.id ? (
        <DeviationForm draft={editing} onChange={setEditing} onSave={() => save(editing)} onCancel={() => setEditing(null)} pending={pending} />
      ) : (
        <Button
          size="lg"
          variant="secondary"
          className="self-start"
          disabled={pending}
          onClick={() => {
            setNotice(null);
            setEditing(emptyDraft());
          }}
        >
          <Plus className="size-5" aria-hidden />
          {t("deviations.add")}
        </Button>
      )}
    </div>
  );
}

function DeviationForm({
  draft,
  onChange,
  onSave,
  onCancel,
  pending,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const t = useTranslations("setup.deviations");
  const tSetup = useTranslations("setup");
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border-2 border-brand-red bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <h3 className="text-lg">{draft.id ? t("edit") : t("new")}</h3>
      <Field label={t("title")}>
        <Input name="title" value={draft.title} required maxLength={200} autoFocus onChange={(e) => onChange({ ...draft, title: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("category")}>
          <Input name="category" value={draft.category} maxLength={100} placeholder={t("categoryPlaceholder")} onChange={(e) => onChange({ ...draft, category: e.target.value })} />
        </Field>
        <Field label={t("status")}>
          <Select name="status" value={draft.status} onChange={(e) => onChange({ ...draft, status: e.target.value as Draft["status"] })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("description")}>
        <Textarea name="description" value={draft.description} maxLength={2000} onChange={(e) => onChange({ ...draft, description: e.target.value })} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending || !draft.title.trim()}>
          {tSetup("save")}
        </Button>
        <Button variant="secondary" size="lg" disabled={pending} onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
