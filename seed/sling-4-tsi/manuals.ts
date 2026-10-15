import type { SeedManual, SeedRule, SeedSection } from "../types";

/**
 * Handbuch-Stammdaten Sling 4 TSi. Quellen:
 * - Auftrag «Sling Builder Tracker» (Seed-Tabelle, Stand 15.10.2026)
 * - Prototyp «HB-YMR Baufortschritt» (Abschnitte und Seitenbereiche, Stand 15.10.2026)
 * - Drive-Ordner «Sling 4 TSi - Construction Manuals» (Dateinamen und Grössen der Revisionen)
 *
 * Grundsatz: Nichts wird geraten. Was unklar ist, trägt eine unbestätigte Regel («Variante klären»)
 * oder einen Hinweis im Import-Report. Zeichnungsnummern fehlen, bis die Import-Pipeline (M4) sie liest.
 * Seitennummern sind die «PAGE n»-Angaben der Zeichnungsköpfe.
 */

const longRange = (key: string, sourceText: string): SeedRule => ({
  key,
  expression: { dim: "tanks", in: ["long_range"] },
  sourceText,
  rationale: "Long-Range-Seiten laut Auftrag (Seed-Tabelle Wing Rev 7: 18, 31, 33, 43–49, 53).",
  confirmed: true,
});

const parachute = (key: string, sourceText: string): SeedRule => ({
  key,
  expression: { dim: "parachute", in: ["brs", "magnum"] },
  sourceText,
  rationale: "Rettungsschirm-Seiten laut Auftrag; gelten nur mit BRS/Magnum.",
  confirmed: true,
});

const canopyVersion = (key: string, version: "2019" | "2020_2021" | "2023", sourceText: string): SeedRule => ({
  key,
  expression: { dim: "canopy_version", in: [version] },
  sourceText,
  rationale: "Canopy-Versionen laut Auftrag und Prototyp; bleibt «klären», bis die Version beantwortet ist.",
  confirmed: true,
});

const brakes = (key: string, system: "matco" | "beringer", control?: "hand" | "toe"): SeedRule => ({
  key,
  expression: control
    ? {
        all: [
          { dim: "brakes", in: [system] },
          { dim: "brake_control", in: control === "hand" ? ["hand"] : ["toe_single", "toe_dual"] },
        ],
      }
    : { dim: "brakes", in: [system] },
  sourceText:
    (system === "matco" ? "MATCO" : "Beringer") +
    (control === "hand" ? ", Standard Brakes (Handhebel)" : control === "toe" ? ", Toe Brakes" : ""),
  rationale: "Fahrwerkshandbuch Rev 1.5: MATCO S. 1–17, Beringer S. 18–31; Toe Brakes S. 15–16 bzw. 30 (Auftrag).",
  confirmed: true,
});

const autopilot = (key: string, axis: "roll" | "pitch", sourceText: string): SeedRule => ({
  key,
  expression: { dim: "autopilot_servos", in: [axis] },
  sourceText,
  rationale: "Autopilot-Seiten laut Auftrag (Finishing Rev 2.3, S. 7–10).",
  confirmed: true,
});

/** Hilfsfunktion: ein Abschnitt pro Seite (Fahrwerk). */
const single = (page: number, title: string, rules?: SeedRule[], extra?: Partial<SeedSection>): SeedSection => ({
  title,
  from: page,
  to: page,
  rules,
  ...extra,
});

const QB_BRIEF = {
  quickBuild: "assembled_by_sling" as const,
  quickBuildSource: "brief",
};

