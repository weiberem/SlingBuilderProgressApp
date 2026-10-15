"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Filter } from "lucide-react";
import { cx, formatDateTime } from "@/lib/format";
import { enqueueChange, fetchSnapshot, listPending, loadSnapshot, saveSnapshot, startSyncRunner, syncNow, SYNCED_EVENT, SYNC_ERROR_EVENT, type QueuedChange, type SyncedDetail } from "@/lib/offline";
import type { StatusKind } from "@/modules/manuals/applicability";
import { applyPageChange, applySectionChange, applyStatusRows, findPage, findSectionOfPage, type ManualViewDto, type PageDto, type SectionDto } from "@/modules/progress/view-dto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageSheet } from "./page-sheet";
import { RevisionHints } from "./revision-hints";
import { SectionBlock } from "./section-block";
import { chipTone, hatchedStyle, nextStatusOnTap } from "./status-styles";

/**
 * Handbuch-Ansicht (Client): bekommt die serverseitig gerenderte Sicht, wendet Änderungen optimistisch an,
 * legt sie in die Offline-Warteschlange und übernimmt den Serverstand nach dem Sync.
 * Offline: zuletzt gespeicherter Snapshot aus IndexedDB plus wartende Änderungen.
 */
function applyQueued(view: ManualViewDto, change: QueuedChange): ManualViewDto {
  return change.kind === "page_status" ? applyPageChange(view, change.payload) : applySectionChange(view, change.payload);
}

