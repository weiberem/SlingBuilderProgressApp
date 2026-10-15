import type { I18nText } from "@/db/columns";
import type { RuleExpression, StructureFlags } from "@/modules/manuals/schema";

/**
 * Typen der Seed-Daten. Alles Projekt- und Modellspezifische steht in Daten, nicht im Code.
 */

export type SeedRule = {
  /** Stabiler Schlüssel (idempotent), z. B. `wing-7:p18:long-range`. */
  key: string;
  expression: RuleExpression;
  effect?: "applies_only_if" | "qb_prebuilt";
  /** Originaltext aus dem Handbuch bzw. Auftrag. */
  sourceText: string;
  rationale?: string;
  /** Unbestätigte Regeln wirken nicht, sie markieren nur «Variante klären». */
  confirmed: boolean;
};

export type SeedPageOverride = {
  title?: string;
  drawingNumber?: string;
  quickBuild?: "none" | "assembled_by_sling" | "jig_not_applicable";
  quickBuildSource?: string;
  flags?: StructureFlags;
  notes?: string;
  rules?: SeedRule[];
};

export type SeedSection = {
  title: string;
  from: number;
  to: number;
  titleNote?: string;
  untitled?: boolean;
  drawingNumber?: string;
  flags?: StructureFlags;
  notes?: string;
  rules?: SeedRule[];
  /** Überschreibungen je Seitennummer. */
  pages?: Record<number, SeedPageOverride>;
  /** Für alle Seiten des Abschnitts. */
  allPages?: Omit<SeedPageOverride, "rules" | "title" | "drawingNumber">;
};

export type SeedRevision = {
  revision: string;
  revisionDate?: string;
  coverLabel?: string;
  status: "draft" | "in_review" | "released";
  sourceName?: string;
  sourceSize?: number;
  pageCount?: number;
  notes?: string;
  importReport?: { notes?: { code: string; text: string; pages?: number[] }[]; conflicts?: { code: string; text: string; pages?: number[] }[] };
  sections?: SeedSection[];
};

export type SeedManual = {
  code: string;
  docNumber: string | null;
  title: string;
  assemblyGroup: string;
  kind?: "kai" | "intro" | "supplement";
  sortOrder: number;
  notes?: string;
  revisions: SeedRevision[];
};

export type SeedAssemblyGroup = { code: string; label: I18nText; sortOrder: number };

export type SeedOptionValue = { code: string; label: I18nText; help?: I18nText; aliasValue?: string; sortOrder?: number };

export type SeedOptionDimension = {
  code: string;
  kind: "single" | "multi" | "bool" | "text";
  label: I18nText;
  help?: I18nText;
  groupCode: string;
  sortOrder: number;
  required?: boolean;
  values?: SeedOptionValue[];
};

export type SeedOptionGroup = { code: string; label: I18nText; sortOrder: number; help?: I18nText };

export type SeedAlias = {
  key: string;
  kind: "typo" | "term" | "engine" | "type_header";
  matchText: string;
  isRegex?: boolean;
  replacement: string;
  rationale: string;
  /** Geltungsbereich: Handbuch-Code oder Revision; leer = ganzes Modell. */
  scopeManualCode?: string;
  scopeRevision?: string;
  sortOrder?: number;
};

export type SeedAircraftModel = {
  code: string;
  name: string;
  manufacturer: string;
  assemblyGroups: SeedAssemblyGroup[];
  optionGroups: SeedOptionGroup[];
  optionDimensions: SeedOptionDimension[];
  manuals: SeedManual[];
  aliases: SeedAlias[];
};

export type SeedProject = {
  modelCode: string;
  registration: string;
  kitNumber: string;
  name: string;
  /** Antworten je Achsen-Code. */
  options: Record<string, { codes?: string[]; text?: string; bool?: boolean; unknown?: boolean; note?: string }>;
  buildTypes: Record<string, "standard" | "quick_build" | "unknown">;
  deviations: { title: string; description?: string; category?: string; status?: "planned" | "in_progress" | "done" }[];
};
