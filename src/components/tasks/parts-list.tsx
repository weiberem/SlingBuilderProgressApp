"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, Trash2 } from "lucide-react";
import { deleteMissingPartAction, setMissingPartStatusAction, type PartActionError } from "@/modules/progress/parts-actions";
import { Button } from "@/components/ui/button";
import { Notice, Select } from "@/components/ui/field";
import { cx } from "@/lib/format";
import { formatQuantity, pageHref } from "./page-href";
import { PART_STATUSES, type MissingPartStatus, type PartDto } from "./types";

type Patch = { type: "status"; id: string; status: MissingPartStatus } | { type: "remove"; id: string };

function applyPatch(state: PartDto[], patch: Patch): PartDto[] {
  if (patch.type === "remove") return state.filter((p) => p.id !== patch.id);
  return state.map((p) => (p.id === patch.id ? { ...p, status: patch.status } : p));
}

/** Gruppen je Handbuch (alphabetisch), «Ohne Seite» zuletzt; innerhalb nach Seite und Position. */
function groupByManual(parts: PartDto[]): { key: string; title: string | null; parts: PartDto[] }[] {
  const map = new Map<string, PartDto[]>();
  for (const p of parts) {
    const k = p.manualTitle ?? "";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(p);
  }
  const byPage = (a: PartDto, b: PartDto) =>
    (a.pageNumber ?? 0) - (b.pageNumber ?? 0) || (a.position ?? "").localeCompare(b.position ?? "", "de", { numeric: true });
  return [...map.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "de")))
    .map(([k, list]) => ({ key: k || "__none", title: k || null, parts: [...list].sort(byPage) }));
}

const statusClass: Record<MissingPartStatus, string> = {
  needed: "border-status-problem text-status-problem bg-status-problem-soft",
  ordered: "border-status-progress text-status-progress bg-status-progress-soft",
  received: "border-status-clarify text-status-clarify bg-status-clarify-soft",
  installed: "border-status-done text-status-done bg-status-done-soft",
};

export function PartsList({ projectId, parts }: { projectId: string; parts: PartDto[] }) {
  const t = useTranslations("parts");
  const [optimistic, apply] = useOptimistic<PartDto[], Patch>(parts, applyPatch);
  const [error, setError] = useState<PartActionError | null>(null);
  const [, startTransition] = useTransition();

  const setStatus = (part: PartDto, status: MissingPartStatus) => {
    setError(null);
    startTransition(async () => {
      apply({ type: "status", id: part.id, status });
      const r = await setMissingPartStatusAction({ projectId, id: part.id, status });
      if (!r.ok) setError(r.error);
    });
  };
  const remove = (part: PartDto) => {
    setError(null);
    startTransition(async () => {
      apply({ type: "remove", id: part.id });
      const r = await deleteMissingPartAction({ projectId, id: part.id });
      if (!r.ok) setError(r.error);
    });
  };

  const groups = groupByManual(optimistic);

  return (
    <div className="flex flex-col gap-5">
      {error ? <Notice tone="error">{t(`errors.${error}`)}</Notice> : null}
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-ink-muted">{t("empty")}</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-labelledby={`man-${g.key}`} className="flex flex-col gap-2">
            <h2 id={`man-${g.key}`} className="flex items-baseline justify-between gap-2 text-lg">
              <span className={cx(!g.title && "text-ink-muted")}>{g.title ?? t("noManual")}</span>
              <span className="whitespace-nowrap text-xs font-normal text-ink-muted">{t("groupCount", { count: g.parts.length })}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {g.parts.map((part) => (
                <PartItem key={part.id} part={part} projectId={projectId} onStatus={(s) => setStatus(part, s)} onDelete={() => remove(part)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function PartItem({ part, projectId, onStatus, onDelete }: { part: PartDto; projectId: string; onStatus: (s: MissingPartStatus) => void; onDelete: () => void }) {
  const t = useTranslations("parts");
  const [confirming, setConfirming] = useState(false);
  const selectId = `status-${part.id}`;

  return (
    <li className={cx("rounded-lg border border-line bg-surface p-3 shadow-[var(--shadow-1)]", part.status === "installed" && "opacity-75")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold leading-snug">
            {part.position ? (
              <span className="text-ink-muted">
                <span className="sr-only">{t("columns.position")} </span>
                {part.position}
              </span>
            ) : null}
            <span>{part.description}</span>
            {part.partNumber ? (
              <span className="font-mono text-sm font-normal text-ink-muted">
                <span className="sr-only">{t("columns.partNumber")} </span>
                {part.partNumber}
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            <span className="tabular-nums">
              <span className="sr-only">{t("columns.quantity")} </span>
              {formatQuantity(part.quantity)} {part.unit}
            </span>
            {part.pageId && part.manualCode && part.pageNumber != null ? (
              <Link href={pageHref(projectId, part.manualCode, part.pageId)} className="inline-flex min-h-12 items-center gap-1 font-semibold text-ink">
                <BookOpen className="size-4" aria-hidden />
                {t("item.page", { manual: part.manualTitle ?? "", page: part.pageNumber })}
              </Link>
            ) : null}
          </div>
          {part.note ? <p className="whitespace-pre-wrap text-sm text-ink-muted">{part.note}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="sr-only">
            {t("item.statusFor", { description: part.description })}
          </label>
          <Select
            id={selectId}
            value={part.status}
            onChange={(e) => onStatus(e.target.value as MissingPartStatus)}
            className={cx("w-auto min-w-36 font-semibold", statusClass[part.status])}
          >
            {PART_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Select>
          {confirming ? (
            <>
              <span className="text-sm font-semibold">{t("item.confirmDelete")}</span>
              <Button variant="danger" onClick={onDelete}>
                {t("item.confirmYes")}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                {t("item.cancel")}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)} aria-label={`${t("item.delete")}: ${part.description}`} className="text-ink-muted">
              <Trash2 className="size-5" aria-hidden />
              <span className="sm:sr-only">{t("item.delete")}</span>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
