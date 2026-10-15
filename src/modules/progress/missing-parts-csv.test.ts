import { describe, expect, it } from "vitest";
import { missingPartsToCsv, type MissingPartCsvRow } from "./tasks-service";

const row = (over: Partial<MissingPartCsvRow> = {}): MissingPartCsvRow => ({
  manualTitle: "Empennage",
  pageNumber: 7,
  position: "12",
  partNumber: "SL-123",
  description: "Niete 3.2 mm",
  quantity: "20.00",
  unit: "Stk",
  status: "needed",
  note: null,
  ...over,
});

describe("missingPartsToCsv", () => {
  it("schreibt Kopfzeile und Zeilen mit Semikolon, ohne BOM", () => {
    const csv = missingPartsToCsv([row()]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("Handbuch;Seite;Position;Teilenummer;Beschreibung;Menge;Einheit;Status;Notiz");
    expect(lines[1]).toBe("Empennage;7;12;SL-123;Niete 3.2 mm;20.00;Stk;needed;");
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
  });

  it("nur Kopfzeile ohne Teile", () => {
    expect(missingPartsToCsv([])).toBe("Handbuch;Seite;Position;Teilenummer;Beschreibung;Menge;Einheit;Status;Notiz");
  });

  it("maskiert Semikolon, Anführungszeichen und Zeilenumbrüche", () => {
    const csv = missingPartsToCsv([
      row({ description: 'Schelle "gross"; verzinkt', note: "Zeile 1\nZeile 2", manualTitle: null, pageNumber: null, position: null, partNumber: null }),
    ]);
    const line = csv.split("\n").slice(1).join("\n");
    expect(line).toBe(';;;;"Schelle ""gross""; verzinkt";20.00;Stk;needed;"Zeile 1\nZeile 2"');
  });

  it("lässt Umlaute unverändert", () => {
    const csv = missingPartsToCsv([row({ description: "Grösse klären, Ölschlauch" })]);
    expect(csv).toContain("Grösse klären, Ölschlauch");
  });

  it("übersetzt den Status, wenn Bezeichnungen übergeben werden", () => {
    const csv = missingPartsToCsv([row({ status: "ordered" }), row({ status: "installed" })], { ordered: "bestellt" });
    const lines = csv.split("\n");
    expect(lines[1]).toContain(";bestellt;");
    expect(lines[2]).toContain(";installed;");
  });
});