export const manuals: SeedManual[] = [
  {
    code: "introduction",
    docNumber: null,
    title: "Introduction",
    assemblyGroup: "general",
    kind: "intro",
    sortOrder: 0,
    notes: "Drehmomenttabellen und allgemeine Hinweise, keine Bauseiten. Dokumentnummer im Auftrag nicht angegeben.",
    revisions: [
      {
        revision: "2",
        status: "released",
        sourceName: "Sling 4 TSi KAI - Introduction Rev 2.pdf",
        sourceSize: 334110,
        pageCount: 0,
        notes: "Keine abhakbaren Bauseiten.",
      },
    ],
  },
  {
    code: "empennage",
    docNumber: "DC-KAI-001-X-F",
    title: "Empennage",
    assemblyGroup: "empennage",
    sortOrder: 1,
    revisions: [
      {
        revision: "3.4",
        revisionDate: "2025-05-23",
        status: "released",
        sourceName: "DC-KAI-001-X-F-3.4.pdf",
        sourceSize: 26588653,
        pageCount: 27,
        sections: [
          { title: "Horizontal Stabilizer Assembly", from: 1, to: 6 },
          { title: "Elevator Assembly", from: 7, to: 17 },
          { title: "Vertical Stabilizer Assembly", from: 18, to: 23 },
          { title: "Rudder Assembly", from: 24, to: 27 },
        ],
      },
      {
        revision: "3.2",
        status: "draft",
        sourceName: "DC-KAI-001-X-F-3.2 - Sling 4 TSi Empennage KAI.pdf",
        sourceSize: 6973079,
        notes: "Ältere Revision, nur als Datei bekannt. Struktur nicht erfasst.",
      },
    ],
  },
  {
    code: "wing",
    docNumber: "DC-KAI-002-X-F",
    title: "Wing",
    assemblyGroup: "wing",
    sortOrder: 2,
    revisions: [
      {
        revision: "7",
        revisionDate: "2024-10-24",
        status: "released",
        sourceName: "DC-KAI-002-X-F-7.pdf",
        sourceSize: 39212696,
        pageCount: 67,
        importReport: {
          notes: [
            { code: "missing_in_toc", text: "Seite 4 fehlt im Inhaltsverzeichnis und ist als «Seite ohne Titel» angelegt.", pages: [4] },
          ],
          conflicts: [
            {
              code: "qb_conflict",
              text: "Wing Assembly 2 (S. 50–54): Quick-Build-Hinweise von Inhaltsverzeichnis und Seitennotiz widersprechen sich laut Auftrag. Es gilt die Seitennotiz; beim Import (M4) prüfen.",
              pages: [50, 51, 52, 53, 54],
            },
          ],
        },
        sections: [
          { title: "Wing Root Twist Jig Assembly", from: 1, to: 1 },
          { title: "Wing Tip Twist Jig Assembly", from: 2, to: 2 },
          { title: "Rear Spar Assembly", from: 3, to: 3 },
          {
            title: "Seite 4",
            from: 4,
            to: 4,
            untitled: true,
            flags: { missingInToc: true },
            notes: "Nicht im Inhaltsverzeichnis aufgeführt; Titel wird beim Import aus dem Zeichnungskopf ergänzt.",
          },
          { title: "Wing Rib 1 Assembly", from: 5, to: 5 },
          { title: "Wing Rib 6 Assembly", from: 6, to: 6 },
          { title: "Wing Rib 7 Assembly", from: 7, to: 7 },
          { title: "Wing Rib 8 Assembly", from: 8, to: 8 },
          { title: "Wing Rib 10 Assembly", from: 9, to: 9 },
          { title: "Wing Rib 11 Assembly", from: 10, to: 10 },
          { title: "Wing Rib 14 Assembly", from: 11, to: 11 },
          {
            title: "Wing Assembly 4",
            from: 12,
            to: 18,
            pages: {
              18: { rules: [longRange("wing-7:p18:long-range", "Long-Range-Tank Vorbereitung (S. 18)")] },
            },
          },
          {
            title: "Wing Assembly 3",
            from: 19,
            to: 22,
            pages: {
              19: { flags: { variantNote: "Ein Teil auf dieser Seite wird laut Handbuch nicht beim 198-L-Tank verwendet." } },
              22: {
                flags: { variantNote: "Wig-Wag-Option" },
                rules: [
                  {
                    key: "wing-7:p22:wig-wag",
                    expression: { dim: "lights", in: ["wig_wag_standard"] },
                    sourceText: "Wig-Wag-Option (S. 22)",
                    rationale: "Vorschlag: Seite nur bei Wig-Wag-Lichtern. Aus dem Prototyp als Varianten-Hinweis übernommen, Zuordnung noch nicht bestätigt.",
                    confirmed: false,
                  },
                ],
              },
            },
          },
          { title: "Fuel Tank Jig Setup", from: 23, to: 25 },
          { title: "Wing Rib 22 Assembly", from: 26, to: 30 },
          { title: "Long Range Fuel Tank Rib 25 Assembly", from: 31, to: 31, rules: [longRange("wing-7:s31:long-range", "Long Range Fuel Tank Rib 25")] },
          {
            title: "Wing Rib 26 Assembly",
            from: 32,
            to: 32,
            rules: [
              {
                key: "wing-7:s32:198-only",
                expression: { not: { dim: "tanks", in: ["long_range"] } },
                sourceText: "laut Handbuch nur 198-L-Tank",
                rationale: "Vorschlag: Rib 26 nur ohne Long Range. Im Auftrag als «Rib 26 (S. 32) nur 198 L» genannt, im Prototyp aber als erledigt markiert; deshalb nicht automatisch ausblenden, sondern klären.",
                confirmed: false,
              },
            ],
          },
          { title: "Wing Rib 27 Assembly", from: 33, to: 33, rules: [longRange("wing-7:s33:long-range", "Long Range 52 L")] },
          { title: "Sealant Detail for the Fuel Tank", from: 34, to: 35 },
          { title: "198L Fuel Tank Assembly", from: 36, to: 42 },
          { title: "Long Range Wing Fuel Tank Jig Setup", from: 43, to: 45, rules: [longRange("wing-7:s43-45:long-range", "Long Range Wing Fuel Tank Jig Setup")] },
          { title: "52L Long Range Fuel Tanks", from: 46, to: 49, rules: [longRange("wing-7:s46-49:long-range", "52L Long Range Fuel Tanks")] },
          {
            title: "Wing Assembly 2",
            from: 50,
            to: 54,
            flags: { qbConflict: "Quick-Build-Hinweis: Inhaltsverzeichnis und Seitennotiz widersprechen sich (laut Auftrag). Seitennotiz gilt; beim Import prüfen." },
            pages: {
              53: { rules: [longRange("wing-7:p53:long-range", "Long-Range-Tank Einbau (S. 53)")] },
            },
          },
          { title: "Aileron Assembly", from: 55, to: 58 },
          { title: "Flap Assembly", from: 59, to: 62 },
          { title: "Wing Assembly 1", from: 63, to: 67 },
        ],
      },
      {
        revision: "6.6",
        status: "draft",
        sourceName: "DC-KAI-002-X-F-6.6 - Sling 4 TSi Wing KAI.pdf",
        sourceSize: 41662430,
        notes: "Ältere Revision, nur als Datei bekannt.",
      },
      {
        revision: "6.4",
        status: "draft",
        sourceName: "DC-KAI-002-X-F-6.4 - Sling 4 TSi Wing KAI.pdf",
        sourceSize: 174794796,
        notes: "Ältere Revision, nur als Datei bekannt.",
      },
    ],
  },
  {
    code: "fuselage",
    docNumber: "DC-KAI-003-X-F",
    title: "Fuselage",
    assemblyGroup: "fuselage",
    sortOrder: 3,
    revisions: [
      {
        revision: "8.5",
        status: "released",
        sourceName: "DC-KAI-003-X-F-8.5.pdf",
        sourceSize: 101284546,
        notes: "Keine Textebene, OCR nötig (Import-Pipeline M4). Bis dahin kann die Anzahl Bauseiten manuell erfasst werden; die Seiten erscheinen dann ohne Titel.",
        importReport: {
          notes: [{ code: "no_text_layer", text: "PDF ohne Textebene; Abschnitte und Titel folgen aus der OCR-Aufbereitung (M4)." }],
        },
      },
      { revision: "8.3", status: "draft", sourceName: "DC-KAI-003-X-F-8.3.pdf", sourceSize: 106508928, notes: "Ältere Revision, nur als Datei bekannt." },
      { revision: "8.1", status: "draft", sourceName: "DC-KAI-003-X-F-8.1 - Sling 4 TSi Fuselage KAI.pdf", sourceSize: 123955510, notes: "Ältere Revision, nur als Datei bekannt." },
      { revision: "7.9", status: "draft", sourceName: "DC-KAI-003-X-F-7.9 - Sling 4 TSi Fuselage KAI.pdf", sourceSize: 247337072, notes: "Ältere Revision, nur als Datei bekannt." },
    ],
  },
  {
    code: "undercarriage",
    docNumber: "DC-KAI-004-X-F",
    title: "Undercarriage",
    assemblyGroup: "undercarriage",
    sortOrder: 4,
    revisions: [
      {
        revision: "1.5",
        revisionDate: "2024-08-20",
        status: "released",
        sourceName: "DC-KAI-004-X-F-1.5.pdf",
        sourceSize: 19223049,
        pageCount: 31,
        importReport: {
          notes: [
            {
              code: "type_header",
              text: "Laut Auftrag tragen manche Zeichnungsköpfe «Sling 4 HW» oder «Sling HW» (Dubletten/Schreibfehler). Welche Seiten betroffen sind, wird beim Import (M4) festgestellt; Seiten werden deswegen nie ausgeblendet.",
            },
          ],
        },
        sections: [
          single(1, "Nose Wheel Assembly", [brakes("uc-1.5:p1:matco", "matco")]),
          single(2, "Front Gear Assembly", [brakes("uc-1.5:p2:matco", "matco")]),
          single(3, "Wheel Installation on the Nose Gear", [brakes("uc-1.5:p3:matco", "matco")]),
          single(4, "Front Gear and Engine Mount Assembly", [brakes("uc-1.5:p4:matco", "matco")]),
          single(5, "Engine Mount Installation", [brakes("uc-1.5:p5:matco", "matco")]),
          single(6, "Nose Wheel Spat Installation", [brakes("uc-1.5:p6:matco", "matco")]),
          single(7, "Main Wheel Assembly", [brakes("uc-1.5:p7:matco", "matco")]),
          single(8, "Axle Assembly to Main Wheel & Spats", [brakes("uc-1.5:p8:matco", "matco")]),
          single(9, "Main Gear Axle and Wheel Installation", [brakes("uc-1.5:p9:matco", "matco")]),
          single(10, "Main Wheel Spat Installation", [brakes("uc-1.5:p10:matco", "matco")]),
          single(11, "Main Landing Gear to Fuselage Assembly", undefined, { notes: "Gilt für MATCO und Beringer." }),
          single(12, "Brake Line Extension Installation", [brakes("uc-1.5:p12:matco", "matco")]),
          { title: "Brake Line Routing (Standard Brakes)", from: 13, to: 14, rules: [brakes("uc-1.5:s13-14:matco-hand", "matco", "hand")] },
          { title: "Brake Line Routing (Toe Brakes)", from: 15, to: 16, rules: [brakes("uc-1.5:s15-16:matco-toe", "matco", "toe")] },
          single(17, "Bleeding the Brakes", [brakes("uc-1.5:p17:matco", "matco")]),
          single(18, "Nose Wheel Assembly", [brakes("uc-1.5:p18:beringer", "beringer")]),
          single(19, "Front Gear Assembly", [brakes("uc-1.5:p19:beringer", "beringer")]),
          single(20, "Wheel Installation on the Nose Gear", [brakes("uc-1.5:p20:beringer", "beringer")]),
          single(21, "Front Landing Gear Assembly", [brakes("uc-1.5:p21:beringer", "beringer")]),
          single(22, "Engine Mount Installation", [brakes("uc-1.5:p22:beringer", "beringer")]),
          single(23, "Nose Wheel Spat Installation", [brakes("uc-1.5:p23:beringer", "beringer")]),
          single(24, "Main Wheel Assembly", [brakes("uc-1.5:p24:beringer", "beringer")]),
          single(25, "Main Wheel Axle Assembly", [brakes("uc-1.5:p25:beringer", "beringer")]),
          single(26, "Main Wheel & Axle Installation", [brakes("uc-1.5:p26:beringer", "beringer")]),
          single(27, "Main Wheel Spat Preparation", [brakes("uc-1.5:p27:beringer", "beringer")]),
          single(28, "Main Wheel Spat Installation", [brakes("uc-1.5:p28:beringer", "beringer")]),
          single(29, "Brake Line Routing (Standard Brakes)", [brakes("uc-1.5:p29:beringer-hand", "beringer", "hand")]),
          single(30, "Brake Line Routing (Toe Brakes)", [brakes("uc-1.5:p30:beringer-toe", "beringer", "toe")]),
          single(31, "Bleeding the Brakes", [brakes("uc-1.5:p31:beringer", "beringer")]),
        ],
      },
      { revision: "1.4", status: "draft", sourceName: "DC-KAI-004-X-F-1.4 - Sling TSi Undercarriage KAI.pdf", sourceSize: 21833499, notes: "Ältere Revision, nur als Datei bekannt." },
      { revision: "1.2", status: "draft", sourceName: "DC-KAI-004-X-F-1.2 Sling TSi Undercarriage KAI.pdf", sourceSize: 9345225, notes: "Ältere Revision, nur als Datei bekannt." },
    ],
  },
  {
    code: "canopy",
    docNumber: "DC-KAI-005-X-F",
    title: "Canopy",
    assemblyGroup: "canopy",
    sortOrder: 5,
    revisions: [
      {
        revision: "2.5",
        coverLabel: "Mai 2026",
        status: "released",
        sourceName: "DC-KAI-005-X-F-2.5.pdf",
        sourceSize: 31594876,
        pageCount: 28,
        notes: "Das Inhaltsverzeichnis dieser Revision ist veraltet. Es gelten die Seitennummern der Zeichnungsköpfe.",
        importReport: {
          notes: [
            { code: "cover_rev_not_in_table", text: "Deckblatt «Mai 2026» (Rev 2.5), die Revisionstabelle endet bei 2.4. Es gilt das Deckblatt." },
          ],
          conflicts: [
            {
              code: "toc_outdated",
              text: "Ein neuer Abschnitt (S. 11–13) hat einen alten ersetzt. Ab Seite 14 liegt das Inhaltsverzeichnis um eine Seite daneben (29 Einträge, Zeichnungen 28 Seiten). Massgebend ist der Zeichnungskopf.",
              pages: [11, 12, 13, 14],
            },
          ],
        },
        sections: [
          { title: "Interior Lighting Wiring Harness Routing", from: 1, to: 1 },
          { title: "Canopy Installation", from: 2, to: 4 },
          { title: "Front Upper Skin Installation", from: 5, to: 5, rules: [canopyVersion("canopy-2.5:p5:v2023", "2023", "Version 2023")] },
          { title: "Parachute Cable Installation", from: 6, to: 6, rules: [parachute("canopy-2.5:p6:parachute", "Parachute")] },
          { title: "Canopy Hinge Installation", from: 7, to: 7, rules: [canopyVersion("canopy-2.5:p7:v2019", "2019", "Version 2019")] },
          { title: "Canopy Hinge Installation", from: 8, to: 9, rules: [canopyVersion("canopy-2.5:s8-9:v2020", "2020_2021", "Version 2020/2021")] },
          { title: "Door Rubber Installation", from: 10, to: 10 },
          { title: "Canopy Door Latch Assembly", from: 11, to: 13, flags: { tocMismatch: true }, notes: "Neuer Abschnitt, ersetzt einen alten (Inhaltsverzeichnis veraltet)." },
          { title: "Canopy Door Handle Installation", from: 14, to: 14, flags: { tocMismatch: true } },
          { title: "Canopy Door Latch Installation", from: 15, to: 17, flags: { tocMismatch: true } },
          { title: "Window Installation", from: 18, to: 18, titleNote: "Türfenster", flags: { tocMismatch: true } },
          { title: "Canopy Door Handle Installation", from: 19, to: 21, flags: { tocMismatch: true } },
          { title: "Window Installation", from: 22, to: 22, titleNote: "Windschutzscheibe", flags: { tocMismatch: true } },
          { title: "Dashboard Installation", from: 23, to: 23, flags: { tocMismatch: true } },
          { title: "Gas Strut Installation", from: 24, to: 24, flags: { tocMismatch: true } },
          { title: "Canopy Hinge Installation", from: 25, to: 25, flags: { tocMismatch: true }, rules: [canopyVersion("canopy-2.5:p25:v2023", "2023", "Version 2023")] },
          { title: "Canopy Covers Installation", from: 26, to: 26, flags: { tocMismatch: true }, rules: [canopyVersion("canopy-2.5:p26:v2023", "2023", "Version 2023")] },
          { title: "Canopy Gas Strut Installation", from: 27, to: 27, flags: { tocMismatch: true }, rules: [canopyVersion("canopy-2.5:p27:v2023", "2023", "Version 2023")] },
          { title: "Cabin Light Wiring & Oxygen Tube Installation", from: 28, to: 28, flags: { tocMismatch: true }, rules: [canopyVersion("canopy-2.5:p28:v2023", "2023", "Version 2023")] },
        ],
      },
      { revision: "2.4", status: "draft", sourceName: "DC-KAI-005-X-F-2.4 - Sling 4 TSi Canopy Construction Manual.pdf", sourceSize: 35415425, notes: "Ältere Revision, nur als Datei bekannt." },
    ],
  },
  {
    code: "fwf",
    docNumber: "DC-KAI-006-X-F",
    title: "Firewall Forward & Fuel System",
    assemblyGroup: "fwf",
    sortOrder: 6,
    revisions: [
      {
        revision: "4.4",
        status: "released",
        sourceName: "DC-KAI-006-X-F-4.4.pdf",
        sourceSize: 52899667,
        notes: "Keine Textebene, OCR nötig (Import-Pipeline M4). Bis dahin kann die Anzahl Bauseiten manuell erfasst werden.",
        importReport: {
          notes: [{ code: "no_text_layer", text: "PDF ohne Textebene; Abschnitte und Titel folgen aus der OCR-Aufbereitung (M4)." }],
        },
      },
      { revision: "4.1", status: "draft", sourceName: "DC-KAI-006-X-F-4.1.pdf", sourceSize: 57319281, notes: "Ältere Revision, nur als Datei bekannt." },
      { revision: "3.6", status: "draft", sourceName: "DC-KAI-006-X-F-3.6.pdf", sourceSize: 38081068, notes: "Ältere Revision, nur als Datei bekannt." },
      { revision: "3.5", status: "draft", sourceName: "DC-KAI-006-X-F-3.5 - Sling 4 TSi Firewall Forward & Fuel System.pdf", sourceSize: 36239204, notes: "Ältere Revision, nur als Datei bekannt." },
    ],
  },
  {
    code: "electrics",
    docNumber: null,
    title: "Electrics",
    assemblyGroup: "electrics",
    sortOrder: 7,
    notes: "Nur die alte Rev 4.1 vorhanden; bei Custom-Avionik oft durch den Panelbauer-Plan ersetzt. Dokumentnummer nicht bekannt.",
    revisions: [
      {
        revision: "4.1",
        status: "released",
        sourceName: "old_Sling Electrical Construction Manual, Rev. 4.1.pdf",
        sourceSize: 4215911,
        notes: "Alte Revision. Struktur nicht erfasst; Anzahl Bauseiten kann manuell erfasst werden.",
      },
    ],
  },
  {
    code: "finishing",
    docNumber: "DC-KAI-008-X-F",
    title: "Finishing",
    assemblyGroup: "finishing",
    sortOrder: 8,
    revisions: [
      {
        revision: "2.3",
        revisionDate: "2025-02-18",
        status: "released",
        sourceName: "DC-KAI-008-X-F-2.3.PDF",
        sourceSize: 45733286,
        pageCount: 58,
        importReport: {
          notes: [
            {
              code: "qb_brief",
              text: "Laut Auftrag tragen alle Seiten den Quick-Build-Hinweis «assembled by Sling». Hier als Hinweis mit Quelle «brief» hinterlegt; er wirkt nur, wenn die Baugruppe als Quick Build konfiguriert ist, und wird beim Import (M4) seitenweise geprüft.",
            },
          ],
        },
        sections: [
          { title: "Pushrod Layout", from: 1, to: 1, allPages: QB_BRIEF },
          { title: "Pushrod Assembly", from: 2, to: 6, allPages: QB_BRIEF },
          { title: "Aileron Autopilot Installation", from: 7, to: 8, allPages: QB_BRIEF, rules: [autopilot("fin-2.3:s7-8:ap-roll", "roll", "Autopilot (Aileron)")] },
          { title: "Elevator Autopilot Installation", from: 9, to: 10, allPages: QB_BRIEF, rules: [autopilot("fin-2.3:s9-10:ap-pitch", "pitch", "Autopilot (Elevator)")] },
          { title: "Pushrod Assembly", from: 11, to: 11, allPages: QB_BRIEF },
          { title: "Throttle Cable", from: 12, to: 14, allPages: QB_BRIEF },
          { title: "Horizontal Stabiliser Installation", from: 15, to: 15, allPages: QB_BRIEF },
          { title: "Elevator Installation", from: 16, to: 17, allPages: QB_BRIEF },
          { title: "Vertical Stabiliser Installation", from: 18, to: 18, allPages: QB_BRIEF },
          { title: "Rudder Installation", from: 19, to: 19, allPages: QB_BRIEF },
          { title: "Rudder Cable Installation", from: 20, to: 20, allPages: QB_BRIEF },
          { title: "Wing Installation", from: 21, to: 25, allPages: QB_BRIEF },
          { title: "Parachute Handle Installation", from: 26, to: 32, allPages: QB_BRIEF, rules: [parachute("fin-2.3:s26-32:parachute", "Parachute Handle")] },
          { title: "Parachute Blowout Skin Installation", from: 33, to: 33, allPages: QB_BRIEF, rules: [parachute("fin-2.3:p33:parachute", "Parachute Blowout Skin")] },
          { title: "Rudder Rigging", from: 34, to: 35, allPages: QB_BRIEF },
          { title: "Elevator Rigging", from: 36, to: 37, allPages: QB_BRIEF },
          { title: "Elevator Trim Tab Rigging", from: 38, to: 38, allPages: QB_BRIEF },
          { title: "Aileron Rigging", from: 39, to: 41, allPages: QB_BRIEF },
          { title: "Flap Rigging", from: 42, to: 43, allPages: QB_BRIEF },
          { title: "Propeller Pitch Guideline", from: 44, to: 44, allPages: QB_BRIEF },
          { title: "Empennage Fairing Installation", from: 45, to: 47, allPages: QB_BRIEF },
          { title: "Wing Fairing Installation Guide", from: 48, to: 50, allPages: QB_BRIEF },
          { title: "Cowling Installation", from: 51, to: 56, allPages: QB_BRIEF },
          { title: "Exhaust Shroud Installation", from: 57, to: 57, allPages: QB_BRIEF },
          { title: "Oil Cooler & Radiator Installation", from: 58, to: 58, allPages: QB_BRIEF },
        ],
      },
      { revision: "2.2", status: "draft", sourceName: "DC-KAI-008-X-F-2.2 - Sling 4 TSi Finishing KAI.PDF", sourceSize: 166466929, notes: "Ältere Revision, nur als Datei bekannt." },
    ],
  },
  {
    code: "heater",
    docNumber: "CH-ASS-001-X-F",
    title: "Heater Air System",
    assemblyGroup: "heater",
    sortOrder: 9,
    revisions: [
      {
        revision: "0",
        status: "released",
        sourceName: "CH-ASS-001-X-F-0-A-0.pdf",
        sourceSize: 1580308,
        pageCount: 12,
        notes: "Die Zeichnungen enthalten praktisch nur Positionsnummern; Seitentitel werden manuell erfasst.",
        sections: [
          {
            title: "Heater Air System",
            from: 1,
            to: 12,
            allPages: { flags: { noText: true } },
            notes: "Nur Seitennummern, keine Abschnittstitel im Dokument.",
          },
        ],
      },
    ],
  },
];
