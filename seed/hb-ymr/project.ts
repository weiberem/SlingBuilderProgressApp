import type { SeedProject } from "../types";

/**
 * Testprojekt HB-YMR (Remy Weibel, Kit 575). Quelle: Auftrag, Abschnitt «Seed-Daten».
 * Nicht im Auftrag beantwortete Fragen stehen auf «weiss ich nicht» (unknown) und werden
 * im Onboarding als offen gezeigt; betroffene Seiten bleiben sichtbar («Variante klären»).
 */
export const hbYmr: SeedProject = {
  modelCode: "sling-4-tsi",
  registration: "HB-YMR",
  kitNumber: "575",
  name: "HB-YMR · Sling 4 TSi",
  options: {
    engine: { codes: ["rotax_916is"] },
    propeller: { codes: ["mt"] },
    propeller_governor: { text: "RS FlightSystems SCU 9iS" },
    parachute: { codes: ["none"] },
    brakes: { codes: ["beringer"] },
    brake_control: { codes: ["toe_dual"] },
    tanks: { codes: ["standard_198", "long_range"], note: "Long Range 50 L mit Transferpumpen (Handbuch: 52 L)." },
    tanks_note: { text: "198 L + Long Range 50 L mit Transferpumpen" },
    canopy_version: { unknown: true },
    autopilot_servos: { codes: ["roll", "pitch", "yaw"], note: "Garmin GFC 500 mit 3 Servos" },
    avionics_platform: { codes: ["garmin_axis"] },
    avionics_details: { text: "Garmin AXIS (2× GDU 116BX), GTN 750Xi, GFC 500 (3 Servos), G5" },
    o2_system: { text: "Aithre" },
    extra_pumps: { unknown: true },
    lights: { unknown: true },
  },
  /** Build-Art je Baugruppe ist im Auftrag nicht angegeben → offen (Rückfrage). */
  buildTypes: {
    empennage: "unknown",
    wing: "unknown",
    fuselage: "unknown",
    undercarriage: "unknown",
    canopy: "unknown",
    fwf: "unknown",
    electrics: "unknown",
    finishing: "unknown",
    heater: "unknown",
  },
  deviations: [
    { title: "Winglets statt Sling-Randbögen", category: "Struktur", status: "in_progress", description: "Ersetzt die originalen Sling-Randbögen (Holz-Urform, GFK-Teile)." },
    { title: "Zusätzlicher 250-L-Fährtank", category: "Treibstoffsystem", status: "planned", description: "Geplant für die Transatlantik-Überführung; Arm, Transferkonzept, BAZL-Genehmigung." },
  ],
};
