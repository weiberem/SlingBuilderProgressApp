import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cx } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";

export type WizardStep = { code: string; label: string; open: number };

/** Schrittanzeige: jeder Schritt direkt anwählbar (Chips mindestens 48 px), aktueller Schritt mit aria-current. */
export async function StepIndicator({ steps, current, basePath }: { steps: WizardStep[]; current: string; basePath: string }) {
  const t = await getTranslations("setup");
  const idx = steps.findIndex((s) => s.code === current);
  return (
    <nav aria-label={t("steps")} className="flex flex-col gap-2">
      <p className="text-sm text-ink-muted">{t("stepOf", { current: idx + 1, total: steps.length })}</p>
      <ol className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
        {steps.map((s, i) => {
          const active = s.code === current;
          return (
            <li key={s.code} className="shrink-0">
              <Link
                href={`${basePath}?step=${s.code}`}
                aria-current={active ? "step" : undefined}
                className={cx(
                  "touch flex items-center gap-2 rounded border px-3 text-sm font-semibold no-underline",
                  active ? "border-brand-red bg-brand-red text-on-red" : "border-line bg-surface text-ink",
                )}
              >
                <span
                  className={cx(
                    "flex size-6 items-center justify-center rounded-full text-xs",
                    active ? "bg-white/20" : s.open === 0 ? "bg-status-done-soft text-status-done" : "bg-status-clarify-soft text-status-clarify",
                  )}
                  aria-hidden
                >
                  {s.open === 0 && !active ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                {s.label}
                {s.open > 0 ? <span className="sr-only">({s.open})</span> : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export async function StepFooter({ steps, current, basePath, projectPath }: { steps: WizardStep[]; current: string; basePath: string; projectPath: string }) {
  const t = await getTranslations("setup");
  const idx = steps.findIndex((s) => s.code === current);
  const prev = idx > 0 ? steps[idx - 1] : null;
  const next = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
      {prev ? (
        <ButtonLink href={`${basePath}?step=${prev.code}`} variant="secondary" size="lg">
          <ArrowLeft className="size-5" aria-hidden />
          {t("back")}
        </ButtonLink>
      ) : (
        <ButtonLink href={projectPath} variant="secondary" size="lg">
          <ArrowLeft className="size-5" aria-hidden />
          {t("backToDashboard")}
        </ButtonLink>
      )}
      {next ? (
        <ButtonLink href={`${basePath}?step=${next.code}`} size="lg">
          {next.code === "summary" ? t("toSummary") : t("next")}
          <ArrowRight className="size-5" aria-hidden />
        </ButtonLink>
      ) : null}
    </div>
  );
}
