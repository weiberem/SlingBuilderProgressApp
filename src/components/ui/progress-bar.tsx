import { cx } from "@/lib/format";

/** Fortschrittsbalken: erledigt (grün) und in Arbeit (blau) über der Basis der zutreffenden Seiten. */
export function ProgressBar({
  done,
  inProgress = 0,
  total,
  className,
  height = "h-2",
}: {
  done: number;
  inProgress?: number;
  total: number;
  className?: string;
  height?: string;
}) {
  const pctDone = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const pctProgress = total > 0 ? Math.min(100 - pctDone, (inProgress / total) * 100) : 0;
  return (
    <div
      className={cx("w-full overflow-hidden rounded-full bg-line", height, className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      <div className="flex h-full">
        <div className="h-full bg-status-done transition-[width]" style={{ width: `${pctDone}%` }} />
        <div className="h-full bg-status-progress transition-[width]" style={{ width: `${pctProgress}%` }} />
      </div>
    </div>
  );
}