export function ManualViewClient({ projectId, initial }: { projectId: string; initial: ManualViewDto }) {
  const t = useTranslations("manual");
  const [base, setBase] = useState<ManualViewDto>(initial);
  const [pending, setPending] = useState<QueuedChange[]>([]);
  const [fromCache, setFromCache] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ count: number; error: string } | null>(null);
  const [sheetPageId, setSheetPageId] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [clarifyOnly, setClarifyOnly] = useState(false);

  const manualCode = initial.manual.code;
  const view = useMemo(() => pending.reduce(applyQueued, base), [base, pending]);

  const refreshPending = useCallback(async () => {
    setPending(await listPending(projectId));
  }, [projectId]);

  // Start: Sync-Läufer, Snapshot abgleichen (Cache neuer als die gelieferte Seite → Cache), wartende Änderungen laden.
  useEffect(() => {
    let cancelled = false;
    startSyncRunner();
    (async () => {
      const cached = await loadSnapshot(projectId, manualCode);
      if (cancelled) return;
      if (cached && cached.fetchedAt > initial.generatedAt) {
        setBase(cached.view);
        setFromCache(cached.fetchedAt);
      } else {
        await saveSnapshot(projectId, manualCode, initial);
      }
      await refreshPending();
      if (navigator.onLine) {
        const fresh = await fetchSnapshot(projectId, manualCode);
        if (!cancelled && fresh) {
          setBase((b) => (fresh.generatedAt > b.generatedAt ? fresh : b));
          setFromCache(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, manualCode, initial, refreshPending]);

  // Serverstand nach dem Sync übernehmen.
  useEffect(() => {
    const onSynced = (e: Event) => {
      const d = (e as CustomEvent<SyncedDetail>).detail;
      if (d.projectId !== projectId) return;
      setSyncError(null);
      if (d.pageIds.length) setBase((b) => applyStatusRows(b, d.pageIds, d.statuses));
      if (d.failed.length) setFailed({ count: d.failed.length, error: d.failed.map((f) => (f.ok ? "" : f.error)).filter(Boolean).join("; ") });
      void refreshPending();
    };
    const onError = (e: Event) => setSyncError((e as CustomEvent<{ error: string }>).detail.error);
    const onOnline = () => {
      void fetchSnapshot(projectId, manualCode).then((fresh) => {
        if (fresh) {
          setBase((b) => (fresh.generatedAt > b.generatedAt ? fresh : b));
          setFromCache(null);
        }
      });
    };
    window.addEventListener(SYNCED_EVENT, onSynced);
    window.addEventListener(SYNC_ERROR_EVENT, onError);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener(SYNCED_EVENT, onSynced);
      window.removeEventListener(SYNC_ERROR_EVENT, onError);
      window.removeEventListener("online", onOnline);
    };
  }, [projectId, manualCode, refreshPending]);

  const enqueuePage = useCallback(
    async (payload: { pageId: string; status: StatusKind; naReason?: "manual" | "config" | "quick_build" | null; doneAt?: string | null; note?: string | null }) => {
      const change = await enqueueChange({ projectId, kind: "page_status", payload });
      setPending((p) => [...p, change]);
    },
    [projectId],
  );

  const handleTap = useCallback(
    (page: PageDto) => {
      const s = page.status;
      if (s.derived && s.status === "not_applicable") {
        // Laut Konfiguration nicht zutreffend: manueller Status nur nach ausdrücklicher Wahl im Sheet.
        setSheetPageId(page.id);
        return;
      }
      const next = nextStatusOnTap(s.status);
      void enqueuePage({ pageId: page.id, status: next, naReason: next === "not_applicable" ? "manual" : null });
    },
    [enqueuePage],
  );

  const handleSetStatus = useCallback(
    (page: PageDto, status: StatusKind) => {
      void enqueuePage({ pageId: page.id, status, naReason: status === "not_applicable" ? "manual" : null });
    },
    [enqueuePage],
  );

  const handleSaveDetails = useCallback(
    (page: PageDto, details: { doneAt: string | null; note: string | null }) => {
      const s = page.status;
      const status: StatusKind = page.stored?.status ?? (s.derived && s.status === "not_applicable" ? "not_applicable" : "open");
      const naReason = status === "not_applicable" ? (page.stored?.naReason ?? s.naReason ?? "manual") : null;
      void enqueuePage({ pageId: page.id, status, naReason, doneAt: details.doneAt, note: details.note });
    },
    [enqueuePage],
  );

  const handleSection = useCallback(
    async (section: SectionDto, status: "done" | "open") => {
      const change = await enqueueChange({ projectId, kind: "section_status", payload: { sectionId: section.id, status } });
      setPending((p) => [...p, change]);
    },
    [projectId],
  );

  const pendingPageIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of pending) {
      if (c.kind === "page_status") ids.add(c.payload.pageId);
      else for (const p of view.sections.find((s) => s.id === c.payload.sectionId)?.pages ?? []) ids.add(p.id);
    }
    return ids;
  }, [pending, view]);

  const filterActive = openOnly || clarifyOnly;
  const visible = view.sections
    .map((s) => ({
      section: s,
      pages: s.pages.filter((p) => (!openOnly || (p.status.status !== "done" && p.status.status !== "not_applicable")) && (!clarifyOnly || p.status.needsVariantDecision)),
    }))
    .filter((x) => !filterActive || x.pages.length > 0);

  const sheetPage = sheetPageId ? findPage(view, sheetPageId) : null;
  const sheetSection = sheetPageId ? findSectionOfPage(view, sheetPageId) : null;
  const closeSheet = useCallback(() => setSheetPageId(null), []);
  const pr = view.progress;
  const rev = view.revision;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <Link href={`/p/${projectId}`} className="inline-flex min-h-10 items-center gap-1 self-start text-sm text-ink-muted no-underline">
          <ArrowLeft className="size-4" aria-hidden />
          {t("backToDashboard")}
        </Link>
        <div>
          <Eyebrow>
            {view.manual.docNumber ? <span className="font-mono">{view.manual.docNumber}</span> : null}
            {view.manual.docNumber ? " · " : ""}
            {t("revision", { revision: rev.revision })}
            {rev.revisionDate ? ` · ${rev.revisionDate}` : rev.coverLabel ? ` · ${rev.coverLabel}` : ""}
          </Eyebrow>
          <h1 className="text-4xl">{view.manual.title}</h1>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-3xl font-bold tabular-nums">{t("progress.done", { done: pr.done, relevant: pr.relevant })}</span>
          <span className="font-display text-xl font-bold text-ink-muted tabular-nums">{t("progress.percent", { percent: pr.percent })}</span>
        </div>
        <ProgressBar done={pr.done} inProgress={pr.inProgress} total={pr.relevant} height="h-3" />
        <div className="flex flex-wrap gap-1.5">
          {pr.inProgress > 0 ? <Badge tone="progress">{t("progress.inProgress", { count: pr.inProgress })}</Badge> : null}
          {pr.problem > 0 ? <Badge tone="problem">{t("progress.problem", { count: pr.problem })}</Badge> : null}
          {pr.notApplicable > 0 ? <Badge tone="na">{t("progress.notApplicable", { count: pr.notApplicable })}</Badge> : null}
          {pr.needsVariantDecision > 0 ? <Badge tone="clarify">{t("progress.clarify", { count: pr.needsVariantDecision })}</Badge> : null}
          {pr.conflictsWithConfig > 0 ? <Badge tone="red">{t("progress.conflicts", { count: pr.conflictsWithConfig })}</Badge> : null}
        </div>
        {fromCache ? <Notice tone="warn">{t("offline.fromCache", { time: formatDateTime(fromCache) })}</Notice> : null}
        {syncError ? (
          <Notice tone="error">
            <span className="flex flex-wrap items-center gap-2">
              {t("offline.syncError", { error: syncError })}
              <Button size="sm" variant="secondary" onClick={() => void syncNow()}>
                {t("offline.retry")}
              </Button>
            </span>
          </Notice>
        ) : null}
        {failed ? <Notice tone="error">{t("offline.changeFailed", { count: failed.count, error: failed.error })}</Notice> : null}
        <RevisionHints report={rev.importReport} revisionNote={rev.notes} />
      </header>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("filters.label")}>
        <Filter className="size-5 text-ink-muted" aria-hidden />
        <ToggleChip pressed={openOnly} onClick={() => setOpenOnly((v) => !v)}>
          {t("filters.openOnly")}
        </ToggleChip>
        <ToggleChip pressed={clarifyOnly} onClick={() => setClarifyOnly((v) => !v)}>
          {t("filters.clarify")}
        </ToggleChip>
      </div>
      <Legend />

      {visible.length === 0 ? <p className="text-ink-muted">{t("filters.empty")}</p> : null}
      {visible.map(({ section, pages }) => (
        <SectionBlock key={section.id} section={section} pages={pages} pendingPageIds={pendingPageIds} onTap={handleTap} onOpen={(p) => setSheetPageId(p.id)} onSectionStatus={handleSection} />
      ))}

      {sheetPage ? (
        <PageSheet
          key={sheetPage.id}
          page={sheetPage}
          sectionTitle={sheetSection?.isUntitled ? t("section.untitled") : (sheetSection?.titleDisplay ?? "")}
          projectId={projectId}
          onClose={closeSheet}
          onSetStatus={handleSetStatus}
          onSaveDetails={handleSaveDetails}
        />
      ) : null}
    </div>
  );
}

