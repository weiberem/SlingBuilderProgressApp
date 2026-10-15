import type { ComponentProps } from "react";
import { cx } from "@/lib/format";

export type Tone = "neutral" | "red" | "done" | "progress" | "problem" | "na" | "clarify";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-muted border-line",
  red: "bg-brand-red text-on-red border-brand-red",
  done: "bg-status-done-soft text-status-done border-status-done/30",
  progress: "bg-status-progress-soft text-status-progress border-status-progress/30",
  problem: "bg-status-problem-soft text-status-problem border-status-problem/30",
  na: "bg-status-na-soft text-status-na border-status-na/30",
  clarify: "bg-status-clarify-soft text-status-clarify border-status-clarify/30",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}

export const statusTone: Record<string, Tone> = {
  open: "neutral",
  in_progress: "progress",
  done: "done",
  not_applicable: "na",
  problem: "problem",
};
