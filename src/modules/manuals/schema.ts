import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { i18nText, id, timestamps } from "../../db/columns";
import { users } from "../auth/schema";

export const manualKind = pgEnum("manual_kind", ["kai", "intro", "supplement"]);
export const revisionStatus = pgEnum("revision_status", ["draft", "in_review", "released"]);
export const quickBuildKind = pgEnum("quick_build_kind", [
  "none",
  "assembled_by_sling",
  "jig_not_applicable",
]);
export const ruleTargetType = pgEnum("rule_target_type", ["page", "section"]);
export const ruleEffect = pgEnum("rule_effect", ["applies_only_if", "qb_prebuilt"]);
export const aliasKind = pgEnum("alias_kind", ["typo", "term", "engine", "type_header"]);
export const dimensionKind = pgEnum("dimension_kind", ["single", "multi", "bool", "text"]);

/** Flugzeugmodelle (Sling 4 TSi, Sling 2, …). Weitere Modelle sind nur Daten. */
export const aircraftModels = pgTable("aircraft_models", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  manufacturer: text("manufacturer").notNull().default("Sling Aircraft"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

/** Baugruppen eines Modells (für Build-Art je Baugruppe und Gruppierung). */
export const assemblyGroups = pgTable(
  "assembly_groups",
  {
    id: id(),
    aircraftModelId: uuid("aircraft_model_id")
      .notNull()
      .references(() => aircraftModels.id),
    code: text("code").notNull(),
    label: i18nText("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("assembly_groups_model_code_uq").on(t.aircraftModelId, t.code)],
);

/** Gruppen des Onboarding-Wizards (Motor, Bremsen, Avionik …). */
export const optionGroups = pgTable(
  "option_groups",
  {
    id: id(),
    aircraftModelId: uuid("aircraft_model_id")
      .notNull()
      .references(() => aircraftModels.id),
    code: text("code").notNull(),
    label: i18nText("label").notNull(),
    help: i18nText("help"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("option_groups_model_code_uq").on(t.aircraftModelId, t.code)],
);

/** Ein Handbuch (z. B. «Fuselage KAI»), stabil über alle Revisionen. */
export const manuals = pgTable(
  "manuals",
  {
    id: id(),
    aircraftModelId: uuid("aircraft_model_id")
      .notNull()
      .references(() => aircraftModels.id),
    /** Stabiler Code, z. B. `fuselage`. */
    code: text("code").notNull(),
    /** Dokumentnummer laut Sling, z. B. `DC-KAI-003-X-F`. Null = im Dokument nicht angegeben. */
    docNumber: text("doc_number"),
    title: text("title").notNull(),
    /** Baugruppe für Build-Art (Standard/Quick Build), z. B. `fuselage`. */
    assemblyGroup: text("assembly_group").notNull(),
    kind: manualKind("kind").notNull().default("kai"),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [uniqueIndex("manuals_model_code_uq").on(t.aircraftModelId, t.code)],
);

/** Eine Revision eines Handbuchs. Nur `released` ist für Builder sichtbar. */
export const manualRevisions = pgTable(
  "manual_revisions",
  {
    id: id(),
    manualId: uuid("manual_id")
      .notNull()
      .references(() => manuals.id),
    /** Revisionsbezeichnung wie auf dem Deckblatt, z. B. `8.5`, `7`, `0`. */
    revision: text("revision").notNull(),
    revisionDate: date("revision_date"),
    /** Freitext vom Deckblatt, wenn kein exaktes Datum, z. B. «Mai 2026». */
    coverLabel: text("cover_label"),
    /** SHA-256 der Quelldatei. Null, solange nur aus Stammdaten erfasst. */
    sourceHash: text("source_hash"),
    sourceName: text("source_name"),
    sourceSize: bigint("source_size", { mode: "number" }),
    status: revisionStatus("status").notNull().default("draft"),
    /** Anzahl Bauseiten laut Zeichnungsköpfen. Null = noch nicht erfasst (z. B. OCR nötig). */
    pageCount: integer("page_count"),
    /** Konflikte und Hinweise aus der Aufbereitung (Inhaltsverzeichnis vs. Zeichnungsköpfe usw.). */
    importReport: jsonb("import_report").$type<ImportReport>().notNull().default({ notes: [], conflicts: [] }),
    notes: text("notes"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: uuid("released_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("manual_revisions_manual_rev_uq").on(t.manualId, t.revision)],
);

export type ImportReport = {
  notes: { code: string; text: string; pages?: number[] }[];
  conflicts: { code: string; text: string; pages?: number[]; resolved?: boolean }[];
};

/** Abschnitt (Seitenbereich) einer Revision, z. B. «Elevator Assembly», S. 7–17. */
export const sections = pgTable(
  "sections",
  {
    id: id(),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => manualRevisions.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    /** Titel wie im Handbuch (Original, nie normalisiert). */
    titleOriginal: text("title_original").notNull(),
    /** Ergänzung für die Anzeige, z. B. «Türfenster», ohne das Original zu verändern. */
    titleNote: text("title_note"),
    pageFrom: integer("page_from").notNull(),
    pageTo: integer("page_to").notNull(),
    drawingNumber: text("drawing_number"),
    drawingRevision: text("drawing_revision"),
    /** Seite(n) ohne Titel im Inhaltsverzeichnis. */
    isUntitled: boolean("is_untitled").notNull().default(false),
    flags: jsonb("flags").$type<StructureFlags>().notNull().default({}),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("sections_revision_idx").on(t.revisionId)],
);

/** Eine Bauseite, identifiziert über die Seitennummer im Zeichnungskopf («PAGE n»). */
export const pages = pgTable(
  "pages",
  {
    id: id(),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => manualRevisions.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    /** Seitentitel aus dem Zeichnungskopf, falls abweichend vom Abschnitt. */
    titleOriginal: text("title_original"),
    drawingNumber: text("drawing_number"),
    drawingRevision: text("drawing_revision"),
    quickBuild: quickBuildKind("quick_build").notNull().default("none"),
    /** Herkunft des QB-Hinweises: `page_note`, `toc`, `brief` (aus dem Auftrag), `conflict`. */
    quickBuildSource: text("quick_build_source"),
    flags: jsonb("flags").$type<StructureFlags>().notNull().default({}),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("pages_revision_page_uq").on(t.revisionId, t.pageNumber),
    index("pages_section_idx").on(t.sectionId),
  ],
);

export type StructureFlags = {
  /** Inhaltsverzeichnis und Zeichnungskopf widersprechen sich. */
  tocMismatch?: boolean;
  /** Seite fehlt im Inhaltsverzeichnis. */
  missingInToc?: boolean;
  /** Zeichnungskopf trägt einen anderen Flugzeugtyp (Dublette/Schreibfehler), nicht filtern. */
  typeHeaderMismatch?: string;
  /** Varianten-Hinweis aus Titel/Notiz, der (noch) keine Regel ist. */
  variantNote?: string;
  /** QB-Hinweis widerspricht sich zwischen Inhaltsverzeichnis und Seite. */
  qbConflict?: string;
  /** Zeichnung enthält keinen lesbaren Text (nur Positionsnummern). */
  noText?: boolean;
};

/** Konfigurationsachse des Onboardings, z. B. `brakes`. */
export const optionDimensions = pgTable(
  "option_dimensions",
  {
    id: id(),
    aircraftModelId: uuid("aircraft_model_id")
      .notNull()
      .references(() => aircraftModels.id),
    code: text("code").notNull(),
    kind: dimensionKind("kind").notNull(),
    label: i18nText("label").notNull(),
    help: i18nText("help"),
    /** Gruppe im Wizard, z. B. `engine`, `brakes`, `avionics`. */
    groupCode: text("group_code").notNull().default("general"),
    sortOrder: integer("sort_order").notNull().default(0),
    required: boolean("required").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("option_dimensions_model_code_uq").on(t.aircraftModelId, t.code)],
);

/** Möglicher Wert einer Achse, z. B. `beringer`. */
export const optionValues = pgTable(
  "option_values",
  {
    id: id(),
    dimensionId: uuid("dimension_id")
      .notNull()
      .references(() => optionDimensions.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: i18nText("label").notNull(),
    help: i18nText("help"),
    /** Text für Alias-Platzhalter, z. B. `{project.engine}` → «916 iS». */
    aliasValue: text("alias_value"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("option_values_dimension_code_uq").on(t.dimensionId, t.code)],
);

/**
 * Regel: Eine Seite/ein Abschnitt gilt nur bei bestimmten Optionen (`applies_only_if`)
 * oder ist bei Quick Build ab Werk erledigt (`qb_prebuilt`). Unbestätigte Regeln wirken nicht,
 * sie markieren die Seite als «Variante klären».
 */
export const applicabilityRules = pgTable(
  "applicability_rules",
  {
    id: id(),
    targetType: ruleTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    effect: ruleEffect("effect").notNull().default("applies_only_if"),
    expression: jsonb("expression").$type<RuleExpression>().notNull(),
    /** Originaltext aus dem Handbuch, der die Regel begründet («Long Range», «Beringer»). */
    sourceText: text("source_text"),
    rationale: text("rationale"),
    confirmed: boolean("confirmed").notNull().default(false),
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** Stabiler Schlüssel für Regeln aus den Seed-Daten (idempotenter Seed). */
    seedKey: text("seed_key").unique(),
    ...timestamps,
  },
  (t) => [index("applicability_rules_target_idx").on(t.targetType, t.targetId)],
);

/** Ausdrucks-AST der Applicability-Engine (dreiwertig: true/false/unknown). */
export type RuleExpression =
  | { all: RuleExpression[] }
  | { any: RuleExpression[] }
  | { not: RuleExpression }
  | { dim: string; in: string[] }
  | { dim: string; eq: string }
  | { dim: string; isUnknown: true }
  | { buildType: { group: string; eq: "standard" | "quick_build" } };

/** Begriffs-Normalisierung mit Geltungsbereich und Begründung. Nichts davon steht im Code. */
export const aliases = pgTable(
  "aliases",
  {
    id: id(),
    scopeModelId: uuid("scope_model_id").references(() => aircraftModels.id),
    scopeManualId: uuid("scope_manual_id").references(() => manuals.id),
    scopeRevisionId: uuid("scope_revision_id").references(() => manualRevisions.id),
    kind: aliasKind("kind").notNull(),
    matchText: text("match_text").notNull(),
    isRegex: boolean("is_regex").notNull().default(false),
    /** Ersetzung; darf Platzhalter wie `{project.engine}` enthalten. */
    replacement: text("replacement").notNull(),
    rationale: text("rationale").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Stabiler Schlüssel für Aliase aus den Seed-Daten (idempotenter Seed). */
    seedKey: text("seed_key").unique(),
    ...timestamps,
  },
  (t) => [index("aliases_scope_idx").on(t.scopeModelId, t.scopeManualId, t.scopeRevisionId)],
);

export type AircraftModel = typeof aircraftModels.$inferSelect;
export type AssemblyGroup = typeof assemblyGroups.$inferSelect;
export type OptionGroup = typeof optionGroups.$inferSelect;
export type Manual = typeof manuals.$inferSelect;
export type ManualRevision = typeof manualRevisions.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type OptionDimension = typeof optionDimensions.$inferSelect;
export type OptionValue = typeof optionValues.$inferSelect;
export type ApplicabilityRule = typeof applicabilityRules.$inferSelect;
export type Alias = typeof aliases.$inferSelect;
