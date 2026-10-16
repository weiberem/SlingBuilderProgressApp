import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getProjectContext } from "@/modules/projects/context";
import { getProject } from "@/modules/projects/service";
import { getManualsOverview } from "@/modules/progress/service";
import { countOpenTasks } from "@/modules/progress/tasks-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Eyebrow } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EXPORT_REMINDER_DAYS, exportReminder } from "@/modules/projects/export-service";
import { formatDateTime } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { Download } from "lucide-react";

export const metadata = { title: "Bau" };

/** Dashboard: Gesamtfortschritt und ein Eintrag pro Handbuch (nur zutreffende Seiten gezählt). */
export default async function ProjectDashboard({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await getProjectContext(projectId);
  const [project, overview, openTasks, t] = await Promise.all([
    getProject(ctx),
    getManualsOverview(ctx),
    countOpenTasks(ctx),
    getTranslations("progress"),
  ]);
  const total = overview.total;
  const setupDone = !!project.settings.onboardingCompletedAt;
  const reminder = exportReminder(project.settings);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div>
          <Eyebrow>{project.modelName} · Kit {project.kitNumber}</Eyebrow>
          <h1 className="font-display text-5xl font-bold tracking-wide">{project.registration}</h1>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat value={`${total.done} / ${total.relevant}`} label={t("dashboard.pagesDone")} />
          <Stat value={`${total.percent} %`} label={t("dashboard.ofRelevant")} />
          <Stat value={String(openTasks)} label={t("dashboard.openTasks")} href={`/p/${projectId}/tasks`} />
        </div>
        <ProgressBar done={total.done} inProgress={total.inProgress} total={total.relevant} height="h-3" />
        <div className="flex flex-wrap gap-2 text-sm">
          {total.needsVariantDecision > 0 ? (
            <Link href={`/p/${projectId}/setup`} className="no-underline">
              <Badge tone="clarify">{t("dashboard.clarify", { count: total.needsVariantDecision })}</Badge>
            </Link>
          ) : null}
          {total.problem > 0 ? <Badge tone="problem">{t("dashboard.problems", { count: total.problem })}</Badge> : null}
          {total.conflictsWithConfig > 0 ? <Badge tone="neutral">{t("dashboard.conflicts", { count: total.conflictsWithConfig })}</Badge> : null}
          {!setupDone ? (
            <Link href={`/p/${projectId}/setup`} className="no-underline">
              <Badge tone="red">{t("dashboard.setupOpen")}</Badge>
            </Link>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="manuals-h" className="flex flex-col gap-3">
        <h2 id="manuals-h" className="text-2xl">
          {t("dashboard.manuals")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {overview.manuals.map(({ manual, revision, progress, hasStructure }) => (
            <li key={manual.id}>
              <Link href={`/p/${projectId}/manuals/${manual.code}`} className="block no-underline">
                <Card className="h-full transition-colors hover:border-line-strong">
                  <CardHeader>
                    <h3 className="text-xl">{manual.title}</h3>
                    {progress ? (
                      <span className="font-display text-xl font-bold tabular-nums">
                        {progress.done}/{progress.relevant}
                      </span>
                    ) : null}
                  </CardHeader>
                  <CardBody className="flex flex-col gap-2">
                    <p className="text-xs text-ink-muted">
                      {manual.docNumber ? <span className="font-mono">{manual.docNumber}</span> : t("dashboard.noDocNumber")}
                      {revision ? ` · Rev ${revision.revision}${revision.revisionDate ? ` · ${revision.revisionDate}` : revision.coverLabel ? ` · ${revision.coverLabel}` : ""}` : ""}
                    </p>
                    {progress ? (
                      <>
                        <ProgressBar done={progress.done} inProgress={progress.inProgress} total={progress.relevant} />
                        <div className="flex flex-wrap gap-1.5">
                          {progress.needsVariantDecision > 0 ? <Badge tone="clarify">{t("dashboard.clarify", { count: progress.needsVariantDecision })}</Badge> : null}
                          {progress.notApplicable > 0 ? <Badge tone="na">{t("dashboard.notApplicable", { count: progress.notApplicable })}</Badge> : null}
                          {progress.problem > 0 ? <Badge tone="problem">{t("dashboard.problems", { count: progress.problem })}</Badge> : null}
                        </div>
                      </>
                    ) : revision && manual.kind === "intro" ? (
                      <p className="text-sm text-ink-muted">{t("dashboard.noPages")}</p>
                    ) : revision ? (
                      <Badge tone="clarify">{hasStructure ? t("dashboard.noPages") : t("dashboard.structureMissing")}</Badge>
                    ) : (
                      <Badge tone="neutral">{t("dashboard.noRevision")}</Badge>
                    )}
                  </CardBody>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Card aria-labelledby="backup-h" className={reminder.due ? "border-status-clarify/60" : undefined}>
        <CardHeader>
          <div>
            <Eyebrow>{t("backup.title")}</Eyebrow>
            <h2 id="backup-h" className="text-xl">
              {reminder.daysSince === null
                ? t("backup.dueNever")
                : reminder.due
                  ? t("backup.due", { days: reminder.daysSince })
                  : t("backup.ok", { days: reminder.daysSince, reminderDays: EXPORT_REMINDER_DAYS })}
            </h2>
          </div>
          {reminder.due ? <Badge tone="clarify">{t("backup.title")}</Badge> : null}
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">{t("backup.lead")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <a href={`/api/p/${projectId}/export.json`} download className={buttonClass(reminder.due ? "primary" : "secondary", "md", "no-underline")}>
              <Download className="size-5" aria-hidden />
              {t("backup.download")}
            </a>
            <span className="text-xs text-ink-muted">
              {reminder.lastExportAt ? t("backup.last", { date: formatDateTime(reminder.lastExportAt) }) : t("backup.never")} · {t("backup.contains")}
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ value, label, href }: { value: string; label: string; href?: string }) {
  const inner = (
    <div className="flex flex-col">
      <span className="font-display text-2xl font-bold leading-none tabular-nums sm:text-3xl">{value}</span>
      <span className="mt-1 text-[0.7rem] uppercase tracking-wider text-ink-muted">{label}</span>
    </div>
  );
  return href ? (
    <Link href={href} className="no-underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}
