import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { getProjectContext } from "@/modules/projects/context";
import { getPageRef, listTaskCategories } from "@/modules/progress/tasks-service";
import { Card, CardBody, Eyebrow } from "@/components/ui/card";
import { TaskForm } from "@/components/tasks/task-form";

export const metadata = { title: "Neue Zusatzarbeit" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Eigene Route zum Anlegen, z. B. aus der Seitenansicht heraus (`?pageId=…` verknüpft die Seite). */
export default async function NewTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ projectId }, sp] = await Promise.all([params, searchParams]);
  const rawPageId = Array.isArray(sp.pageId) ? sp.pageId[0] : sp.pageId;
  const ctx = await getProjectContext(projectId);
  const [categories, pageRef, t] = await Promise.all([
    listTaskCategories(ctx),
    rawPageId && UUID.test(rawPageId) ? getPageRef(ctx, rawPageId) : Promise.resolve(null),
    getTranslations("tasks"),
  ]);
  const base = `/p/${projectId}/tasks`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link href={base} className="inline-flex min-h-12 items-center gap-1 self-start text-sm font-semibold">
          <ArrowLeft className="size-4" aria-hidden />
          {t("new.back")}
        </Link>
        <div>
          {pageRef ? <Eyebrow>{t("new.forPage")}</Eyebrow> : null}
          <h1 className="text-3xl sm:text-4xl">{t("new.title")}</h1>
        </div>
      </header>
      <Card>
        <CardBody className="pt-4">
          <TaskForm projectId={projectId} categories={categories} pageRef={pageRef} pageMissing={!!rawPageId && !pageRef} redirectTo={base} autoFocus />
        </CardBody>
      </Card>
    </div>
  );
}
