import { describe, expect, it } from "vitest";
import {
  effectiveStatus,
  evaluateExpression,
  pageApplicability,
  triAll,
  triAny,
  triNot,
  type ProjectConfig,
} from "./applicability";
import type { RuleExpression } from "./schema";

const hbYmr: ProjectConfig = {
  options: {
    engine: { codes: ["rotax_916is"] },
    parachute: { codes: ["none"] },
    brakes: { codes: ["beringer"] },
    brake_control: { codes: ["toe_dual"] },
    tanks: { codes: ["standard_198", "long_range"] },
    canopy_version: { unknown: true },
    autopilot_servos: { codes: ["roll", "pitch", "yaw"] },
  },
  buildTypes: { wing: "standard", fuselage: "unknown" },
};

const rule = (expression: RuleExpression, confirmed = true, effect: "applies_only_if" | "qb_prebuilt" = "applies_only_if") => ({
  effect,
  expression,
  confirmed,
  sourceText: null,
});

describe("Kleene-Logik", () => {
  it("not", () => {
    expect(triNot("true")).toBe("false");
    expect(triNot("false")).toBe("true");
    expect(triNot("unknown")).toBe("unknown");
  });
  it("all", () => {
    expect(triAll(["true", "true"])).toBe("true");
    expect(triAll(["true", "unknown"])).toBe("unknown");
    expect(triAll(["false", "unknown"])).toBe("false");
    expect(triAll([])).toBe("true");
  });
  it("any", () => {
    expect(triAny(["false", "true"])).toBe("true");
    expect(triAny(["false", "unknown"])).toBe("unknown");
    expect(triAny(["false", "false"])).toBe("false");
    expect(triAny([])).toBe("false");
  });
});

describe("evaluateExpression", () => {
  it("dim/in mit Einzelwert", () => {
    expect(evaluateExpression({ dim: "brakes", in: ["beringer"] }, hbYmr)).toBe("true");
    expect(evaluateExpression({ dim: "brakes", in: ["matco"] }, hbYmr)).toBe("false");
  });
  it("dim/in mit Mehrfachwert (Tanks)", () => {
    expect(evaluateExpression({ dim: "tanks", in: ["long_range"] }, hbYmr)).toBe("true");
    expect(evaluateExpression({ not: { dim: "tanks", in: ["long_range"] } }, hbYmr)).toBe("false");
  });
  it("dim/eq verlangt genau einen Wert", () => {
    expect(evaluateExpression({ dim: "tanks", eq: "standard_198" }, hbYmr)).toBe("false");
    expect(evaluateExpression({ dim: "brakes", eq: "beringer" }, hbYmr)).toBe("true");
  });
  it("unbekannte Antwort ergibt unknown", () => {
    expect(evaluateExpression({ dim: "canopy_version", in: ["2023"] }, hbYmr)).toBe("unknown");
    expect(evaluateExpression({ dim: "lights", in: ["aveo"] }, hbYmr)).toBe("unknown");
    expect(evaluateExpression({ dim: "canopy_version", isUnknown: true }, hbYmr)).toBe("true");
    expect(evaluateExpression({ dim: "brakes", isUnknown: true }, hbYmr)).toBe("false");
  });
  it("buildType", () => {
    expect(evaluateExpression({ buildType: { group: "wing", eq: "standard" } }, hbYmr)).toBe("true");
    expect(evaluateExpression({ buildType: { group: "wing", eq: "quick_build" } }, hbYmr)).toBe("false");
    expect(evaluateExpression({ buildType: { group: "fuselage", eq: "quick_build" } }, hbYmr)).toBe("unknown");
    expect(evaluateExpression({ buildType: { group: "canopy", eq: "quick_build" } }, hbYmr)).toBe("unknown");
  });
  it("Kombination Beringer + Toe Brakes", () => {
    const expr: RuleExpression = {
      all: [
        { dim: "brakes", in: ["beringer"] },
        { dim: "brake_control", in: ["toe_single", "toe_dual"] },
      ],
    };
    expect(evaluateExpression(expr, hbYmr)).toBe("true");
    expect(
      evaluateExpression(expr, { ...hbYmr, options: { ...hbYmr.options, brake_control: { codes: ["hand"] } } }),
    ).toBe("false");
  });
});

