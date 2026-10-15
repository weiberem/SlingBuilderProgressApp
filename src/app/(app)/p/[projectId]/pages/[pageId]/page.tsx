import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { getProjectContext } from "@/modules/projects/context";
import { getPageDetail } from "@/modules/progress/service";
import { Badge, statusTone } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/field";
import { MissingPartsPanel } from "@/components/progress/missing-parts-panel";
import { PageDetailsForm } from "@/components/progress/page-details-form";
import { PageStatusButtons } from "@/components/progress/page-status-buttons";

type Params = Promise<{ projectId: string; pageId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { projectId, pageId } = await params;
  const ctx = await getProjectContext(projectId);
  const d = await getPageDetail(ctx, pageId);
  return { title: d ? `${d.manual.title} · S. ${d.page.pageNumber}` : "Seite" };
}

type AuditValue = { status?: string; naReason?: string | null; doneAt?: string | null; note?: string | null } | null;

/** Seitendetail: Titel, Hinweise, Regeln, Status, Datum/Notiz, Fehlteile, Zusatzarbeiten, Visa, Verlauf. */
export default async function PageDetailPage({ params }: { params: Params }) {
  const { projectId, pageId } = await params;
  const ctx = await getProjectContext(projectId);
  const [d, t, ts] = await Promise.all([getPageDetail(ctx, pageId), getTranslations("page"), getTranslations("common.status")]);
  if (!d) notFound();

  const base = `/p/${projectId}`;
  const s = d.status;
  const a = d.applicability;
  const flags = d.page.flags;
  const flagHints: string[] = [];
  if (flags.tocMismatch) flagHints.push(t("flags.tocMismatch"));
  if (flags.missingInToc) flagHints.push(t("flags.missingInToc"));
  if (flags.typeHeaderMismatch) flagHints.push(t("flags.typeHeaderMismatch", { value: flags.typeHeaderMismatch }));
  if (flags.variantNote) flagHints.push(t("flags.variantNote", { value: flags.variantNote }));
  if (flags.qbConflict) flagHints.push(t("flags.qbConflict", { value: flags.qbConflict }));
  if (flags.noText) flagHints.push(t("flags.noText"));

  const statusLabel = (v: AuditValue) => {
    if (!v?.status) return t("history.none");
    return v.status === "not_applicable" ? `${ts("not_applicable")} (${ts(`naReason.${v.naReason ?? "manual"}`)})` : ts(v.status as "open");
  };

  const navLink = (target: { id: string; pageNumber: number } | null, dir: "prev" | "next") => {
    const label = target ? t(dir, { n: target.pageNumber }) : "";
    const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
    return target ? (
      <Link href={`${base}/pages/${target.id}`} className={buttonClass("secondary", "md", "no-underline")} aria-label={label} rel={dir}>
        {dir === "prev" ? <Icon className="size-5" aria-hidden /> : null}
        <span className="font-mono tabular-nums">{target.pageNumber}</span>
        {dir === "next" ? <Icon className="size-5" aria-hidden /> : null}
      </Link>
    ) : (
      <span className={buttonClass("secondary", "md", "pointer-events-none opacity-40")} aria-hidden>
        <Icon className="size-5" />
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Link href={`${base}/manuals/${d.manual.code}`} className="inline-flex min-h-10 items-center gap-1 text-sm text-ink-muted no-underline">
            <ArrowLeft className="size-4" aria-hidden />
            {t("backToManual", { manual: d.manual.title })}
          </Link>
          <nav className="flex gap-2" aria-label="Seiten">
            {navLink(d.prev, "prev")}
            {navLink(d.next, "next")}
          </nav>
        </div>
        <div>
          <Eyebrow>
            {d.manual.title} · {t("meta.revision", { revision: d.revision.revision })}
            {d.manual.docNumber ? <span className="font-mono"> · {d.manual.docNumber}</span> : null}
          </Eyebrow>
          <h1 className="text-4xl">
            {t("title", { n: d.page.pageNumber })}
            <span className="block font-sans text-xl font-normal">{d.titleDisplay || t("noTitle")}</span>
          </h1>
          {d.titleChanged ? <p className="text-sm text-ink-muted">{t("originalTitle", { title: d.titleOriginal })}</p> : null}
          <p className="mt-1 text-sm text-ink-muted">
            {t("meta.section")}: {d.section.isUntitled ? "–" : d.sectionTitleDisplay} ({d.section.pageFrom}–{d.section.pageTo})
            {d.page.drawingNumber ? (
              <>
                {" · "}
                {t("meta.drawing")}: <span className="font-mono">{d.page.drawingNumber}</span>
                {d.page.drawingRevision ? ` Rev ${d.page.drawingRevision}` : ""}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={statusTone[s.status]}>{s.status === "not_applicable" ? `${ts("not_applicable")} · ${ts(`naReason.${s.naReason ?? "manual"}`)}` : ts(s.status)}</Badge>
          {s.needsVariantDecision ? <Badge tone="clarify">{ts("clarify")}</Badge> : null}
          {s.conflictsWithConfig ? <Badge tone="red">{t("applicability.conflict", { reason: ts("naReason.config") })}</Badge> : null}
        </div>
        {flagHints.length ? (
          <Notice tone="warn">
            <p className="font-semibold">{t("flags.title")}</p>
            <ul className="list-disc pl-5">
              {flagHints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </Notice>
        ) : null}
        {d.page.notes ? <p className="text-sm text-ink-muted">{d.page.notes}</p> : null}
      </header>

      <Card aria-labelledby="status-h">
        <CardHeader>
          <h2 id="status-h" className="text-xl">
            {t("status.title")}
          </h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <PageStatusButtons projectId={projectId} pageId={pageId} status={s} />
          <PageDetailsForm projectId={projectId} pageId={pageId} status={s} doneAt={d.stored?.doneAt ?? null} note={d.stored?.note ?? null} />
        </CardBody>
      </Card>

      <Card aria-labelledby="rules-h">
        <CardHeader>
          <h2 id="rules-h" className="text-xl">
            {t("applicability.title")}
          </h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-2 text-sm">
          {d.rules.length === 0 ? (
            <p className="text-ink-muted">{t("applicability.none")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.rules.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-muted">{t(`applicability.effect.${r.effect as "applies_only_if" | "qb_prebuilt"}`)}:</span>
                  <span className="font-semibold">{r.sourceText ?? t("applicability.noSource")}</span>
                  <Badge tone={r.confirmed ? "done" : "clarify"}>{r.confirmed ? t("applicability.confirmed") : t("applicability.unconfirmed")}</Badge>
                  {r.rationale ? <span className="basis-full text-xs text-ink-muted">{r.rationale}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <p className="text-ink-muted">
            {a.applies === "false" ? t("applicability.result.notApplies") : a.applies === "unknown" ? t("applicability.result.unknown") : t("applicability.result.applies")}
            {a.qbPrebuilt === "true" ? ` ${t("applicability.result.qbPrebuilt")}` : a.qbPrebuilt === "unknown" ? ` ${t("applicability.result.qbUnknown")}` : ""}
          </p>
        </CardBody>
      </Card>

      <Card aria-labelledby="parts-h">
        <CardHeader>
          <h2 id="parts-h" className="text-xl">
            {t("parts.title")}
          </h2>
          <Link href={`${base}/parts`} className="text-sm text-ink-muted">
            {t("parts.allParts")}
          </Link>
        </CardHeader>
        <CardBody>
          <MissingPartsPanel projectId={projectId} pageId={pageId} parts={d.missingParts} />
        </CardBody>
      </Card>

      <Card aria-labelledby="tasks-h">
        <CardHeader>
          <h2 id="tasks-h" className="text-xl">
            {t("tasks.title")}
          </h2>
          <Link href={`${base}/tasks/new?pageId=${pageId}`} className={buttonClass("secondary", "sm", "no-underline")}>
            <Plus className="size-4" aria-hidden />
            {t("tasks.add")}
          </Link>
        </CardHeader>
        <CardBody>
          {d.tasks.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("tasks.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {d.tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-2">
                  <Badge tone={task.done ? "done" : "neutral"}>{task.done ? t("tasks.done") : t("tasks.open")}</Badge>
                  <Link href={`${base}/tasks/${task.id}`} className="min-w-0 flex-1 no-underline">
                    <span className={task.done ? "line-through text-ink-muted" : ""}>{task.title}</span>
                    {task.category ? <span className="ml-2 text-xs text-ink-muted">{task.category}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card aria-labelledby="visas-h">
        <CardHeader>
          <h2 id="visas-h" className="text-xl">
            {t("visas.title")}
          </h2>
        </CardHeader>
        <CardBody>
          {d.visas.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("visas.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {d.visas.map((v) => (
                <li key={v.id}>
                  {t("visas.by", { name: v.advisorName, date: formatDate(v.visaDate) })}
                  {v.note ? <span className="text-ink-muted"> · {v.note}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card aria-labelledby="history-h">
        <CardHeader>
          <h2 id="history-h" className="text-xl">
            {t("history.title")}
          </h2>
        </CardHeader>
        <CardBody>
          {d.history.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("history.empty")}</p>
          ) : (
            <ol className="flex flex-col divide-y divide-line text-sm">
              {d.history.map((h) => {
                const oldV = h.oldValue as AuditValue;
                const newV = h.newValue as AuditValue;
                return (
                  <li key={h.id} className="flex flex-col gap-0.5 py-2">
                    <span className="text-ink-muted">
                      {t("history.entry", { who: h.userId === ctx.userId ? ctx.userName : t("history.otherUser"), when: formatDateTime(h.at) })}
                      {h.clientChangeId ? ` ${t("history.offlineSync")}` : ""}
                    </span>
                    <span className="font-semibold">{t("history.change", { from: statusLabel(oldV), to: statusLabel(newV) })}</span>
                    {newV?.note && newV.note !== oldV?.note ? <span className="text-ink-muted">{newV.note}</span> : null}
                  </li>
                );
              })}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
