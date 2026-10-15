"use client";

import Link from "next/link";
import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, CalendarDays, Check, Pencil, Trash2 } from "lucide-react";
import { deleteTaskAction, toggleTaskDoneAction, updateTaskAction, type TaskActionError, type TaskActionResult } from "@/modules/progress/task-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Textarea } from "@/components/ui/field";
import { cx, formatDate, todayIso } from "@/lib/format";
import { pageHref } from "./page-href";
import { CategoryDatalist } from "./task-form";
import type { TaskDto, TaskFilter } from "./types";

type Patch = { type: "done"; id: string; done: boolean } | { type: "remove"; id: string };

function applyPatch(state: TaskDto[], patch: Patch): TaskDto[] {
  if (patch.type === "remove") return state.filter((t) => t.id !== patch.id);
  return state.map((t) => (t.id === patch.id ? { ...t, done: patch.done, doneAt: patch.done ? todayIso() : null } : t));
}

/** Gruppen alphabetisch (de), «Ohne Bereich» zuletzt. Reihenfolge innerhalb der Gruppe bleibt (Service). */
function groupByCategory(tasks: TaskDto[]): { key: string; category: string | null; tasks: TaskDto[] }[] {
  const map = new Map<string, TaskDto[]>();
  for (const t of tasks) {
    const k = t.category ?? "";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "de")))
    .map(([k, list]) => ({ key: k || "__none", category: k || null, tasks: list }));
}

const DATALIST_ID = "task-categories";

