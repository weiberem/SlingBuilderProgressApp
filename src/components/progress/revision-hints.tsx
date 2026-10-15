import { useTranslations } from "next-intl";
import { AlertTriangle, Info } from "lucide-react";
import type { ImportReport } from "@/modules/manuals/schema";
import { Badge } from "@/components/ui/badge";

/** Hinweise und Konflikte aus der Aufbereitung einer Revision, einklappbar (native <details>, ohne JS). */
export function RevisionHints({ report, revisionNote, defaultOpen }: { report: ImportReport; revisionNote: string | null; defaultOpen?: boolean }) {
  const t = useTranslations("manual.hints");
  const count = report.notes.length + report.conflicts.length + (revisionNote ? 1 : 0);
  if (count === 0) return null;
  return (
    <details className="group rounded-lg border border-line bg-surface" open={defaultOpen}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-2 font-semibold select-none [&::-webkit-details-marker]:hidden">
        <Info className="size-5 shrink-0 text-ink-muted" aria-hidden />
        <span>{t("title")}</span>
        <Badge tone={report.conflicts.some((c) => !c.resolved) ? "clarify" : "neutral"} className="ml-auto">
          {count}
        </Badge>
      </summary>
      <div className="flex flex-col gap-3 border-t border-line px-4 py-3 text-sm">
        {revisionNote ? (
          <div>
            <p className="eyebrow mb-1">{t("revisionNote")}</p>
            <p>{revisionNote}</p>
          </div>
        ) : null}
        {report.conflicts.length ? (
          <div>
            <p className="eyebrow mb-1">{t("conflicts")}</p>
            <ul className="flex flex-col gap-2">
              {report.conflicts.map((c, i) => (
                <li key={`${c.code}-${i}`} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-clarify" aria-hidden />
                  <span>
                    {c.text}
                    {c.pages?.length ? <span className="text-ink-muted"> · {t("pages", { pages: c.pages.join(", ") })}</span> : null}{" "}
                    <Badge tone={c.resolved ? "done" : "clarify"}>{c.resolved ? t("resolved") : t("open")}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {report.notes.length ? (
          <div>
            <p className="eyebrow mb-1">{t("notes")}</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {report.notes.map((n, i) => (
                <li key={`${n.code}-${i}`}>
                  {n.text}
                  {n.pages?.length ? <span className="text-ink-muted"> · {t("pages", { pages: n.pages.join(", ") })}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}