function ToggleChip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "min-h-12 rounded-full border px-4 text-sm font-semibold transition-colors",
        pressed ? "border-brand-red bg-brand-red text-on-red" : "border-line bg-surface text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Legend() {
  const t = useTranslations("manual.legend");
  const items: { key: keyof typeof chipTone | "derived" | "clarify"; label: string }[] = [
    { key: "open", label: t("open") },
    { key: "in_progress", label: t("in_progress") },
    { key: "done", label: t("done") },
    { key: "not_applicable", label: t("not_applicable") },
    { key: "derived", label: t("derived") },
    { key: "problem", label: t("problem") },
    { key: "clarify", label: t("clarify") },
  ];
  return (
    <details className="-mt-3">
      <summary className="flex min-h-10 cursor-pointer list-none items-center text-sm text-ink-muted underline underline-offset-2 select-none [&::-webkit-details-marker]:hidden">{t("title")}</summary>
      <div className="mt-1 flex flex-col gap-2 rounded border border-line bg-surface p-3 text-sm">
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cx(
                  "inline-block size-5 rounded border-2",
                  i.key === "derived" ? `${chipTone.not_applicable} opacity-60` : i.key === "clarify" ? "border-dashed border-status-clarify bg-bg" : chipTone[i.key],
                )}
                style={i.key === "derived" ? hatchedStyle : undefined}
              />
              {i.label}
            </li>
          ))}
        </ul>
        <p className="text-ink-muted">{t("help")}</p>
      </div>
    </details>
  );
}
