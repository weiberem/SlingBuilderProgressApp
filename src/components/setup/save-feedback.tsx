"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/field";
import type { DiffByManual } from "@/modules/projects/setup-actions";
import type { SaveState } from "./use-setup-save";

/** Vorschau-Diff je Handbuch: dazu / weg / zu klären. */
export function ConfigDiffView({ changes }: { changes: DiffByManual[] }) {
  const t = useTranslations("setup.preview");
  return (
    <ul className="flex flex-col gap-3">
      {changes.map((c) => (
        <li key={c.manual} className="flex flex-col gap-1.5">
          <p className="font-semibold">{c.manual}</p>
          <DiffRow tone="done" label={t("added", { count: c.added.length })} pages={c.added} />
          <DiffRow tone="na" label={t("removed", { count: c.removed.length })} pages={c.removed} />
          <DiffRow tone="clarify" label={t("toClarify", { count: c.toClarify.length })} pages={c.toClarify} />
        </li>
      ))}
    </ul>
  );
}

function DiffRow({ tone, label, pages }: { tone: "done" | "na" | "clarify"; label: string; pages: { pageNumber: number; title: string }[] }) {
  const t = useTranslations("setup.preview");
  if (!pages.length) return null;
  return (
    <div className="flex flex-col gap-1">
      <Badge tone={tone} className="self-start">
        {label}
      </Badge>
      <ul className="flex flex-wrap gap-1 text-xs text-ink-muted">
        {pages.map((p) => (
          <li key={p.pageNumber} className="rounded bg-surface-2 px-1.5 py-0.5" title={p.title}>
            {t("page", { number: p.pageNumber })}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rückmeldung unter einem Formularblock: Vorschau mit «Übernehmen», Erfolg oder Fehler. */
export function SaveFeedback({ state, onConfirm, onCancel }: { state: SaveState; onConfirm: () => void; onCancel: () => void }) {
  const t = useTranslations("setup");
  if (state.phase === "confirm") {
    return (
      <div role="dialog" aria-labelledby="preview-title" aria-modal="false" className="flex flex-col gap-3 rounded border-2 border-brand-red bg-surface p-3">
        <h4 id="preview-title" className="text-lg">
          {t("preview.title")}
        </h4>
        <p className="text-sm text-ink-muted">{t("preview.intro")}</p>
        <ConfigDiffView changes={state.changes} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={onConfirm} size="lg">
            {t("preview.apply")}
          </Button>
          <Button variant="secondary" size="lg" onClick={onCancel}>
            {t("preview.cancel")}
          </Button>
        </div>
      </div>
    );
  }
  if (state.phase === "saved") return <Notice tone="success">{t("saved")}</Notice>;
  if (state.phase === "error") return <Notice tone="error">{t(`errors.${state.error}`)}</Notice>;
  if (state.phase === "saving" || state.phase === "previewing") {
    return (
      <p className="text-sm text-ink-muted" role="status">
        {t("saving")}
      </p>
    );
  }
  return null;
}
