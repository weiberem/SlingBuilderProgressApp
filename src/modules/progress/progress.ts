import type { EffectiveStatus } from "@/modules/manuals/applicability";

/** Fortschritt, gerechnet nur über die zutreffenden Seiten. */
export type ProgressSummary = {
  /** Zutreffende Seiten (Basis). */
  relevant: number;
  done: number;
  inProgress: number;
  problem: number;
  open: number;
  /** Nicht zutreffend (manuell, Konfiguration, Quick Build). */
  notApplicable: number;
  /** Seiten, deren Variante noch zu klären ist. */
  needsVariantDecision: number;
  /** Seiten mit manuellem Status, der der Konfiguration widerspricht. */
  conflictsWithConfig: number;
  /** 0–100, gerundet. */
  percent: number;
};

export function summarizeProgress(statuses: EffectiveStatus[]): ProgressSummary {
  const s: ProgressSummary = {
    relevant: 0,
    done: 0,
    inProgress: 0,
    problem: 0,
    open: 0,
    notApplicable: 0,
    needsVariantDecision: 0,
    conflictsWithConfig: 0,
    percent: 0,
  };
  for (const e of statuses) {
    if (e.needsVariantDecision) s.needsVariantDecision++;
    if (e.conflictsWithConfig) s.conflictsWithConfig++;
    if (!e.relevant) {
      s.notApplicable++;
      continue;
    }
    s.relevant++;
    switch (e.status) {
      case "done":
        s.done++;
        break;
      case "in_progress":
        s.inProgress++;
        break;
      case "problem":
        s.problem++;
        break;
      default:
        s.open++;
    }
  }
  s.percent = s.relevant === 0 ? 0 : Math.round((s.done / s.relevant) * 100);
  return s;
}

export function mergeProgress(parts: ProgressSummary[]): ProgressSummary {
  const total = parts.reduce(
    (acc, p) => ({
      relevant: acc.relevant + p.relevant,
      done: acc.done + p.done,
      inProgress: acc.inProgress + p.inProgress,
      problem: acc.problem + p.problem,
      open: acc.open + p.open,
      notApplicable: acc.notApplicable + p.notApplicable,
      needsVariantDecision: acc.needsVariantDecision + p.needsVariantDecision,
      conflictsWithConfig: acc.conflictsWithConfig + p.conflictsWithConfig,
      percent: 0,
    }),
    {
      relevant: 0,
      done: 0,
      inProgress: 0,
      problem: 0,
      open: 0,
      notApplicable: 0,
      needsVariantDecision: 0,
      conflictsWithConfig: 0,
      percent: 0,
    },
  );
  total.percent = total.relevant === 0 ? 0 : Math.round((total.done / total.relevant) * 100);
  return total;
}
