import {
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
import { id, timestamps } from "../../db/columns";
import { users } from "../auth/schema";
import { aircraftModels, manualRevisions, manuals, optionDimensions } from "../manuals/schema";

export const memberRole = pgEnum("member_role", ["owner", "co_builder", "advisor", "viewer"]);
export const buildType = pgEnum("build_type", ["standard", "quick_build", "unknown"]);
export const deviationStatus = pgEnum("deviation_status", ["planned", "in_progress", "done", "dropped"]);

/** Ein Projekt = ein Flugzeug. */
export const projects = pgTable("projects", {
  id: id(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id),
  aircraftModelId: uuid("aircraft_model_id")
    .notNull()
    .references(() => aircraftModels.id),
  registration: text("registration").notNull(),
  kitNumber: text("kit_number"),
  name: text("name").notNull(),
  /** Geplante BAZL-Endabnahme; Basis für EAS-Fristen (M5). */
  plannedInspectionDate: date("planned_inspection_date"),
  settings: jsonb("settings").$type<ProjectSettings>().notNull().default({}),
  ...timestamps,
});

export type ProjectSettings = {
  /** Onboarding abgeschlossen? */
  onboardingCompletedAt?: string;
  /** Letzter JSON-Export (Datensicherung durch den Erbauer); Basis für die Erinnerung. */
  lastExportAt?: string;
};

/** Mitgliedschaften. Phase 1: nur der Owner. Rollen-UI kommt später. */
export const projectMembers = pgTable(
  "project_members",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("project_members_project_user_uq").on(t.projectId, t.userId)],
);

/** Antwort des Onboardings je Achse. «weiss ich nicht» = `{unknown: true}`. */
export const projectOptions = pgTable(
  "project_options",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    dimensionId: uuid("dimension_id")
      .notNull()
      .references(() => optionDimensions.id),
    value: jsonb("value").$type<OptionAnswer>().notNull(),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("project_options_project_dimension_uq").on(t.projectId, t.dimensionId)],
);

export type OptionAnswer = {
  /** Gewählte Werte-Codes (single: genau einer, multi: beliebig viele). */
  codes?: string[];
  text?: string;
  bool?: boolean;
  /** «weiss ich nicht». Betroffene Seiten bleiben sichtbar und werden als «Variante klären» markiert. */
  unknown?: boolean;
  /** Freie Ergänzung, z. B. «50 L mit Transferpumpen». */
  note?: string;
};

/** Build-Art je Baugruppe (Rumpf QB, Flügel Standard …). */
export const projectBuildTypes = pgTable(
  "project_build_types",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    assemblyGroup: text("assembly_group").notNull(),
    buildType: buildType("build_type").notNull().default("unknown"),
    ...timestamps,
  },
  (t) => [uniqueIndex("project_build_types_project_group_uq").on(t.projectId, t.assemblyGroup)],
);

/** Eigene Abweichungen vom Bausatz. Fliessen als Entwurf in EAS 12.28 (M5). */
export const projectDeviations = pgTable(
  "project_deviations",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"),
    status: deviationStatus("status").notNull().default("planned"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("project_deviations_project_idx").on(t.projectId)],
);

/** Welche Revision eines Handbuchs das Projekt gerade nutzt. */
export const projectManualRevisions = pgTable(
  "project_manual_revisions",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    manualId: uuid("manual_id")
      .notNull()
      .references(() => manuals.id),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => manualRevisions.id),
    activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [uniqueIndex("project_manual_revisions_project_manual_uq").on(t.projectId, t.manualId)],
);

export type Project = typeof projects.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type ProjectOption = typeof projectOptions.$inferSelect;
export type ProjectBuildType = typeof projectBuildTypes.$inferSelect;
export type ProjectDeviation = typeof projectDeviations.$inferSelect;
