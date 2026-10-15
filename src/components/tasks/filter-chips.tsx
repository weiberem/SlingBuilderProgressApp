import Link from "next/link";
import { useTranslations } from "next-intl";
import { cx } from "@/lib/format";
import { TASK_FILTERS, type TaskFilter } from "./types";

/** Filter «Offen / Alle / Erledigt» als Links (URL-Parameter `filter`), 56 px hoch, tastaturbedienbar. */
export function FilterChips({ basePath, active, counts }: { basePath: string; active: TaskFilter; counts?: Partial<Record<TaskFilter, number>> }) {
  const t = useTranslations("tasks.filter");
  return (
    <nav aria-label={t("label")}>
      <ul className="flex gap-2">
        {TASK_FILTERS.map((f) => {
          const isActive = f === active;
          const n = counts?.[f];
          return (
            <li key={f} className="flex-1 sm:flex-none">
              <Link
                href={f === "open" ? basePath : `${basePath}?filter=${f}`}
                aria-current={isActive ? "page" : undefined}
                className={cx(
                  "flex min-h-14 items-center justify-center gap-2 rounded border px-4 font-semibold no-underline transition-colors",
                  isActive ? "border-brand-black bg-brand-black text-brand-white" : "border-line bg-surface text-ink hover:border-line-strong",
                )}
              >
                {t(f)}
                {n !== undefined ? <span className={cx("rounded px-1.5 text-xs tabular-nums", isActive ? "bg-white/20" : "bg-surface-2 text-ink-muted")}>{n}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
