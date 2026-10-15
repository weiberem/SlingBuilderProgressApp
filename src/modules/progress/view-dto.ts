import { effectiveStatus, type EffectiveStatus, type NaReason, type PageApplicability, type StatusKind } from "@/modules/manuals/applicability";
import type { ImportReport, StructureFlags } from "@/modules/manuals/schema";
import { mergeProgress, summarizeProgress, type ProgressSummary } from "./progress";
import type { ManualView } from "./service";

/**
 * JSON-sichere Sicht auf ein Handbuch für den Client (Handbuch-Ansicht, Offline-Snapshot, Sync-Antwort).
 * Enthält nur, was die Oberfläche braucht; keine Date-Objekte, keine fremden Tabellenzeilen.
 * Die Hilfsfunktionen sind rein und laufen auch im Browser (optimistische Änderungen).
 */
export type StoredStatusDto = {
  status: StatusKind;
  naReason: NaReason | null;
  doneAt: string | null;
  note: string | null;
};

export type PageStatusRowDto = StoredStatusDto & { pageId: string };

export type PageDto = {
  id: string;
  pageNumber: number;
  titleDisplay: string;
  titleOriginal: string;
  titleChanged: boolean;
  quickBuild: "none" | "assembled_by_sling" | "jig_not_applicable";
  flags: StructureFlags;
  notes: string | null;
  status: EffectiveStatus;
  applicability: PageApplicability;
  stored: StoredStatusDto | null;
};

export type SectionDto = {
  id: string;
  titleDisplay: string;
  titleOriginal: string;
  titleChanged: boolean;
  titleNote: string | null;
  pageFrom: number;
  pageTo: number;
  isUntitled: boolean;
  notes: string | null;
  pages: PageDto[];
  progress: ProgressSummary;
};

export type ManualViewDto = {
  manual: { id: string; code: string; title: string; docNumber: string | null; kind: "kai" | "intro" | "supplement"; assemblyGroup: string };
  revision: {
    id: string;
    revision: string;
    revisionDate: string | null;
    coverLabel: string | null;
    pageCount: number | null;
    importReport: ImportReport;
    notes: string | null;
  };
  sections: SectionDto[];
  progress: ProgressSummary;
  hasStructure: boolean;
  /** Zeitpunkt der Erstellung auf dem Server (ISO), für den Vergleich mit dem Offline-Cache. */
  generatedAt: string;
};

export function toManualViewDto(view: ManualView): ManualViewDto {
  return {
    manual: {
      id: view.manual.id,
      code: view.manual.code,
      title: view.manual.title,
      docNumber: view.manual.docNumber,
      kind: view.manual.kind,
      assemblyGroup: view.manual.assemblyGroup,
    },
    revision: {
      id: view.revision.id,
      revision: view.revision.revision,
      revisionDate: view.revision.revisionDate,
      coverLabel: view.revision.coverLabel,
      pageCount: view.revision.pageCount,
      importReport: view.revision.importReport,
      notes: view.revision.notes,
    },
    sections: view.sections.map((s) => ({
      id: s.section.id,
      titleDisplay: s.titleDisplay,
      titleOriginal: s.section.titleOriginal,
      titleChanged: s.titleChanged,
      titleNote: s.section.titleNote,
      pageFrom: s.section.pageFrom,
      pageTo: s.section.pageTo,
      isUntitled: s.section.isUntitled,
      notes: s.section.notes,
      progress: s.progress,
      pages: s.pages.map((p) => ({
        id: p.page.id,
        pageNumber: p.page.pageNumber,
        titleDisplay: p.titleDisplay,
        titleOriginal: p.titleOriginal,
        titleChanged: p.titleChanged,
        quickBuild: p.page.quickBuild,
        flags: p.page.flags,
        notes: p.page.notes,
        status: p.status,
        applicability: p.applicability,
        stored: p.stored ? { status: p.stored.status, naReason: p.stored.naReason, doneAt: p.stored.doneAt, note: p.stored.note } : null,
      })),
    })),
    progress: view.progress,
    hasStructure: view.hasStructure,
    generatedAt: new Date().toISOString(),
  };
}

