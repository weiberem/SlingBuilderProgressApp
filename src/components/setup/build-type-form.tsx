"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { saveBuildTypeAction } from "@/modules/projects/setup-actions";
import { Badge } from "@/components/ui/badge";
import { ChoiceTile } from "./choice-tile";
import { SaveFeedback } from "./save-feedback";
import type { BuildTypeDto } from "./types";
import { useSetupSave } from "./use-setup-save";

const CHOICES = ["standard", "quick_build", "unknown"] as const;

/** Build-Art einer Baugruppe: ein Tipp wählt und speichert (nach Vorschau der Auswirkung). */
export function BuildTypeForm({ projectId, item }: { projectId: string; item: BuildTypeDto }) {
  const t = useTranslations("setup");
  const headingId = useId();
  const [draft, setDraft] = useState(item.buildType);
  const { state, submit, confirm, cancel, busy } = useSetupSave(projectId);

  const choose = (buildType: BuildTypeDto["buildType"]) => {
    if (buildType === item.buildType) {
      setDraft(buildType);
      return;
    }
    setDraft(buildType);
    void submit({ kind: "buildType", assemblyGroup: item.group, buildType }, () => saveBuildTypeAction({ projectId, assemblyGroup: item.group, buildType }), () =>
      setDraft(item.buildType),
    );
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="text-xl">
          {item.label}
        </h3>
        {draft === "unknown" ? <Badge tone="clarify">{t("unknown")}</Badge> : null}
      </header>
      <div role="radiogroup" aria-labelledby={headingId} aria-busy={busy || undefined} className="grid gap-2 sm:grid-cols-3">
        {CHOICES.map((c) => (
          <ChoiceTile
            key={c}
            role="radio"
            name={c}
            tone={c === "unknown" ? "unknown" : "default"}
            checked={draft === c}
            disabled={busy}
            label={t(`build.${c}`)}
            onToggle={() => choose(c)}
          />
        ))}
      </div>
      <SaveFeedback state={state} onConfirm={() => void confirm()} onCancel={cancel} />
    </section>
  );
}
