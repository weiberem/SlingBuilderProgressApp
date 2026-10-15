import { timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { newId } from "../lib/ids";

/** Gemeinsame Spalten: UUID-v7-Primärschlüssel, Zeitstempel. */
export const id = () => uuid("id").primaryKey().$defaultFn(newId);

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
};

/** Mehrsprachiges Label: {de, en?, fr?}. Deutsch ist Pflicht. */
export type I18nText = { de: string; en?: string; fr?: string };

export const i18nText = (name: string) => jsonb(name).$type<I18nText>();