describe("pageApplicability", () => {
  const page = { quickBuild: "none" as const };

  it("ohne Regeln gilt die Seite immer", () => {
    const a = pageApplicability(page, [], hbYmr, "wing");
    expect(a.applies).toBe("true");
    expect(a.needsVariantDecision).toBe(false);
  });

  it("MATCO-Seite fällt für HB-YMR weg", () => {
    const a = pageApplicability(page, [rule({ dim: "brakes", in: ["matco"] })], hbYmr, "undercarriage");
    expect(a.applies).toBe("false");
  });

  it("Canopy-Version bleibt «klären»", () => {
    const a = pageApplicability(page, [rule({ dim: "canopy_version", in: ["2023"] })], hbYmr, "canopy");
    expect(a.applies).toBe("unknown");
    expect(a.needsVariantDecision).toBe(true);
  });

  it("unbestätigte Regel wirkt nicht, markiert aber", () => {
    const a = pageApplicability(page, [rule({ dim: "brakes", in: ["matco"] }, false)], hbYmr, "undercarriage");
    expect(a.applies).toBe("true");
    expect(a.unconfirmedRules).toBe(1);
    expect(a.needsVariantDecision).toBe(true);
  });

  it("Quick Build ab Werk: Baugruppe unbekannt → unknown, standard → false, QB → true", () => {
    const qbPage = { quickBuild: "assembled_by_sling" as const };
    expect(pageApplicability(qbPage, [], hbYmr, "fuselage").qbPrebuilt).toBe("unknown");
    expect(pageApplicability(qbPage, [], hbYmr, "wing").qbPrebuilt).toBe("false");
    const qbCfg: ProjectConfig = { ...hbYmr, buildTypes: { wing: "quick_build" } };
    expect(pageApplicability(qbPage, [], qbCfg, "wing").qbPrebuilt).toBe("true");
    expect(pageApplicability(page, [], qbCfg, "wing").qbPrebuilt).toBe("false");
  });

  it("explizite qb_prebuilt-Regel", () => {
    const r = rule({ buildType: { group: "wing", eq: "quick_build" } }, true, "qb_prebuilt");
    expect(pageApplicability(page, [r], { ...hbYmr, buildTypes: { wing: "quick_build" } }, "wing").qbPrebuilt).toBe(
      "true",
    );
  });
});

describe("effectiveStatus", () => {
  const applies = (v: "true" | "false" | "unknown", needs = v === "unknown") => ({
    applies: v,
    qbPrebuilt: "false" as const,
    unconfirmedRules: 0,
    reasons: [],
    needsVariantDecision: needs,
  });

  it("manueller Status hat Vorrang vor Konfiguration", () => {
    const e = effectiveStatus({ status: "done", naReason: null }, applies("false"));
    expect(e.status).toBe("done");
    expect(e.conflictsWithConfig).toBe(true);
    expect(e.relevant).toBe(true);
  });

  it("ohne manuellen Status: Konfiguration → trifft nicht zu", () => {
    const e = effectiveStatus(null, applies("false"));
    expect(e.status).toBe("not_applicable");
    expect(e.naReason).toBe("config");
    expect(e.relevant).toBe(false);
    expect(e.derived).toBe(true);
  });

  it("unknown bleibt offen und relevant, mit Klärungsbedarf", () => {
    const e = effectiveStatus(null, applies("unknown"));
    expect(e.status).toBe("open");
    expect(e.relevant).toBe(true);
    expect(e.needsVariantDecision).toBe(true);
  });

  it("Quick Build ab Werk → trifft nicht zu (quick_build)", () => {
    const e = effectiveStatus(null, { ...applies("true"), qbPrebuilt: "true" });
    expect(e.status).toBe("not_applicable");
    expect(e.naReason).toBe("quick_build");
  });

  it("manuell trifft nicht zu zählt nicht", () => {
    const e = effectiveStatus({ status: "not_applicable", naReason: "manual" }, applies("true"));
    expect(e.relevant).toBe(false);
    expect(e.naReason).toBe("manual");
  });
});
