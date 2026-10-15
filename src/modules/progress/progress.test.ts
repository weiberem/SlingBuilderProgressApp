import { describe, expect, it } from "vitest";
import { mergeProgress, summarizeProgress } from "./progress";
import type { EffectiveStatus } from "@/modules/manuals/applicability";

const st = (status: EffectiveStatus["status"], extra: Partial<EffectiveStatus> = {}): EffectiveStatus => ({
  status,
  naReason: status === "not_applicable" ? "manual" : null,
  derived: false,
  conflictsWithConfig: false,
  relevant: status !== "not_applicable",
  needsVariantDecision: false,
  ...extra,
});

describe("summarizeProgress", () => {
  it("rechnet nur über zutreffende Seiten", () => {
    const s = summarizeProgress([st("done"), st("done"), st("open"), st("not_applicable"), st("in_progress"), st("problem")]);
    expect(s.relevant).toBe(5);
    expect(s.done).toBe(2);
    expect(s.notApplicable).toBe(1);
    expect(s.inProgress).toBe(1);
    expect(s.problem).toBe(1);
    expect(s.open).toBe(1);
    expect(s.percent).toBe(40);
  });

  it("leer → 0 %", () => {
    expect(summarizeProgress([]).percent).toBe(0);
  });

  it("zählt Klärungsbedarf und Konflikte", () => {
    const s = summarizeProgress([
      st("open", { needsVariantDecision: true }),
      st("done", { conflictsWithConfig: true }),
    ]);
    expect(s.needsVariantDecision).toBe(1);
    expect(s.conflictsWithConfig).toBe(1);
  });

  it("merge", () => {
    const a = summarizeProgress([st("done"), st("open")]);
    const b = summarizeProgress([st("done"), st("done")]);
    const m = mergeProgress([a, b]);
    expect(m.relevant).toBe(4);
    expect(m.done).toBe(3);
    expect(m.percent).toBe(75);
  });
});
