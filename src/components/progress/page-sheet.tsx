"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, X } from "lucide-react";
import { cx } from "@/lib/format";
import type { StatusKind } from "@/modules/manuals/applicability";
import type { PageDto } from "@/modules/progress/view-dto";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Notice, Textarea } from "@/components/ui/field";
import { STATUS_ORDER, statusButtonTone } from "./status-styles";

/**
 * Bottom-Sheet für eine Seite: alle fünf Status (grosse Buttons), Datum, Notiz, Link zum Seitendetail.
 * Schliessen über Button, Escape oder Tippen auf den Hintergrund; Fokus wird hinein- und zurückgesetzt.
 */
export function PageSheet({
  page,
  sectionTitle,
  projectId,
  onClose,
  onSetStatus,
  onSaveDetails,
}: {
  page: PageDto;
  sectionTitle: string;
  projectId: string;
  onClose: () => void;
  onSetStatus: (page: PageDto, status: StatusKind) => void;
  onSaveDetails: (page: PageDto, details: { doneAt: string | null; note: string | null }) => void;
}) {
  const t = useTranslations("manual.sheet");
  const ts = useTranslations("common.status");
  const ta = useTranslations("common.actions");
  const titleId = useId();
  const firstRef = useRef<HTMLButtonElement>(null);
  const [doneAt, setDoneAt] = useState(page.stored?.doneAt ?? "");
  const [note, setNote] = useState(page.stored?.note ?? "");
  const [saved, setSaved] = useState(false);

  // Formularwerte werden beim Öffnen übernommen; der Aufrufer setzt `key={page.id}` für einen Seitenwechsel.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [onClose]);

  const s = page.status;
  const derivedNa = s.derived && s.status === "not_applicable";
  const dirty = (page.stored?.doneAt ?? "") !== doneAt || (page.stored?.note ?? "") !== note;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label={ta("close")} onClick={onClose} tabIndex={-1} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-lg border border-line bg-bg shadow-lg md:rounded-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-bg px-4 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <p className="eyebrow truncate">{sectionTitle}</p>
            <h2 id={titleId} className="text-2xl leading-tight">
              {t("title", { n: page.pageNumber })}
              {page.titleDisplay && page.titleDisplay !== sectionTitle ? <span className="block font-sans text-base font-normal text-ink-muted">{page.titleDisplay}</span> : null}
            </h2>
            {page.titleChanged ? <p className="text-xs text-ink-muted">{t("originalTitle", { title: page.titleOriginal })}</p> : null}
          </div>
          <button ref={firstRef} type="button" className="touch flex shrink-0 items-center justify-center rounded border border-line" aria-label={t("close")} onClick={onClose}>
            <X className="size-6" aria-hidden />
          </button>
        </header>

        <div className="flex flex-col gap-4 px-4 py-4">
          {derivedNa ? <Notice tone="warn">{t("derivedWarning", { reason: ts(`naReason.${s.naReason ?? "config"}`) })}</Notice> : null}
          {s.conflictsWithConfig ? <Notice tone="warn">{t("conflictWarning", { reason: ts("naReason.config") })}</Notice> : null}
          {s.needsVariantDecision ? <Notice tone="warn">{t("clarifyHint")}</Notice> : null}
          {page.applicability.reasons.length ? <p className="text-sm text-ink-muted">{t("rules", { reasons: page.applicability.reasons.join(" · ") })}</p> : null}
          {page.applicability.unconfirmedRules > 0 ? <p className="text-sm text-ink-muted">{t("unconfirmed", { count: page.applicability.unconfirmedRules })}</p> : null}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("status")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STATUS_ORDER.map((k) => {
                const active = !s.derived && s.status === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSetStatus(page, k)}
                    className={cx(
                      "min-h-14 rounded border-2 px-3 text-base font-semibold transition-colors",
                      active ? statusButtonTone[k].active : statusButtonTone[k].idle,
                    )}
                  >
                    {ts(k)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              onSaveDetails(page, { doneAt: doneAt || null, note: note.trim() || null });
              setSaved(true);
            }}
          >
            <Field label={t("doneAt")}>
              <Input type="date" value={doneAt} onChange={(e) => setDoneAt(e.target.value)} />
            </Field>
            <Field label={t("note")}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="secondary" disabled={!dirty}>
                {t("save")}
              </Button>
              {saved && !dirty ? (
                <span role="status" className="text-sm text-status-done">
                  {t("saved")}
                </span>
              ) : null}
            </div>
          </form>

          <Link href={`/p/${projectId}/pages/${page.id}`} className={buttonClass("ghost", "md", "no-underline border border-line")}>
            <ExternalLink className="size-5" aria-hidden />
            {t("detail")}
          </Link>
        </div>
      </div>
    </div>
  );
}