export function TaskList({ projectId, tasks, categories, filter }: { projectId: string; tasks: TaskDto[]; categories: string[]; filter: TaskFilter }) {
  const t = useTranslations("tasks");
  const [optimistic, apply] = useOptimistic<TaskDto[], Patch>(tasks, applyPatch);
  const [error, setError] = useState<TaskActionError | null>(null);
  const [, startTransition] = useTransition();
  const today = todayIso();

  const toggle = (task: TaskDto) => {
    setError(null);
    startTransition(async () => {
      apply({ type: "done", id: task.id, done: !task.done });
      const r = await toggleTaskDoneAction({ projectId, id: task.id, done: !task.done });
      if (!r.ok) setError(r.error);
    });
  };
  const remove = (task: TaskDto) => {
    setError(null);
    startTransition(async () => {
      apply({ type: "remove", id: task.id });
      const r = await deleteTaskAction({ projectId, id: task.id });
      if (!r.ok) setError(r.error);
    });
  };

  const groups = groupByCategory(optimistic);

  return (
    <div className="flex flex-col gap-5">
      <CategoryDatalist id={DATALIST_ID} categories={categories} />
      {error ? <Notice tone="error">{t(`errors.${error}`)}</Notice> : null}
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-ink-muted">{t(`empty.${filter}`)}</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-labelledby={`cat-${g.key}`} className="flex flex-col gap-2">
            <h2 id={`cat-${g.key}`} className="flex items-baseline justify-between gap-2 text-lg">
              <span className={cx(!g.category && "text-ink-muted")}>{g.category ?? t("noCategory")}</span>
              <span className="whitespace-nowrap text-xs font-normal text-ink-muted">{t("groupCount", { count: g.tasks.length })}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {g.tasks.map((task) => (
                <TaskItem key={task.id} task={task} projectId={projectId} today={today} onToggle={() => toggle(task)} onDelete={() => remove(task)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function TaskItem({ task, projectId, today, onToggle, onDelete }: { task: TaskDto; projectId: string; today: string; onToggle: () => void; onDelete: () => void }) {
  const t = useTranslations("tasks");
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const overdue = !task.done && !!task.dueDate && task.dueDate < today;

  return (
    <li className={cx("flex gap-3 rounded-lg border border-line bg-surface p-3 shadow-[var(--shadow-1)]", task.done && "opacity-75")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? t("item.markOpen", { title: task.title }) : t("item.markDone", { title: task.title })}
        onClick={onToggle}
        className={cx(
          "flex size-12 shrink-0 items-center justify-center rounded border-2 transition-colors",
          task.done ? "border-status-done bg-status-done text-white" : "border-line-strong bg-bg hover:border-ink",
        )}
      >
        {task.done ? <Check className="size-7" aria-hidden strokeWidth={3} /> : null}
      </button>

      {editing ? (
        <EditForm task={task} projectId={projectId} onClose={() => setEditing(false)} />
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className={cx("text-base font-semibold leading-snug", task.done && "line-through decoration-ink-muted")}>{task.title}</p>
          {task.note ? <p className="whitespace-pre-wrap text-sm text-ink-muted">{task.note}</p> : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {task.dueDate ? (
              <Badge tone={overdue ? "problem" : task.done ? "neutral" : "progress"}>
                <CalendarDays className="size-3.5" aria-hidden />
                {overdue ? t("item.overdue", { date: formatDate(task.dueDate) }) : t("item.due", { date: formatDate(task.dueDate) })}
              </Badge>
            ) : null}
            {task.done && task.doneAt ? <span className="text-xs text-ink-muted">{t("item.doneAt", { date: formatDate(task.doneAt) })}</span> : null}
            {task.pageRef && task.pageId ? (
              <Link href={pageHref(projectId, task.pageRef.manualCode, task.pageId)} className="inline-flex min-h-12 items-center gap-1 font-semibold">
                <BookOpen className="size-4" aria-hidden />
                {t("item.page", { manual: task.pageRef.manualTitle, page: task.pageRef.pageNumber })}
              </Link>
            ) : null}
            {task.origin !== "manual" ? <span className="text-xs text-ink-muted">{t(`item.origin.${task.origin === "ticket" ? "ticket" : "import"}`)}</span> : null}
          </div>
          <div className="-ml-3 flex flex-wrap items-center gap-1">
            {confirming ? (
              <>
                <span className="ml-3 flex min-h-12 items-center text-sm font-semibold">{t("item.confirmDelete")}</span>
                <Button variant="danger" size="sm" className="min-h-12" onClick={onDelete}>
                  {t("item.confirmYes")}
                </Button>
                <Button variant="ghost" size="sm" className="min-h-12" onClick={() => setConfirming(false)}>
                  {t("form.cancel")}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="min-h-12" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" aria-hidden />
                  {t("item.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-12 min-w-12 text-ink-muted"
                  onClick={() => setConfirming(true)}
                  aria-label={`${t("item.delete")}: ${task.title}`}
                >
                  <Trash2 className="size-5" aria-hidden />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/** Inline-Bearbeitung: Titel, Bereich, Notiz, Fälligkeit. Die Seitenverknüpfung bleibt erhalten. */
function EditForm({ task, projectId, onClose }: { task: TaskDto; projectId: string; onClose: () => void }) {
  const t = useTranslations("tasks");
  const [state, action, pending] = useActionState<TaskActionResult | null, FormData>(updateTaskAction, null);
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <form action={action} className="flex min-w-0 flex-1 flex-col gap-3" aria-label={t("item.edit")}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="id" value={task.id} />
      {state && !state.ok ? <Notice tone="error">{t(`errors.${state.error}`)}</Notice> : null}
      <Field label={t("form.title")}>
        <Input name="title" defaultValue={task.title} required maxLength={200} autoFocus autoComplete="off" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("form.category")}>
          <Input name="category" defaultValue={task.category ?? ""} list={DATALIST_ID} maxLength={100} autoComplete="off" />
        </Field>
        <Field label={t("form.dueDate")}>
          <Input name="dueDate" type="date" defaultValue={task.dueDate ?? ""} />
        </Field>
      </div>
      <Field label={t("form.note")}>
        <Textarea name="note" defaultValue={task.note ?? ""} maxLength={4000} rows={3} />
      </Field>
      {task.pageRef ? <p className="text-xs text-ink-muted">{t("form.pageLinkKept")}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {t("form.save")}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          {t("form.cancel")}
        </Button>
      </div>
    </form>
  );
}
