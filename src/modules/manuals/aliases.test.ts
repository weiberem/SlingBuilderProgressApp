import { describe, expect, it } from "vitest";
import { applyAliases, selectAliases, type AliasRule } from "./aliases";

const base = {
  isRegex: false,
  active: true,
  sortOrder: 0,
  scopeModelId: null,
  scopeManualId: null,
  scopeRevisionId: null,
  rationale: "Test",
};

const rules: AliasRule[] = [
  { ...base, id: "a1", kind: "typo", matchText: "WIING", replacement: "WING" },
  { ...base, id: "a2", kind: "typo", matchText: "Horisontal", replacement: "Horizontal" },
  { ...base, id: "a3", kind: "engine", matchText: "915 iS", replacement: "{project.engine}", rationale: "Motor laut Projekt" },
  { ...base, id: "a4", kind: "term", matchText: "915 / 916", replacement: "{project.engine}" },
  { ...base, id: "a5", kind: "term", matchText: "Blakes", replacement: "Brakes" },
];

describe("applyAliases", () => {
  it("korrigiert Tippfehler und behält Schreibweise", () => {
    expect(applyAliases("WIING ASSEMBLY 2", rules).display).toBe("WING ASSEMBLY 2");
    expect(applyAliases("Horisontal Stabilizer", rules).display).toBe("Horizontal Stabilizer");
    expect(applyAliases("HORISONTAL STABILIZER", rules).display).toBe("HORIZONTAL STABILIZER");
    expect(applyAliases("toe blakes", rules).display).toBe("toe brakes");
  });

  it("ersetzt Motorbezeichnung aus der Projektkonfiguration und meldet Original", () => {
    const r = applyAliases("Rotax 915 iS Installation", rules, { "project.engine": "916 iS" });
    expect(r.display).toBe("Rotax 916 iS Installation");
    expect(r.applied[0]).toMatchObject({ original: "915 iS", replacement: "916 iS" });
  });

  it("lässt den Text stehen, wenn der Platzhalter nicht gefüllt werden kann", () => {
    const r = applyAliases("Rotax 915 iS Installation", rules, {});
    expect(r.display).toBe("Rotax 915 iS Installation");
    expect(r.changed).toBe(false);
    expect(r.unresolved).toEqual(["project.engine"]);
  });

  it("ändert nichts ohne Treffer", () => {
    const r = applyAliases("Rudder Assembly", rules);
    expect(r.changed).toBe(false);
    expect(r.applied).toHaveLength(0);
  });

  it("matcht nur ganze Wörter", () => {
    expect(applyAliases("SWIING", rules).display).toBe("SWIING");
  });
});

describe("selectAliases", () => {
  const scoped: AliasRule[] = [
    { ...base, id: "g", kind: "term", matchText: "x", replacement: "global" },
    { ...base, id: "m", kind: "term", matchText: "x", replacement: "model", scopeModelId: "M1" },
    { ...base, id: "h", kind: "term", matchText: "x", replacement: "manual", scopeManualId: "H1" },
    { ...base, id: "r", kind: "term", matchText: "x", replacement: "revision", scopeRevisionId: "R1" },
    { ...base, id: "other", kind: "term", matchText: "x", replacement: "other", scopeManualId: "H2" },
    { ...base, id: "off", kind: "term", matchText: "x", replacement: "off", active: false },
  ];

  it("filtert nach Geltungsbereich und sortiert spezifische zuerst", () => {
    const sel = selectAliases(scoped, { modelId: "M1", manualId: "H1", revisionId: "R1" });
    expect(sel.map((a) => a.id)).toEqual(["r", "h", "m", "g"]);
  });

  it("die spezifischste Regel gewinnt", () => {
    const sel = selectAliases(scoped, { modelId: "M1", manualId: "H1", revisionId: "R1" });
    expect(applyAliases("x", sel).display).toBe("revision");
  });
});
