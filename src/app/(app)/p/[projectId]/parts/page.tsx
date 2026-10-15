import { getTranslations } from "next-intl/server";
import { Download, Plus } from "lucide-react";
import { getProjectContext } from "@/modules/projects/context";
import { getPageRef, listMissingParts } from "@/modules/progress/tasks-service";
import { Card, CardBody, Eyebrow } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { PartForm } from "@/components/tasks/part-form";
import { PartsList } from "@/components/tasks/parts-list";
import type { PartDto } from "@/components/tasks/types";

export const metadata = { title: "Fehlteile" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fehlteile: Erfassung (optional mit Seite via `?pageId=`), Liste je Handbuch, CSV-Export. */
export default async function PartsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ projectId }, sp] = await Promise.all([params, searchParams]);
  const rawPageId = Array.isArray(sp.pageId) ? sp.pageId[0] : sp.pageId;
  const ctx = await getProjectContext(projectId);
  const [rows, pageRef, t] = await Promise.all([
    listMissingParts(ctx),
    rawPageId && UUID.test(rawPageId) ? getPageRef(ctx, rawPageId) : Promise.resolve(null),
    getTranslations("parts"),
  ]);
  const parts: PartDto[] = rows.map((r) => ({
    id: r.id,
    pageId: r.pageId,
    position: r.position,
    partNumber: r.partNumber,
    description: r.description,
    quantity: r.quantity,
    unit: r.unit,
    status: r.status,
    note: r.note,
    pageNumber: r.pageNumber,
    manualTitle: r.manualTitle,
    manualCode: r.manualCode,
  }));
  const needed = parts.filter((p) => p.status === "needed").length;
  const formOpen = !!rawPageId || parts.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>{t("summary", { needed, total: parts.length })}</Eyebrow>
          <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
        </div>
        <a href={`/api/p/${projectId}/parts.csv`} download className={buttonClass("secondary", "md", "no-underline")} title={t("exportHint")}>
          <Download className="size-5" aria-hidden />
          {t("export")}
        </a>
      </header>

      <Card>
        <details className="group" open={formOpen}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 font-semibold select-none [&::-webkit-details-marker]:hidden">
            <Plus className="size-5 transition-transform group-open:rotate-45" aria-hidden />
            {t("form.newTitle")}
          </summary>
          <CardBody className="border-t border-line pt-4">
            <PartForm projectId={projectId} pageRef={pageRef} pageMissing={!!rawPageId && !pageRef} />
          </CardBody>
        </details>
      </Card>

      <PartsList projectId={projectId} parts={parts} />
    </div>
  );
}
