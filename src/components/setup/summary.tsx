import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { answerState } from "@/modules/projects/setup-input";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/field";
import { formatDate } from "@/lib/format";
import { CompleteButton } from "./complete-button";
import type { BuildTypeDto, DeviationDto, DimensionDto } from "./types";

export type SummaryGroup = { code: string; label: string; dimensions: DimensionDto[] };

/** Text einer Antwort für die Zusammenfassung; null = offen. */
export function answerText(dim: DimensionDto, yesNo: { yes: string; no: string }): string | null {
  const a = dim.answer;
  if (answerState(a) !== "answered" || !a) return null;
  let main = "";
  if (a.codes?.length) main = a.codes.map((c) => dim.values.find((v) => v.code === c)?.label ?? c).join(", ");
  else if (typeof a.bool === "boolean") main = a.bool ? yesNo.yes : yesNo.no;
  else if (a.text) main = a.text;
  return a.note ? `${main} (${a.note})` : main;
}

/** Zusammenfassung aller Antworten; «unbeantwortet» und «weiss ich nicht» sind hervorgehoben. */
export async function SetupSummary({
  projectId,
  basePath,
  groups,
  buildTypes,
  deviations,
  completedAt,
}: {
  projectId: string;
  basePath: string;
  groups: SummaryGroup[];
  buildTypes: BuildTypeDto[];
  deviations: DeviationDto[];
  completedAt: string | null;
}) {
  const t = await getTranslations("setup");
  const openDims = groups.flatMap((g) => g.dimensions).filter((d) => answerState(d.answer) !== "answered").length;
  const openBuild = buildTypes.filter((b) => b.buildType === "unknown").length;
  const open = openDims + openBuild;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">{t("summary.intro")}</p>
      <Notice tone={open === 0 ? "success" : "warn"}>
        <strong>{t("summary.openCount", { count: open })}</strong>
        {open > 0 ? <span className="block">{t("summary.openHint")}</span> : null}
      </Notice>

      <Card>
        <CardHeader>
          <Eyebrow>{t("summary.buildTypes")}</Eyebrow>
          <Link href={`${basePath}?step=build`} className="text-sm font-semibold">
            {t("summary.change")}
          </Link>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {buildTypes.map((b) => (
              <div key={b.group} className="flex flex-wrap items-baseline justify-between gap-2 py-1">
                <dt className="text-sm">{b.label}</dt>
                <dd>{b.buildType === "unknown" ? <Badge tone="clarify">{t("unknown")}</Badge> : <span className="font-semibold">{t(`build.${b.buildType}`)}</span>}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      {groups.map((g) => (
        <Card key={g.code}>
          <CardHeader>
            <Eyebrow>{g.label}</Eyebrow>
            <Link href={`${basePath}?step=${g.code}`} className="text-sm font-semibold">
              {t("summary.change")}
            </Link>
          </CardHeader>
          <CardBody>
            <dl className="flex flex-col">
              {g.dimensions.map((d) => {
                const state = answerState(d.answer);
                return (
                  <div key={d.code} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-2 last:border-0">
                    <dt className="text-sm">
                      {d.label}
                      {d.required ? <span className="text-ink-muted"> *</span> : null}
                    </dt>
                    <dd className="text-right">
                      {state === "answered" ? (
                        <span className="font-semibold">{answerText(d, { yes: t("yes"), no: t("no") })}</span>
                      ) : state === "unknown" ? (
                        <Badge tone="clarify">{t("unknown")}</Badge>
                      ) : (
                        <Badge tone={d.required ? "problem" : "clarify"}>{t("notAnswered")}</Badge>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <Eyebrow>{t("summary.deviations", { count: deviations.length })}</Eyebrow>
          <Link href={`${basePath}?step=deviations`} className="text-sm font-semibold">
            {t("summary.change")}
          </Link>
        </CardHeader>
        {deviations.length ? (
          <CardBody>
            <ul className="flex flex-col gap-1">
              {deviations.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{d.title}</span>
                  <Badge tone="neutral">{t(`deviations.statuses.${d.status}`)}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        ) : null}
      </Card>

      <div className="flex flex-col gap-2">
        {completedAt ? <p className="text-sm text-ink-muted">{t("summary.completedAt", { date: formatDate(completedAt) })}</p> : null}
        <CompleteButton projectId={projectId} alreadyCompleted={!!completedAt} />
      </div>
    </div>
  );
}
