import type { MissingPartStatus, PageRef } from "@/modules/progress/tasks-service";

export type { MissingPartStatus };

/** Statuskette eines Fehlteils in Anzeige-Reihenfolge (clientseitig, ohne Server-Abhängigkeiten). */
export const PART_STATUSES: readonly MissingPartStatus[] = ["needed", "ordered", "received", "installed"];

/** Serialisierbare Sicht einer Zusatzarbeit für Client-Komponenten (keine Datenbankzeile). */
export type TaskDto = {
  id: string;
  title: string;
  category: string | null;
  note: string | null;
  dueDate: string | null;
  done: boolean;
  doneAt: string | null;
  origin: string;
  pageId: string | null;
  pageRef: PageRef | null;
};

export type PageRefDto = PageRef & { pageId: string };

/** Serialisierbare Sicht eines Fehlteils für Client-Komponenten. */
export type PartDto = {
  id: string;
  pageId: string | null;
  position: string | null;
  partNumber: string | null;
  description: string;
  quantity: string;
  unit: string;
  status: MissingPartStatus;
  note: string | null;
  pageNumber: number | null;
  manualTitle: string | null;
  manualCode: string | null;
};

export type TaskFilter = "open" | "all" | "done";
export const TASK_FILTERS: TaskFilter[] = ["open", "all", "done"];

export function parseTaskFilter(value: string | string[] | undefined): TaskFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "all" || v === "done" ? v : "open";
}