export type PageStatusPayload = {
  pageId: string;
  status: StatusKind;
  naReason?: NaReason | null;
  doneAt?: string | null;
  note?: string | null;
};

export type SectionStatusPayload = { sectionId: string; status: "done" | "open" };

function localToday(): string {
  const d = new Date();
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return tz.toISOString().slice(0, 10);
}

/** Spiegelt die Regeln von `setPageStatus` (Service) für die optimistische Anzeige. */
export function nextStoredStatus(existing: StoredStatusDto | null, input: Omit<PageStatusPayload, "pageId">): StoredStatusDto {
  const naReason = input.status === "not_applicable" ? (input.naReason ?? "manual") : null;
  const doneAt =
    input.status === "done" ? (input.doneAt ?? existing?.doneAt ?? localToday()) : input.status === "open" ? null : (existing?.doneAt ?? null);
  const note = input.note === undefined ? (existing?.note ?? null) : input.note;
  return { status: input.status, naReason, doneAt, note };
}

function recompute(section: SectionDto, pages: PageDto[]): SectionDto {
  return { ...section, pages, progress: summarizeProgress(pages.map((p) => p.status)) };
}

function withSections(view: ManualViewDto, sections: SectionDto[]): ManualViewDto {
  return { ...view, sections, progress: mergeProgress(sections.map((s) => s.progress)) };
}

/** Setzt den gespeicherten Status einer Seite (null = keine Zeile) und rechnet Status und Fortschritt neu. */
export function applyStoredStatus(view: ManualViewDto, pageId: string, stored: StoredStatusDto | null): ManualViewDto {
  let touched = false;
  const sections = view.sections.map((s) => {
    if (!s.pages.some((p) => p.id === pageId)) return s;
    touched = true;
    return recompute(
      s,
      s.pages.map((p) => (p.id === pageId ? { ...p, stored, status: effectiveStatus(stored, p.applicability) } : p)),
    );
  });
  return touched ? withSections(view, sections) : view;
}

/** Wendet mehrere Serverstände an (Seiten ohne Zeile → null). */
export function applyStatusRows(view: ManualViewDto, pageIds: string[], rows: PageStatusRowDto[]): ManualViewDto {
  const byId = new Map(rows.map((r) => [r.pageId, r]));
  let next = view;
  for (const id of pageIds) {
    const r = byId.get(id);
    next = applyStoredStatus(next, id, r ? { status: r.status, naReason: r.naReason, doneAt: r.doneAt, note: r.note } : null);
  }
  return next;
}

/** Optimistische Seitenänderung (wie `setPageStatus`). */
export function applyPageChange(view: ManualViewDto, payload: PageStatusPayload): ManualViewDto {
  const page = findPage(view, payload.pageId);
  if (!page) return view;
  return applyStoredStatus(view, payload.pageId, nextStoredStatus(page.stored, payload));
}

/** Optimistische Abschnittsänderung (wie `setSectionStatus`). */
export function applySectionChange(view: ManualViewDto, payload: SectionStatusPayload): ManualViewDto {
  const sections = view.sections.map((s) => {
    if (s.id !== payload.sectionId) return s;
    const pages = s.pages.map((p) => {
      if (payload.status === "done") {
        if (!p.status.relevant || p.status.status === "done") return p;
      } else if (!p.stored || p.stored.status === "open") return p;
      const stored = nextStoredStatus(p.stored, { status: payload.status });
      return { ...p, stored, status: effectiveStatus(stored, p.applicability) };
    });
    return recompute(s, pages);
  });
  return withSections(view, sections);
}

export function findPage(view: ManualViewDto, pageId: string): PageDto | null {
  for (const s of view.sections) for (const p of s.pages) if (p.id === pageId) return p;
  return null;
}

export function findSectionOfPage(view: ManualViewDto, pageId: string): SectionDto | null {
  return view.sections.find((s) => s.pages.some((p) => p.id === pageId)) ?? null;
}
