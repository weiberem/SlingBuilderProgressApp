import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/modules/auth/dal";
import {
  listAdminCatalog,
  type AdminRevision,
  type AdminRule,
} from "@/modules/manuals/admin-service";
import type { Alias } from "@/modules/manuals/schema";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Eyebrow } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { PageCountForm } from "./page-count-form";
import { RuleConfirmToggle } from "./rule-confirm-toggle";

export const metadata = { title: "Stammdaten" };

const statusTone: Record<AdminRevision["revision"]["status"], Tone> = {
  draft: "neutral",
  in_review: "clarify",
  released: "done",
};

function formatBytes(n: number | null): string {
  if (n == null) return "";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Stammdaten-Verwaltung (nur Plattform-Admin): Modelle → Handbücher → Revisionen mit Regeln und Aliasen. */
export default async function AdminManualsPage() {
  await requirePlatformAdmin();
  const [catalog, t] = await Promise.all([
    listAdminCatalog(),
    getTranslations("admin.manuals"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="text-sm text-ink-muted">{t("intro")}</p>
      </header>

      {catalog.map(({ model, manuals, aliases }) => (
        <section
          key={model.id}
          aria-labelledby={`model-${model.id}`}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <Eyebrow>{t("model")}</Eyebrow>
            <h2 id={`model-${model.id}`} className="text-2xl">
              {model.name}
            </h2>
            <span className="font-mono text-xs text-ink-muted">
              {model.code}
            </span>
            {!model.active ? <Badge tone="na">{t("inactive")}</Badge> : null}
            <span className="text-sm text-ink-muted">
              · {t("manuals", { count: manuals.length })}
            </span>
          </div>

          {manuals.map(({ manual, revisions, aliases: manualAliases }) => (
            <Card key={manual.id}>
              <CardHeader className="flex-col items-start gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl">{manual.title}</h3>
                  <Badge tone="neutral">{t(`kind.${manual.kind}`)}</Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  {manual.docNumber ? (
                    <span className="font-mono">{manual.docNumber}</span>
                  ) : (
                    t("noDocNumber")
                  )}{" "}
                  · {t("assemblyGroup")}:{" "}
                  <span className="font-mono">{manual.assemblyGroup}</span>
                </p>
                {manual.notes ? (
                  <p className="text-sm text-ink-muted">{manual.notes}</p>
                ) : null}
              </CardHeader>
              <CardBody className="flex flex-col gap-4">
                {revisions.length === 0 ? (
                  <p className="text-sm text-ink-muted">{t("noRevisions")}</p>
                ) : null}
                {revisions.map((r) => (
                  <RevisionBlock
                    key={r.revision.id}
                    r={r}
                    isIntro={manual.kind === "intro"}
                  />
                ))}
                {manualAliases.length ? (
                  <AliasList aliases={manualAliases} scope="manual" />
                ) : null}
              </CardBody>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <Eyebrow>
                {t("aliases.title")} · {t("aliases.scope.model")}
              </Eyebrow>
            </CardHeader>
            <CardBody>
              <AliasList aliases={aliases} scope="model" />
            </CardBody>
          </Card>
        </section>
      ))}
    </div>
  );
}

async function RevisionBlock({
  r,
  isIntro,
}: {
  r: AdminRevision;
  isIntro: boolean;
}) {
  const t = await getTranslations("admin.manuals");
  const rev = r.revision;
  const confirmedCount = r.rules.filter((x) => x.confirmed).length;
  return (
    <details
      open={rev.status === "released"}
      className="group rounded border border-line bg-bg"
    >
      <summary className="touch flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2">
        <ChevronRight
          className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-90"
          aria-hidden
        />
        <h4 className="font-display text-lg font-bold">
          {t("revision", { revision: rev.revision })}
        </h4>
        <Badge tone={statusTone[rev.status]}>{t(`status.${rev.status}`)}</Badge>
        {rev.releasedAt ? (
          <span className="text-xs text-ink-muted">
            {t("released", { date: formatDate(rev.releasedAt) })}
          </span>
        ) : null}
        {rev.pageCount == null && !isIntro ? (
          <Badge tone="clarify">{t("pageCountUnknown")}</Badge>
        ) : null}
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3">
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          <Row label={t("revisionDate")}>
            {rev.revisionDate ? (
              formatDate(rev.revisionDate)
            ) : rev.coverLabel ? (
              `${t("coverLabel")}: ${rev.coverLabel}`
            ) : (
              <Badge tone="clarify">{t("dateUnknown")}</Badge>
            )}
          </Row>
          <Row label={t("pageCount")}>
            {rev.pageCount ?? (
              <Badge tone="clarify">{t("pageCountUnknown")}</Badge>
            )}
            <span className="text-ink-muted">
              {" "}
              · {t("sections", { count: r.sectionCount })}
              {r.untitledSectionCount
                ? ` (${t("untitledSections", { count: r.untitledSectionCount })})`
                : ""}{" "}
              · {t("pagesInDb", { count: r.pageRowCount })}
            </span>
          </Row>
          <Row label={t("source")}>
            {rev.sourceName ? (
              <>
                <span className="break-all">{rev.sourceName}</span>
                {rev.sourceSize != null ? (
                  <span className="text-ink-muted">
                    {" "}
                    ({formatBytes(rev.sourceSize)})
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-ink-muted">{t("sourceUnknown")}</span>
            )}
          </Row>
          {rev.sourceHash ? (
            <Row label={t("hash")}>
              <span className="break-all font-mono text-xs">
                {rev.sourceHash}
              </span>
            </Row>
          ) : null}
        </dl>
        {rev.notes ? (
          <p className="text-sm text-ink-muted">
            <span className="font-semibold">{t("notes")}:</span> {rev.notes}
          </p>
        ) : null}

        <details
          className="rounded border border-line"
          open={rev.importReport.conflicts.some((c) => !c.resolved)}
        >
          <summary className="touch flex cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold">
            {t("report.title")}
            <Badge tone="neutral">
              {t("report.notes", { count: rev.importReport.notes.length })}
            </Badge>
            <Badge
              tone={
                rev.importReport.conflicts.some((c) => !c.resolved)
                  ? "problem"
                  : "neutral"
              }
            >
              {t("report.conflicts", {
                count: rev.importReport.conflicts.length,
              })}
            </Badge>
          </summary>
          <div className="flex flex-col gap-2 px-3 pb-3 text-sm">
            {rev.importReport.conflicts.map((c, i) => (
              <p key={`c${i}`} className="flex flex-wrap items-baseline gap-1">
                <Badge tone={c.resolved ? "done" : "problem"}>
                  {c.resolved ? t("report.resolved") : t("report.open")}
                </Badge>
                <span className="font-mono text-xs text-ink-muted">
                  {c.code}
                </span>
                <span>{c.text}</span>
                {c.pages?.length ? (
                  <span className="text-xs text-ink-muted">
                    ({t("report.pages", { pages: c.pages.join(", ") })})
                  </span>
                ) : null}
              </p>
            ))}
            {rev.importReport.notes.map((n, i) => (
              <p key={`n${i}`} className="flex flex-wrap items-baseline gap-1">
                <span className="font-mono text-xs text-ink-muted">
                  {n.code}
                </span>
                <span>{n.text}</span>
                {n.pages?.length ? (
                  <span className="text-xs text-ink-muted">
                    ({t("report.pages", { pages: n.pages.join(", ") })})
                  </span>
                ) : null}
              </p>
            ))}
          </div>
        </details>

        {r.canSetPageCount && !isIntro ? (
          <PageCountForm revisionId={rev.id} current={rev.pageCount} />
        ) : null}

        <details className="rounded border border-line">
          <summary className="touch flex cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold">
            {t("rules.title")}
            <Badge
              tone={
                r.rules.length && confirmedCount < r.rules.length
                  ? "clarify"
                  : "neutral"
              }
            >
              {r.rules.length
                ? t("rules.summary", {
                    confirmed: confirmedCount,
                    unconfirmed: r.rules.length - confirmedCount,
                  })
                : t("rules.none")}
            </Badge>
          </summary>
          {r.rules.length ? (
            <ul className="flex flex-col divide-y divide-line px-3 pb-3">
              {r.rules.map((rule) => (
                <RuleRow key={rule.id} rule={rule} />
              ))}
            </ul>
          ) : null}
        </details>

        {r.aliases.length ? (
          <AliasList aliases={r.aliases} scope="revision" />
        ) : null}
      </div>
    </details>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wider text-ink-muted">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

async function RuleRow({ rule }: { rule: AdminRule }) {
  const t = await getTranslations("admin.manuals.rules");
  const target =
    rule.target.kind === "page"
      ? t("page", { number: rule.target.pageNumber })
      : rule.target.kind === "section"
        ? t("section", {
            title: rule.target.title,
            from: rule.target.pageFrom,
            to: rule.target.pageTo,
          })
        : t("missing");
  return (
    <li className="flex flex-col gap-1 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{target}</span>
        <Badge tone="neutral">{t(`effect.${rule.effect}`)}</Badge>
        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs break-all">
          {JSON.stringify(rule.expression)}
        </code>
      </div>
      {rule.sourceText ? (
        <p>
          <span className="text-ink-muted">{t("source")}:</span> «
          {rule.sourceText}»
        </p>
      ) : null}
      {rule.rationale ? (
        <p className="text-ink-muted">
          <span>{t("rationale")}:</span> {rule.rationale}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <RuleConfirmToggle ruleId={rule.id} confirmed={rule.confirmed} />
        {rule.confirmedAt ? (
          <span className="text-xs text-ink-muted">
            {t("confirmedBy", { date: formatDateTime(rule.confirmedAt) })}
          </span>
        ) : null}
      </div>
    </li>
  );
}

async function AliasList({
  aliases,
  scope,
}: {
  aliases: Alias[];
  scope: "model" | "manual" | "revision";
}) {
  const t = await getTranslations("admin.manuals.aliases");
  if (!aliases.length)
    return <p className="text-sm text-ink-muted">{t("none")}</p>;
  return (
    <div className="flex flex-col gap-1">
      {scope !== "model" ? (
        <p className="text-xs uppercase tracking-wider text-ink-muted">
          {t("title")} · {t(`scope.${scope}`)}
        </p>
      ) : null}
      <ul className="flex flex-col divide-y divide-line text-sm">
        {aliases.map((a) => (
          <li key={a.id} className="flex flex-col gap-1 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{t(`kind.${a.kind}`)}</Badge>
              {a.isRegex ? <Badge tone="neutral">{t("regex")}</Badge> : null}
              {!a.active ? <Badge tone="na">{t("inactive")}</Badge> : null}
              <code className="font-mono text-xs">{a.matchText}</code>
              <span aria-hidden>{t("arrow")}</span>
              <code className="font-mono text-xs">{a.replacement}</code>
            </div>
            <p className="text-xs text-ink-muted">{a.rationale}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
