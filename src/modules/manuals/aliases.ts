import type { Alias } from "./schema";

/**
 * Alias-Engine: Begriffs-Normalisierung beim Rendern. Das Original bleibt gespeichert und
 * wird als Tooltip gezeigt («im Handbuch: 915 iS»). Jede Regel hat Geltungsbereich und Begründung.
 */
export type AliasScope = { modelId: string; manualId: string; revisionId: string };

export type AliasRule = Pick<
  Alias,
  "id" | "scopeModelId" | "scopeManualId" | "scopeRevisionId" | "kind" | "matchText" | "isRegex" | "replacement" | "rationale" | "active" | "sortOrder"
>;

/** Wählt die Regeln, die für Modell/Handbuch/Revision gelten, und sortiert spezifische zuerst. */
export function selectAliases(all: AliasRule[], scope: AliasScope): AliasRule[] {
  const specificity = (a: AliasRule) => (a.scopeRevisionId ? 3 : a.scopeManualId ? 2 : a.scopeModelId ? 1 : 0);
  return all
    .filter((a) => a.active)
    .filter((a) => !a.scopeModelId || a.scopeModelId === scope.modelId)
    .filter((a) => !a.scopeManualId || a.scopeManualId === scope.manualId)
    .filter((a) => !a.scopeRevisionId || a.scopeRevisionId === scope.revisionId)
    .sort((a, b) => specificity(b) - specificity(a) || a.sortOrder - b.sortOrder);
}

export type AppliedAlias = { aliasId: string; original: string; replacement: string; rationale: string };

export type AliasResult = {
  display: string;
  changed: boolean;
  applied: AppliedAlias[];
  /** Platzhalter, die nicht gefüllt werden konnten (z. B. `{project.engine}` ohne Antwort). */
  unresolved: string[];
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Passt die Gross-/Kleinschreibung der Ersetzung an den gefundenen Text an. */
function matchCase(found: string, replacement: string): string {
  const hasLetters = found !== found.toLowerCase() || found !== found.toUpperCase();
  if (!hasLetters) return replacement;
  if (found === found.toUpperCase()) return replacement.toUpperCase();
  if (found === found.toLowerCase()) return replacement.toLowerCase();
  if (found[0] === found[0].toUpperCase() && found.slice(1) === found.slice(1).toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
  }
  return replacement;
}

function fillPlaceholders(template: string, vars: Record<string, string | undefined>, unresolved: string[]): string | null {
  let ok = true;
  const out = template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_m, key: string) => {
    const v = vars[key];
    if (v === undefined || v === "") {
      ok = false;
      unresolved.push(key);
      return "";
    }
    return v;
  });
  return ok ? out : null;
}

/**
 * Wendet die (bereits per `selectAliases` gewählten) Regeln auf einen Text an.
 * Regeln mit nicht füllbaren Platzhaltern werden übersprungen (Original bleibt stehen).
 */
export function applyAliases(
  text: string,
  rules: AliasRule[],
  vars: Record<string, string | undefined> = {},
): AliasResult {
  let display = text;
  const applied: AppliedAlias[] = [];
  const unresolved: string[] = [];
  for (const rule of rules) {
    const pattern = rule.isRegex ? rule.matchText : `\\b${escapeRegex(rule.matchText)}\\b`;
    let re: RegExp;
    try {
      re = new RegExp(pattern, "gi");
    } catch {
      continue;
    }
    if (!re.test(display)) continue;
    const replacement = fillPlaceholders(rule.replacement, vars, unresolved);
    if (replacement === null) continue;
    re.lastIndex = 0;
    display = display.replace(re, (found) => {
      applied.push({ aliasId: rule.id, original: found, replacement, rationale: rule.rationale });
      return rule.isRegex ? replacement : matchCase(found, replacement);
    });
  }
  return { display, changed: display !== text, applied, unresolved: [...new Set(unresolved)] };
}
