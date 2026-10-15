"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { OptionAnswer } from "@/modules/projects/schema";
import { saveOptionAction } from "@/modules/projects/setup-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { ChoiceTile } from "./choice-tile";
import { SaveFeedback } from "./save-feedback";
import type { DimensionDto } from "./types";
import { useSetupSave } from "./use-setup-save";

function sameAnswer(a: OptionAnswer | null, b: OptionAnswer | null): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

function normalize(a: OptionAnswer | null): OptionAnswer | null {
  if (!a) return null;
  const out: OptionAnswer = {};
  if (a.unknown) out.unknown = true;
  if (a.codes?.length) out.codes = [...a.codes].sort();
  if (typeof a.bool === "boolean") out.bool = a.bool;
  if (typeof a.text === "string" && a.text.trim()) out.text = a.text.trim();
  if (typeof a.note === "string" && a.note.trim()) out.note = a.note.trim();
  return out;
}

/** Baut die zu speichernde Antwort aus Draft-Teilen (genau eine Antwortform, Bemerkung optional). */
function compose(draft: OptionAnswer): OptionAnswer {
  const out: OptionAnswer = {};
  if (draft.unknown) out.unknown = true;
  else if (draft.codes) out.codes = draft.codes;
  else if (typeof draft.bool === "boolean") out.bool = draft.bool;
  else if (typeof draft.text === "string") out.text = draft.text.trim();
  if (draft.note?.trim()) out.note = draft.note.trim();
  return out;
}

/**
 * Eine Achse des Onboardings. Einzelwahl, Ja/Nein und «weiss ich nicht» speichern mit einem Tipp
 * (nach Vorschau der Auswirkung); Mehrfachwahl, Freitext und Bemerkung über «Speichern».
 */
export function DimensionForm({ projectId, dimension }: { projectId: string; dimension: DimensionDto }) {
  const t = useTranslations("setup");
  const headingId = useId();
  const saved = dimension.answer;
  const [draft, setDraft] = useState<OptionAnswer>(saved ?? {});
  const { state, submit, confirm, cancel, busy } = useSetupSave(projectId);

  const commit = (answer: OptionAnswer) => {
    const next = compose(answer);
    if (!("codes" in next || "text" in next || "bool" in next || next.unknown)) return;
    if (sameAnswer(next, saved)) {
      setDraft(next);
      return;
    }
    setDraft(next);
    void submit({ kind: "option", dimensionCode: dimension.code, answer: next }, () => saveOptionAction({ projectId, dimensionCode: dimension.code, answer: next }), () =>
      setDraft(saved ?? {}),
    );
  };

  const codes = draft.unknown ? [] : (draft.codes ?? []);
  const isUnknown = !!draft.unknown;
  const dirty = !sameAnswer(compose(draft), saved);
  const needsSaveButton = dimension.kind === "multi" || dimension.kind === "text" || (typeof draft.note === "string" && (draft.note.trim() || "") !== (saved?.note ?? ""));

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={headingId} className="text-xl">
            {dimension.label}
          </h3>
          {dimension.required ? <Badge tone="neutral">{t("required")}</Badge> : null}
          {isUnknown ? <Badge tone="clarify">{t("unknown")}</Badge> : null}
        </div>
        {dimension.help ? <p className="text-sm text-ink-muted">{dimension.help}</p> : null}
        {dimension.kind === "multi" ? <p className="text-xs text-ink-muted">{t("multiHint")}</p> : null}
      </header>

      <div role={dimension.kind === "multi" ? "group" : "radiogroup"} aria-labelledby={headingId} aria-busy={busy || undefined} className="grid gap-2 sm:grid-cols-2">
        {dimension.kind === "single"
          ? dimension.values.map((v) => (
              <ChoiceTile
                key={v.code}
                role="radio"
                name={v.code}
                checked={codes.includes(v.code)}
                disabled={busy}
                label={v.label}
                help={v.help}
                onToggle={() => commit({ codes: [v.code], note: draft.note })}
              />
            ))
          : null}
        {dimension.kind === "multi"
          ? dimension.values.map((v) => (
              <ChoiceTile
                key={v.code}
                role="checkbox"
                name={v.code}
                checked={codes.includes(v.code)}
                disabled={busy}
                label={v.label}
                help={v.help}
                onToggle={() =>
                  setDraft((d) => {
                    const cur = d.unknown ? [] : (d.codes ?? []);
                    const next = cur.includes(v.code) ? cur.filter((c) => c !== v.code) : [...cur, v.code];
                    return { codes: next, note: d.note };
                  })
                }
              />
            ))
          : null}
        {dimension.kind === "bool" ? (
          <>
            <ChoiceTile role="radio" name="yes" checked={!isUnknown && draft.bool === true} disabled={busy} label={t("yes")} onToggle={() => commit({ bool: true, note: draft.note })} />
            <ChoiceTile role="radio" name="no" checked={!isUnknown && draft.bool === false} disabled={busy} label={t("no")} onToggle={() => commit({ bool: false, note: draft.note })} />
          </>
        ) : null}
        {dimension.kind === "text" ? (
          <div className="sm:col-span-2">
            <label className="flex flex-col gap-1">
              <span className="sr-only">{dimension.label}</span>
              <Input
                value={isUnknown ? "" : (draft.text ?? "")}
                placeholder={t("textPlaceholder")}
                disabled={busy}
                onChange={(e) => setDraft((d) => ({ text: e.target.value, note: d.note }))}
              />
            </label>
          </div>
        ) : null}
        <ChoiceTile
          role={dimension.kind === "multi" ? "checkbox" : "radio"}
          name="unknown"
          tone="unknown"
          checked={isUnknown}
          disabled={busy}
          label={t("unknown")}
          help={t("unknownHint")}
          onToggle={() => {
            if (isUnknown) {
              // Zurück auf «keine Auswahl»: erst speichern, wenn eine Antwort gewählt ist.
              setDraft(dimension.kind === "multi" ? { codes: [], note: draft.note } : dimension.kind === "text" ? { text: "", note: draft.note } : { note: draft.note });
            } else commit({ unknown: true, note: draft.note });
          }}
        />
      </div>

      {dimension.kind === "single" || dimension.kind === "multi" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{t("note")}</span>
          <Textarea
            value={draft.note ?? ""}
            rows={2}
            className="min-h-12"
            placeholder={t("notePlaceholder")}
            disabled={busy}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          />
        </label>
      ) : null}

      {needsSaveButton && dirty && state.phase !== "confirm" ? (
        <Button size="lg" className="self-start" disabled={busy} onClick={() => commit(draft)}>
          {t("save")}
        </Button>
      ) : null}

      <SaveFeedback state={state} onConfirm={() => void confirm()} onCancel={cancel} />
    </section>
  );
}
