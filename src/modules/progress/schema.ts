import {
  boolean,
  date,
  integer,
  numeric,
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
import { pages } from "../manuals/schema";
import { projects } from "../projects/schema";

export const pageStatusKind = pgEnum("page_status_kind", [
  "open",
  "in_progress",
  "done",
  "not_applicable",
  "problem",
]);
export const naReason = pgEnum("na_reason", ["manual", "config", "quick_build"]);
export const visaTargetType = pgEnum("visa_target_type", ["page", "section", "dossier_item"]);
export const missingPartStatus = pgEnum("missing_part_status", ["needed", "ordered", "received", "installed"]);

/** Status einer Seite im Projekt. Keine Zeile = offen. */
export const pageStatus = pgTable(
  "page_status",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    status: pageStatusKind("status").notNull().default("open"),
    naReason: naReason("na_reason"),
    doneAt: date("done_at"),
    note: text("note"),
    updatedBy: uuid("updated_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("page_status_project_page_uq").on(t.projectId, t.pageId),
    index("page_status_project_idx").on(t.projectId),
  ],
);

/** Zusatzarbeiten: frei anlegbare Aufgaben, optional mit Seite/Dossier-Punkt/Datei verknüpft. */
export const extraTasks = pgTable(
  "extra_tasks",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category"),
    note: text("note"),
    dueDate: date("due_date"),
    done: boolean("done").notNull().default(false),
    doneAt: date("done_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    /** Verknüpfungen zu Modulen späterer Meilensteine (ohne FK, bis die Tabellen existieren). */
    dossierItemId: uuid("dossier_item_id"),
    fileRefId: uuid("file_ref_id"),
    ticketId: uuid("ticket_id"),
    /** `manual`, `ticket`, `import` (Prototyp), … */
    origin: text("origin").notNull().default("manual"),
    /** Externe Kennung, z. B. ID aus dem Prototyp-Export (idempotenter Import). */
    externalRef: text("external_ref"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("extra_tasks_project_idx").on(t.projectId),
    uniqueIndex("extra_tasks_project_external_uq").on(t.projectId, t.externalRef),
  ],
);

/** Fehlteile pro Seite (Position, Teilenummer, Menge), exportierbar für eine Bestellung. */
export const missingParts = pgTable(
  "missing_parts",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    position: text("position"),
    partNumber: text("part_number"),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    unit: text("unit").notNull().default("Stk"),
    status: missingPartStatus("status").notNull().default("needed"),
    /** Verknüpfung zum Einkaufsposten (M2), ohne FK bis die Tabelle existiert. */
    purchaseItemId: uuid("purchase_item_id"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [index("missing_parts_project_idx").on(t.projectId), index("missing_parts_page_idx").on(t.pageId)],
);

/** Visum des Bauberaters auf Seite, Abschnitt oder Dossier-Punkt. */
export const visas = pgTable(
  "visas",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    targetType: visaTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    advisorUserId: uuid("advisor_user_id").references(() => users.id),
    /** Name des Beraters, falls (noch) kein Nutzerkonto existiert. */
    advisorName: text("advisor_name").notNull(),
    visaDate: date("visa_date").notNull(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("visas_project_target_idx").on(t.projectId, t.targetType, t.targetId)],
);

export type PageStatus = typeof pageStatus.$inferSelect;
export type ExtraTask = typeof extraTasks.$inferSelect;
export type MissingPart = typeof missingParts.$inferSelect;
export type Visa = typeof visas.$inferSelect;
