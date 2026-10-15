import { getTranslations } from "next-intl/server";
import { getProjectContext } from "@/modules/projects/context";
import { getWizardData } from "@/modules/projects/service";
import { answerState } from "@/modules/projects/setup-input";
import { BuildTypeForm } from "@/components/setup/build-type-form";
import { DeviationsEditor } from "@/components/setup/deviations-editor";
import { DimensionForm } from "@/components/setup/dimension-form";
import { StepFooter, StepIndicator, type WizardStep } from "@/components/setup/step-nav";
import { SetupSummary, type SummaryGroup } from "@/components/setup/summary";
import type { BuildTypeDto, DeviationDto, DimensionDto } from "@/components/setup/types";
import { Notice } from "@/components/ui/field";

export const metadata = { title: "Konfiguration" };

const SUMMARY = "summary";

/**
 * Onboarding / Konfiguration: ein Schritt pro Optionsgruppe (aus den Stammdaten), direkt anwählbar
 * über `?step=<groupCode>`, zum Schluss die Zusammenfassung mit «Konfiguration abschliessen».
 */
export default async function SetupPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ step?: string }> }) {
  const [{ projectId }, { step }] = await Promise.all([params, searchParams]);
  const ctx = await getProjectContext(projectId);
  const [data, t] = await Promise.all([getWizardData(ctx), getTranslations("setup")]);
  const basePath = `/p/${projectId}/setup`;

  const groups: SummaryGroup[] = data.groups
    .filter((g) => g.code !== "build" && g.code !== "deviations")
    .map((g) => ({
      code: g.code,
      label: g.label.de,
      dimensions: g.dimensions.map(
        (d): DimensionDto => ({
          id: d.id,
          code: d.code,
          kind: d.kind,
          label: d.label.de,
          help: d.help?.de ?? null,
          required: d.required,
          values: d.values.map((v) => ({ code: v.code, label: v.label.de, help: v.help?.de ?? null })),
          answer: d.answer,
        }),
      ),
    }));
  const buildTypes: BuildTypeDto[] = data.buildTypes.map((b) => ({ group: b.group.code, label: b.group.label.de, buildType: b.buildType }));
  const deviations: DeviationDto[] = data.deviations.map((d) => ({ id: d.id, title: d.title, description: d.description, category: d.category, status: d.status }));
  const groupHelp = new Map(data.groups.map((g) => [g.code, g.help?.de ?? null]));

  const steps: WizardStep[] = data.groups.map((g) => ({
    code: g.code,
    label: g.label.de,
    open:
      g.code === "build"
        ? buildTypes.filter((b) => b.buildType === "unknown").length
        : g.code === "deviations"
          ? 0
          : g.dimensions.filter((d) => answerState(d.answer) !== "answered").length,
  }));
  steps.push({ code: SUMMARY, label: t("summaryStep"), open: 0 });

  const current = steps.some((s) => s.code === step) ? (step as string) : steps[0].code;
  const group = groups.find((g) => g.code === current);
  const currentLabel = steps.find((s) => s.code === current)?.label ?? "";
  const help = current === "build" || current === "deviations" ? null : groupHelp.get(current);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl">{t("title")}</h1>
        {current === steps[0].code ? <p className="text-sm text-ink-muted">{t("intro")}</p> : null}
      </header>
      <StepIndicator steps={steps} current={current} basePath={basePath} />

      <section aria-labelledby="step-h" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="step-h" className="text-2xl">
            {currentLabel}
          </h2>
          {help ? <p className="text-sm text-ink-muted">{help}</p> : null}
        </div>

        {current === "build" ? (
          <>
            <p className="text-sm text-ink-muted">{t("build.intro")}</p>
            <Notice tone={buildTypes.some((b) => b.buildType === "unknown") ? "warn" : "success"}>
              {t("build.unknownAll", { count: buildTypes.filter((b) => b.buildType === "unknown").length })}
            </Notice>
            {buildTypes.map((b) => (
              <BuildTypeForm key={b.group} projectId={projectId} item={b} />
            ))}
          </>
        ) : current === "deviations" ? (
          <>
            <p className="text-sm text-ink-muted">{t("deviations.intro")}</p>
            <DeviationsEditor projectId={projectId} deviations={deviations} />
          </>
        ) : current === SUMMARY ? (
          <SetupSummary projectId={projectId} basePath={basePath} groups={groups} buildTypes={buildTypes} deviations={deviations} completedAt={data.project.settings.onboardingCompletedAt ?? null} />
        ) : group ? (
          group.dimensions.length ? (
            group.dimensions.map((d) => <DimensionForm key={d.id} projectId={projectId} dimension={d} />)
          ) : (
            <p className="text-sm text-ink-muted">{t("noValue")}</p>
          )
        ) : null}
      </section>

      <StepFooter steps={steps} current={current} basePath={basePath} projectPath={`/p/${projectId}`} />
    </div>
  );
}
