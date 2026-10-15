import type { CSSProperties } from "react";
import type { StatusKind } from "@/modules/manuals/applicability";

/** Farben der Seiten-Chips und Status-Buttons (Tokens aus src/styles/tokens.css). */
export const chipTone: Record<StatusKind, string> = {
  open: "bg-bg text-ink border-line-strong",
  in_progress: "bg-status-progress-soft text-status-progress border-status-progress",
  done: "bg-status-done text-white border-status-done",
  not_applicable: "bg-status-na-soft text-status-na border-status-na/60 line-through decoration-2",
  problem: "bg-status-problem-soft text-status-problem border-status-problem",
};

/** Grosse Status-Buttons (Bottom-Sheet, Seitendetail): nicht gewählt / gewählt. */
export const statusButtonTone: Record<StatusKind, { idle: string; active: string }> = {
  open: { idle: "border-line bg-bg text-ink", active: "border-ink bg-surface-2 text-ink" },
  in_progress: { idle: "border-line bg-bg text-status-progress", active: "border-status-progress bg-status-progress-soft text-status-progress" },
  done: { idle: "border-line bg-bg text-status-done", active: "border-status-done bg-status-done text-white" },
  not_applicable: { idle: "border-line bg-bg text-status-na", active: "border-status-na bg-status-na-soft text-status-na" },
  problem: { idle: "border-line bg-bg text-status-problem", active: "border-status-problem bg-status-problem-soft text-status-problem" },
};

export const STATUS_ORDER: StatusKind[] = ["open", "in_progress", "done", "not_applicable", "problem"];

/** Tipp-Zyklus wie im Prototyp: offen → erledigt → trifft nicht zu (manuell) → offen. */
export function nextStatusOnTap(current: StatusKind): StatusKind {
  switch (current) {
    case "done":
      return "not_applicable";
    case "not_applicable":
      return "open";
    default:
      return "done";
  }
}

/** Schraffur für Seiten, die laut Konfiguration/Quick Build nicht zutreffen. */
export const hatchedStyle: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--status-na) 22%, transparent) 6px 8px)",
};
