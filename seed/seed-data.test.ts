import { describe, expect, it } from "vitest";
import { hbYmr } from "./hb-ymr/project";
import { sling4Tsi } from "./sling-4-tsi";
import type { RuleExpression } from "@/modules/manuals/schema";

/**
 * Plausibilitätsprüfung der Seed-Daten: lückenlose Seitenbereiche, konsistente Seitenzahlen,
 * eindeutige Regel-Schlüssel, nur bekannte Achsen und Werte in Regeln und Projektantworten.
 */

function collectDims(expr: RuleExpression, out: { dim: string; codes: string[] }[]) {
  if ("all" in expr) expr.all.forEach((e) => collectDims(e, out));
  else if ("any" in expr) expr.any.forEach((e) => collectDims(e, out));
  else if ("not" in expr) collectDims(expr.not, out);
  else if ("buildType" in expr) out.push({ dim: `buildType:${expr.buildType.group}`, codes: [] });
  else if ("in" in expr) out.push({ dim: expr.dim, codes: expr.in });
  else if ("eq" in expr) out.push({ dim: expr.dim, codes: [expr.eq] });
  else out.push({ dim: expr.dim, codes: [] });
}

const valueCodes = new Map(sling4Tsi.optionDimensions.map((d) => [d.code, new Set((d.values ?? []).map((v) => v.code))]));
const groupCodes = new Set(sling4Tsi.assemblyGroups.map((g) => g.code));

describe("Seed Sling 4 TSi: Handbücher", () => {
  const keys: string[] = [];

  for (const m of sling4Tsi.manuals) {
    for (const r of m.revisions) {
      if (!r.sections) continue;
      it(`${m.code} Rev ${r.revision}: Seiten 1–${r.pageCount} lückenlos und ohne Überschneidung`, () => {
        let expected = 1;
        for (const s of r.sections!) {
          expect(s.from, `${s.title} beginnt bei ${s.from}, erwartet ${expected}`).toBe(expected);
          expect(s.to).toBeGreaterThanOrEqual(s.from);
          expected = s.to + 1;
          for (const n of Object.keys(s.pages ?? {}).map(Number)) {
            expect(n).toBeGreaterThanOrEqual(s.from);
            expect(n).toBeLessThanOrEqual(s.to);
          }
        }
        expect(expected - 1).toBe(r.pageCount);
      });

      it(`${m.code} Rev ${r.revision}: Regeln referenzieren bekannte Achsen und Werte`, () => {
        for (const s of r.sections!) {
          const rules = [...(s.rules ?? []), ...Object.values(s.pages ?? {}).flatMap((p) => p.rules ?? [])];
          for (const rule of rules) {
            keys.push(rule.key);
            const refs: { dim: string; codes: string[] }[] = [];
            collectDims(rule.expression, refs);
            for (const ref of refs) {
              if (ref.dim.startsWith("buildType:")) {
                expect(groupCodes.has(ref.dim.slice("buildType:".length))).toBe(true);
                continue;
              }
              expect(valueCodes.has(ref.dim), `Achse ${ref.dim} unbekannt (${rule.key})`).toBe(true);
              for (const c of ref.codes) {
                expect(valueCodes.get(ref.dim)!.has(c), `Wert ${ref.dim}=${c} unbekannt (${rule.key})`).toBe(true);
              }
            }
          }
        }
      });
    }
    it(`${m.code}: Baugruppe bekannt`, () => {
      expect(m.assemblyGroup === "general" || groupCodes.has(m.assemblyGroup)).toBe(true);
    });
  }

  it("Regel-Schlüssel sind eindeutig", () => {
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("Alias-Schlüssel sind eindeutig und Scopes existieren", () => {
    const ks = sling4Tsi.aliases.map((a) => a.key);
    expect(new Set(ks).size).toBe(ks.length);
    for (const a of sling4Tsi.aliases) {
      if (a.scopeManualCode) expect(sling4Tsi.manuals.some((m) => m.code === a.scopeManualCode)).toBe(true);
    }
  });

  it("Erwartung aus dem Auftrag: Long-Range-Seiten 18, 31, 33, 43–49, 53 im Wing Rev 7", () => {
    const wing = sling4Tsi.manuals.find((m) => m.code === "wing")!.revisions.find((r) => r.revision === "7")!;
    const lrPages = new Set<number>();
    for (const s of wing.sections!) {
      const isLr = (rule: { expression: RuleExpression; confirmed: boolean }) =>
        rule.confirmed && JSON.stringify(rule.expression) === JSON.stringify({ dim: "tanks", in: ["long_range"] });
      if ((s.rules ?? []).some(isLr)) for (let n = s.from; n <= s.to; n++) lrPages.add(n);
      for (const [n, p] of Object.entries(s.pages ?? {})) if ((p.rules ?? []).some(isLr)) lrPages.add(Number(n));
    }
    expect([...lrPages].sort((a, b) => a - b)).toEqual([18, 31, 33, 43, 44, 45, 46, 47, 48, 49, 53]);
  });
});

describe("Seed HB-YMR", () => {
  it("Antworten referenzieren bekannte Achsen und Werte", () => {
    for (const [code, answer] of Object.entries(hbYmr.options)) {
      expect(valueCodes.has(code), `Achse ${code}`).toBe(true);
      for (const c of answer.codes ?? []) expect(valueCodes.get(code)!.has(c), `${code}=${c}`).toBe(true);
    }
  });
  it("Build-Arten decken alle Baugruppen ab", () => {
    expect(Object.keys(hbYmr.buildTypes).sort()).toEqual([...groupCodes].sort());
  });
  it("Pflichtachsen sind beantwortet oder bewusst offen", () => {
    for (const d of sling4Tsi.optionDimensions.filter((d) => d.required)) {
      expect(hbYmr.options[d.code], `Achse ${d.code} fehlt im Projekt-Seed`).toBeDefined();
    }
  });
});
