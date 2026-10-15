import type { ApplicabilityRule, RuleExpression } from "./schema";
import type { OptionAnswer } from "@/modules/projects/schema";

/**
 * Applicability-Engine: entscheidet mit dreiwertiger Logik (Kleene), ob eine Seite
 * für die Projektkonfiguration gilt. «unknown» heisst: Antwort fehlt oder «weiss ich nicht»;
 * die Seite bleibt dann sichtbar und wird als «Variante klären» markiert.
 */
export type Tri = "true" | "false" | "unknown";

export type BuildTypeValue = "standard" | "quick_build" | "unknown";

export type ProjectConfig = {
  /** Antworten je Achsen-Code, z. B. `brakes` → `{codes: ["beringer"]}`. */
  options: Record<string, OptionAnswer | undefined>;
  /** Build-Art je Baugruppe, z. B. `fuselage` → `quick_build`. */
  buildTypes: Record<string, BuildTypeValue | undefined>;
};

export function triNot(v: Tri): Tri {
  if (v === "true") return "false";
  if (v === "false") return "true";
  return "unknown";
}

export function triAll(values: Tri[]): Tri {
  if (values.some((v) => v === "false")) return "false";
  if (values.some((v) => v === "unknown")) return "unknown";
  return "true";
}

export function triAny(values: Tri[]): Tri {
  if (values.some((v) => v === "true")) return "true";
  if (values.some((v) => v === "unknown")) return "unknown";
  return "false";
}

function answerCodes(answer: OptionAnswer | undefined): string[] | "unknown" {
  if (!answer || answer.unknown) return "unknown";
  if (answer.codes && answer.codes.length > 0) return answer.codes;
  if (typeof answer.bool === "boolean") return [answer.bool ? "yes" : "no"];
  if (typeof answer.text === "string" && answer.text.trim() !== "") return [answer.text.trim()];
  return "unknown";
}

/** Wertet einen Regel-Ausdruck gegen die Projektkonfiguration aus. */
export function evaluateExpression(expr: RuleExpression, cfg: ProjectConfig): Tri {
  if ("all" in expr) return triAll(expr.all.map((e) => evaluateExpression(e, cfg)));
  if ("any" in expr) return triAny(expr.any.map((e) => evaluateExpression(e, cfg)));
  if ("not" in expr) return triNot(evaluateExpression(expr.not, cfg));
  if ("buildType" in expr) {
    const bt = cfg.buildTypes[expr.buildType.group];
    if (!bt || bt === "unknown") return "unknown";
    return bt === expr.buildType.eq ? "true" : "false";
  }
  const codes = answerCodes(cfg.options[expr.dim]);
  if ("isUnknown" in expr) return codes === "unknown" ? "true" : "false";
  if (codes === "unknown") return "unknown";
  if ("in" in expr) return codes.some((c) => expr.in.includes(c)) ? "true" : "false";
  if ("eq" in expr) return codes.length === 1 && codes[0] === expr.eq ? "true" : "false";
  return "unknown";
}

export type PageLike = {
  quickBuild: "none" | "assembled_by_sling" | "jig_not_applicable";
};

export type PageApplicability = {
  /** Gilt die Seite laut bestätigten Regeln? */
  applies: Tri;
  /** Ist der Schritt bei Quick Build ab Werk erledigt? */
  qbPrebuilt: Tri;
  /** Anzahl unbestätigter Regeln (Vorschläge aus dem Import). */
  unconfirmedRules: number;
  /** Lesbare Begründungen (Quelltexte der wirksamen Regeln). */
  reasons: string[];
  /** Seite ist sichtbar, braucht aber eine Klärung der Variante. */
  needsVariantDecision: boolean;
};

/**
 * Kombiniert die Regeln einer Seite und ihres Abschnitts.
 * Vorrang des manuellen Status wird nicht hier, sondern in `effectiveStatus` entschieden.
 */
export function pageApplicability(
  page: PageLike,
  rules: Pick<ApplicabilityRule, "effect" | "expression" | "confirmed" | "sourceText">[],
  cfg: ProjectConfig,
  assemblyGroup: string,
): PageApplicability {
  const confirmed = rules.filter((r) => r.confirmed);
  const unconfirmedRules = rules.length - confirmed.length;

  const appliesRules = confirmed.filter((r) => r.effect === "applies_only_if");
  const applies = appliesRules.length === 0 ? "true" : triAll(appliesRules.map((r) => evaluateExpression(r.expression, cfg)));

  const qbRules = confirmed.filter((r) => r.effect === "qb_prebuilt");
  let qbPrebuilt: Tri = "false";
  if (page.quickBuild === "assembled_by_sling") {
    const bt = cfg.buildTypes[assemblyGroup];
    qbPrebuilt = !bt || bt === "unknown" ? "unknown" : bt === "quick_build" ? "true" : "false";
  }
  if (qbRules.length > 0) {
    qbPrebuilt = triAny([qbPrebuilt, ...qbRules.map((r) => evaluateExpression(r.expression, cfg))]);
  }

  const reasons = confirmed.map((r) => r.sourceText).filter((s): s is string => !!s);
  const needsVariantDecision = applies === "unknown" || unconfirmedRules > 0 || qbPrebuilt === "unknown";

  return { applies, qbPrebuilt, unconfirmedRules, reasons, needsVariantDecision };
}

export type StatusKind = "open" | "in_progress" | "done" | "not_applicable" | "problem";
export type NaReason = "manual" | "config" | "quick_build";

export type EffectiveStatus = {
  status: StatusKind;
  naReason: NaReason | null;
  /** Der Status kommt aus der Konfiguration, nicht vom Builder. */
  derived: boolean;
  /** Manuell gesetzt, obwohl die Konfiguration «trifft nicht zu» ergibt. */
  conflictsWithConfig: boolean;
  /** Zählt zur Basis des Fortschritts (zutreffende Seiten). */
  relevant: boolean;
  needsVariantDecision: boolean;
};

/**
 * Vorrang: manueller Status > Konfiguration > Vorschlag.
 * Ohne manuellen Status: laut Regeln nicht zutreffend → `not_applicable/config`,
 * bei Quick Build ab Werk erledigt → `not_applicable/quick_build`, sonst `open`.
 */
export function effectiveStatus(
  manual: { status: StatusKind; naReason: NaReason | null } | null | undefined,
  applicability: PageApplicability,
): EffectiveStatus {
  const configSaysNa = applicability.applies === "false";
  if (manual) {
    const relevant = manual.status !== "not_applicable";
    return {
      status: manual.status,
      naReason: manual.status === "not_applicable" ? (manual.naReason ?? "manual") : null,
      derived: false,
      conflictsWithConfig: configSaysNa && manual.status !== "not_applicable",
      relevant,
      needsVariantDecision: relevant && applicability.needsVariantDecision,
    };
  }
  if (configSaysNa) {
    return {
      status: "not_applicable",
      naReason: "config",
      derived: true,
      conflictsWithConfig: false,
      relevant: false,
      needsVariantDecision: false,
    };
  }
  if (applicability.qbPrebuilt === "true") {
    return {
      status: "not_applicable",
      naReason: "quick_build",
      derived: true,
      conflictsWithConfig: false,
      relevant: false,
      needsVariantDecision: false,
    };
  }
  return {
    status: "open",
    naReason: null,
    derived: true,
    conflictsWithConfig: false,
    relevant: true,
    needsVariantDecision: applicability.needsVariantDecision,
  };
}
