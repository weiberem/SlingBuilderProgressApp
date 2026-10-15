"use client";

import { useTranslations } from "next-intl";
import { CheckCheck, Info, RotateCcw } from "lucide-react";
import type { PageDto, SectionDto } from "@/modules/progress/view-dto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageChip } from "./page-chip";

/** Ein Abschnitt: Titel (mit Original als Tooltip), Seitenbereich, Varianten-Badges, Fortschritt, Chips, Sammelaktion. */
export function SectionBlock({
  section,
  pages,
  pendingPageIds,
  onTap,
  onOpen,
  onSectionStatus,
}: {
  section: SectionDto;
  /** Sichtbare Seiten (nach Filter). */
  pages: PageDto[];
  pendingPageIds: ReadonlySet<string>;
  onTap: (page: PageDto) => void;
  onOpen: (page: PageDto) => void;
  onSectionStatus: (section: SectionDto, status: "done" | "open") => void;
}) {
  const t = useTranslations("manual.section");
  const p = section.progress;
  const clarify = section.pages.filter((x) => x.status.needsVariantDecision).length;
  const qb = section.pages.some((x) => x.applicability.qbPrebuilt === "true");
  const reasons = [...new Set(section.pages.flatMap((x) => x.applicability.reasons))];
  const unconfirmed = Math.max(0, ...section.pages.map((x) => x.applicability.unconfirmedRules));
  const canComplete = p.relevant > 0 && p.done < p.relevant;
  const canReset = section.pages.some((x) => x.stored && x.stored.status !== "open");
  const headingId = `sec-${section.id}`;

  return (
    <Card aria-labelledby={headingId}>
      <CardHeader className="flex-col items-stretch gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id={headingId} className="flex items-center gap-2 text-xl">
            <span>{section.isUntitled ? t("untitled") : section.titleDisplay}</span>
            {section.titleChanged ? (
              <span className="inline-flex" title={t("originalTitle", { title: section.titleOriginal })}>
                <Info className="size-4 text-ink-muted" aria-hidden />
                <span className="sr-only">{t("originalTitle", { title: section.titleOriginal })}</span>
              </span>
            ) : null}
          </h2>
          <span className="font-mono text-sm text-ink-muted tabular-nums">
            {section.pageFrom === section.pageTo ? t("page", { n: section.pageFrom }) : t("pages", { from: section.pageFrom, to: section.pageTo })}
            {" · "}
            <span className="font-display text-base font-bold text-ink">{p.relevant > 0 ? t("doneOf", { done: p.done, relevant: p.relevant }) : t("noRelevant")}</span>
          </span>
        </div>
        {section.titleNote ? <p className="text-sm text-ink-muted">{section.titleNote}</p> : null}
        {clarify > 0 || qb || reasons.length > 0 || unconfirmed > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
            {clarify > 0 ? <Badge tone="clarify">{t("clarify")}</Badge> : null}
            {qb ? <Badge tone="na">{t("qbPrebuilt")}</Badge> : null}
            {reasons.length ? <span>{t("rules", { reasons: reasons.join(" · ") })}</span> : null}
            {unconfirmed > 0 ? <span>{t("unconfirmed", { count: unconfirmed })}</span> : null}
          </div>
        ) : null}
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {p.relevant > 0 ? <ProgressBar done={p.done} inProgress={p.inProgress} total={p.relevant} /> : null}
        <ul className="flex flex-wrap gap-3 py-1" aria-label={section.titleDisplay}>
          {pages.map((pg) => (
            <li key={pg.id}>
              <PageChip page={pg} pending={pendingPageIds.has(pg.id)} onTap={onTap} onOpen={onOpen} />
            </li>
          ))}
        </ul>
        {canComplete || canReset ? (
          <div className="flex flex-wrap gap-2">
            {canComplete ? (
              <Button variant="secondary" onClick={() => onSectionStatus(section, "done")}>
                <CheckCheck className="size-5" aria-hidden />
                {t("markDone")}
              </Button>
            ) : null}
            {canReset ? (
              <Button
                variant="ghost"
                className="border border-line"
                onClick={() => {
                  if (window.confirm(t("resetConfirm"))) onSectionStatus(section, "open");
                }}
              >
                <RotateCcw className="size-5" aria-hidden />
                {t("reset")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
