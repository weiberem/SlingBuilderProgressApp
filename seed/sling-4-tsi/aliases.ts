import type { SeedAlias } from "../types";

/**
 * Begriffs-Normalisierung für Sling 4 TSi. Quelle: Auftrag, Abschnitt «Begriffs-Normalisierung».
 * Jede Regel hat Geltungsbereich (hier: ganzes Modell, solange keine Revision bekannt ist) und Begründung.
 * Originaltexte bleiben gespeichert und werden als Tooltip gezeigt.
 */
export const aliases: SeedAlias[] = [
  {
    key: "tsi:engine:915-is",
    kind: "engine",
    matchText: "915 iS",
    replacement: "{project.engine}",
    rationale: "In TSi-Handbüchern steht teils «Rotax 915 iS», obwohl für aktuelle Kits der 916 iS gemeint ist. Anzeige gemäss Projektkonfiguration, Original im Tooltip.",
    sortOrder: 10,
  },
  {
    key: "tsi:engine:915-916",
    kind: "engine",
    matchText: "915\\s*/\\s*916(\\s*iS)?",
    isRegex: true,
    replacement: "{project.engine}",
    rationale: "«915 / 916» wird gemäss Projektkonfiguration angezeigt.",
    sortOrder: 11,
  },
  {
    key: "tsi:typo:wiing",
    kind: "typo",
    matchText: "WIING",
    replacement: "WING",
    rationale: "Tippfehler in Titeln (laut Auftrag). Anzeige korrigiert, Original bleibt gespeichert.",
    sortOrder: 20,
  },
  {
    key: "tsi:typo:horisontal",
    kind: "typo",
    matchText: "HORISONTAL",
    replacement: "HORIZONTAL",
    rationale: "Tippfehler in Titeln (laut Auftrag).",
    sortOrder: 21,
  },
  {
    key: "tsi:typo:blakes",
    kind: "typo",
    matchText: "BLAKES",
    replacement: "BRAKES",
    rationale: "Tippfehler in Titeln (laut Auftrag).",
    sortOrder: 22,
  },
  {
    key: "tsi:type-header:sling-4-hw",
    kind: "type_header",
    matchText: "Sling 4 HW",
    replacement: "Sling 4 TSi",
    rationale: "Im TSi-Fahrwerkshandbuch tragen manche Zeichnungsköpfe «Sling 4 HW» (Dublette/Schreibfehler). Nur Anzeige; Seiten werden nie deswegen gefiltert.",
    scopeManualCode: "undercarriage",
    sortOrder: 30,
  },
  {
    key: "tsi:type-header:sling-hw",
    kind: "type_header",
    matchText: "Sling HW",
    replacement: "Sling 4 TSi",
    rationale: "Wie oben, Variante «Sling HW».",
    scopeManualCode: "undercarriage",
    sortOrder: 31,
  },
];
