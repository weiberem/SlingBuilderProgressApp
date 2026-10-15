import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Database } from "lucide-react";
import { getProjectContext } from "@/modules/projects/context";
import { getManualView } from "@/modules/progress/service";
import { toManualViewDto } from "@/modules/progress/view-dto";
import { buttonClass } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/field";
import { ManualViewClient } from "@/components/progress/manual-view";
import { RevisionHints } from "@/components/progress/revision-hints";

type Params = Promise<{ projectId: string; manualCode: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { projectId, manualCode } = await params;
  const ctx = await getProjectContext(projectId);
  const view = await getManualView(ctx, manualCode);
  return { title: view?.manual.title ?? manualCode };
}

/** Handbuch-Ansicht: Kopf, Hinweise zur Revision, ein Block pro Abschnitt mit Seiten-Chips (Client, offline-fähig). */
export default async function ManualPage({ params }: { params: Params }) {
  const { projectId, manualCode } = await params;
  const ctx = await getProjectContext(projectId);
  const [view, t] = await Promise.all([getManualView(ctx, manualCode), getTranslations("manual")]);

  if (!view) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink projectId={projectId} label={t("backToDashboard")} />
        <h1 className="text-3xl">{t("noRevision.title")}</h1>
        <p className="text-ink-muted">{t("noRevision.text")}</p>
      </div>
    );
  }

  if (!view.hasStructure) {
    const rev = view.revision;
    return (
      <div className="flex flex-col gap-4">
        <BackLink projectId={projectId} label={t("backToDashboard")} />
        <div>
          <Eyebrow>
            {view.manual.docNumber ? <span className="font-mono">{view.manual.docNumber} · </span> : null}
            {t("revision", { revision: rev.revision })}
            {rev.revisionDate ? ` · ${rev.revisionDate}` : rev.coverLabel ? ` · ${rev.coverLabel}` : ""}
          </Eyebrow>
          <h1 className="text-4xl">{view.manual.title}</h1>
        </div>
        <Notice tone="warn">
          <p className="font-semibold">{t("noStructure.title")}</p>
          <p>{t("noStructure.text")}</p>
          <p className="mt-1">{t("noStructure.adminHint")}</p>
        </Notice>
        {ctx.isPlatformAdmin ? (
          <Link href="/admin/manuals" className={buttonClass("secondary", "md", "self-start no-underline")}>
            <Database className="size-5" aria-hidden />
            {t("noStructure.adminLink")}
          </Link>
        ) : null}
        <RevisionHints report={rev.importReport} revisionNote={rev.notes} defaultOpen />
      </div>
    );
  }

  return <ManualViewClient projectId={projectId} initial={toManualViewDto(view)} />;
}

function BackLink({ projectId, label }: { projectId: string; label: string }) {
  return (
    <Link href={`/p/${projectId}`} className="inline-flex min-h-10 items-center gap-1 self-start text-sm text-ink-muted no-underline">
      <ArrowLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
