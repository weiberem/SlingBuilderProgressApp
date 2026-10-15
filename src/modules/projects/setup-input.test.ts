import { describe, expect, it } from "vitest";
import { answerSchema, answerState, checkAnswerForDimension, deviationInput, previewInput, saveBuildTypeInput, saveOptionInput } from "./setup-input";

const PID = "01a141a8-ad3e-755b-a733-e4d89c62f5ac";

describe("Onboarding: Eingabe-Validierung (zod)", () => {
  it("akzeptiert genau eine Antwortform, optional mit Bemerkung", () => {
    expect(answerSchema.safeParse({ codes: ["beringer"] }).success).toBe(true);
    expect(answerSchema.safeParse({ codes: ["standard_198", "long_range"], note: "50 L" }).success).toBe(true);
    expect(answerSchema.safeParse({ text: "RS FlightSystems SCU 9iS" }).success).toBe(true);
    expect(answerSchema.safeParse({ bool: false }).success).toBe(true);
    expect(answerSchema.safeParse({ unknown: true }).success).toBe(true);
  });

  it("lehnt leere, doppelte oder fremde Antwortformen ab", () => {
    expect(answerSchema.safeParse({}).success).toBe(false);
    expect(answerSchema.safeParse({ note: "nur Bemerkung" }).success).toBe(false);
    expect(answerSchema.safeParse({ codes: ["a"], text: "b" }).success).toBe(false);
    expect(answerSchema.safeParse({ unknown: false }).success).toBe(false);
    expect(answerSchema.safeParse({ codes: ["a"], extra: 1 }).success).toBe(false);
    expect(answerSchema.safeParse({ codes: ["DROP TABLE"] }).success).toBe(false);
    expect(answerSchema.safeParse({ codes: [""] }).success).toBe(false);
  });

  it("saveOptionInput verlangt UUID-Projekt und gültigen Achsen-Code", () => {
    expect(saveOptionInput.safeParse({ projectId: PID, dimensionCode: "brakes", answer: { codes: ["matco"] } }).success).toBe(true);
    expect(saveOptionInput.safeParse({ projectId: "nope", dimensionCode: "brakes", answer: { codes: ["matco"] } }).success).toBe(false);
    expect(saveOptionInput.safeParse({ projectId: PID, dimensionCode: "Bremsen!", answer: { codes: ["matco"] } }).success).toBe(false);
  });

  it("saveBuildTypeInput kennt nur standard, quick_build, unknown", () => {
    expect(saveBuildTypeInput.safeParse({ projectId: PID, assemblyGroup: "wing", buildType: "quick_build" }).success).toBe(true);
    expect(saveBuildTypeInput.safeParse({ projectId: PID, assemblyGroup: "wing", buildType: "factory" }).success).toBe(false);
  });

  it("previewInput unterscheidet Option und Build-Art", () => {
    expect(previewInput.safeParse({ projectId: PID, change: { kind: "option", dimensionCode: "tanks", answer: { codes: ["long_range"] } } }).success).toBe(true);
    expect(previewInput.safeParse({ projectId: PID, change: { kind: "buildType", assemblyGroup: "fuselage", buildType: "standard" } }).success).toBe(true);
    expect(previewInput.safeParse({ projectId: PID, change: { kind: "other" } }).success).toBe(false);
  });

  it("deviationInput: Titel Pflicht, Status mit Standard «planned»", () => {
    const ok = deviationInput.safeParse({ projectId: PID, title: "  Winglets ", category: "" });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.title).toBe("Winglets");
      expect(ok.data.status).toBe("planned");
    }
    expect(deviationInput.safeParse({ projectId: PID, title: "   " }).success).toBe(false);
    expect(deviationInput.safeParse({ projectId: PID, title: "x", status: "maybe" }).success).toBe(false);
  });
});

describe("checkAnswerForDimension", () => {
  const values = [{ code: "matco" }, { code: "beringer" }];
  it("lehnt unbekannte Codes ab", () => {
    expect(checkAnswerForDimension({ kind: "single" }, values, { codes: ["grove"] })).toEqual({ ok: false, error: "unknown_value" });
    expect(checkAnswerForDimension({ kind: "multi" }, values, { codes: ["matco", "grove"] })).toEqual({ ok: false, error: "unknown_value" });
  });
  it("erlaubt bei single nur einen Wert", () => {
    expect(checkAnswerForDimension({ kind: "single" }, values, { codes: ["matco", "beringer"] })).toEqual({ ok: false, error: "single_value_only" });
    expect(checkAnswerForDimension({ kind: "multi" }, values, { codes: ["matco", "beringer"] })).toEqual({ ok: true });
  });
  it("prüft die Antwortform gegen die Art der Achse", () => {
    expect(checkAnswerForDimension({ kind: "text" }, [], { codes: ["x"] })).toEqual({ ok: false, error: "wrong_kind" });
    expect(checkAnswerForDimension({ kind: "single" }, values, { text: "Beringer" })).toEqual({ ok: false, error: "wrong_kind" });
    expect(checkAnswerForDimension({ kind: "bool" }, [], { bool: true })).toEqual({ ok: true });
    expect(checkAnswerForDimension({ kind: "text" }, [], { text: "SCU 9iS" })).toEqual({ ok: true });
  });
  it("«weiss ich nicht» gilt für jede Achse", () => {
    for (const kind of ["single", "multi", "bool", "text"] as const) expect(checkAnswerForDimension({ kind }, values, { unknown: true })).toEqual({ ok: true });
  });
});

describe("answerState", () => {
  it("unterscheidet fehlend, unbekannt und beantwortet", () => {
    expect(answerState(null)).toBe("missing");
    expect(answerState({ unknown: true })).toBe("unknown");
    expect(answerState({ codes: [] })).toBe("missing");
    expect(answerState({ text: "  " })).toBe("missing");
    expect(answerState({ codes: ["mt"] })).toBe("answered");
    expect(answerState({ bool: false })).toBe("answered");
  });
});
