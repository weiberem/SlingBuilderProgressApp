import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { getProjectContext } from "@/modules/projects/context";
import { listTaskCategories, listTasks } from "@/modules/progress/tasks-service";
import { Card, CardBody, Eyebrow } from "@/components/ui/card";
import { FilterChips } from "@/components/tasks/filter-chips";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import { parseTaskFilter, type TaskDto } from "@/components/tasks/types";

export const metadata = { title: "Zusatzarbeiten" };

/** Zusatzarbeiten: Filter (URL), Erfassung oben, Liste nach Bereich gruppiert. */
export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ projectId }, sp] = await Promise.all([params, searchParams]);
  const filter = parseTaskFilter(sp.filter);
  const ctx = await getProjectContext(projectId);
  const [all, categories, t] = await Promise.all([listTasks(ctx, "all"), listTaskCategories(ctx), getTranslations("tasks")]);
  const openCount = all.filter((x) => !x.done).length;
  const counts = { all: all.length, open: openCount, done: all.length - openCount };
  const tasks: TaskDto[] = all
    .filter((x) => (filter === "all" ? true : filter === "done" ? x.done : !x.done))
    .map((x) => ({
      id: x.id,
      title: x.title,
      category: x.category,
      note: x.note,
      dueDate: x.dueDate,
      done: x.done,
      doneAt: x.doneAt,
      origin: x.origin,
      pageId: x.pageId,
      pageRef: x.pageRef,
    }));
  const base = `/p/${projectId}/tasks`;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <Eyebrow>{t("openCount", { count: openCount })}</Eyebrow>
        <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
      </header>

      <Card>
        <details className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 font-semibold select-none [&::-webkit-details-marker]:hidden">
            <Plus className="size-5 transition-transform group-open:rotate-45" aria-hidden />
            {t("form.newTitle")}
          </summary>
          <CardBody className="border-t border-line pt-4">
            <TaskForm projectId={projectId} categories={categories} renderDatalist={false} />
          </CardBody>
        </details>
      </Card>

      <FilterChips basePath={base} active={filter} counts={counts} />

      <TaskList projectId={projectId} tasks={tasks} categories={categories} filter={filter} />
    </div>
  );
}
