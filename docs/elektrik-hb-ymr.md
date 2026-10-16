# Elektrik HB-YMR: Geräteliste und Vorschlag für die Arbeitsschritte

Stand 16.10.2026. Remys Vorgabe: «Nimm als Basis die Offerte von Adam und versuche daraus zu verwenden, was möglich ist;
massgebend ist die letzte Version des Schemas von Adam.» Die Elektrik ist bei jedem Flugzeug individuell; das
Electrics-Handbuch von Sling enthält nur ein einfaches Beispielschema. Für HB-YMR gilt deshalb `electrics_plan = custom`.

## Quellen

| Kürzel | Dokument | Status |
|---|---|---|
| A | AIR TEAM Proforma 25FAZ11002 (17.03.2025) und 25FAZ13900 (13.09.2025), Drive-Ordner «Equipment liste» | **gekauft** |
| B | Midwest Panel Builders, Estimate 1132 (09.09.2026, Adam O'Connor) | Offerte; laut Remys Mail «für einen Flugclub» angefragt (VFR-Panel) |
| C | «TSi VPX - Rack and Harness.pdf», Adam O'Connor, 28.08.2026, 41 Seiten | **Schema, massgebend** |

Die Liste steht maschinenlesbar in `seed/hb-ymr/electrics/equipment.json` (39 Positionen: 20 bestätigt, 19 offen).
Nichts ist geraten: Jede Position nennt ihre Quellen, Widersprüche sind als `unclear` markiert.

## Bestätigt (in Rechnung und Schema)

G5 (Backup), GTN 750Xi, G3X-LRU-Kit (GSU 25C, GMU 11, GTP 59), GEA 24B, 2 × GSA 28 (Roll, Pitch), GMC 507, GMA 245R,
GHA 15, AT-1 (ADS-B/FLARM), Trig TY91 + TC90 (COM 2), VP-X Pro (Stromverteilung), IBBS 6 Ah (EFIS-Backup), Artex ELT 345,
Antennen RAMI AV-10, AV-17, AV-525, AV-74, GPS-Antenne BNC, Aithre O2 (2 × Turbo, Healthview, Shield 3.0).

## Offen (bitte klären)

| Position | Rechnung (A) | Offerte (B) / Onboarding | Schema (C) |
|---|---|---|---|
| Displays | 2 × GDU 460 (10,6" G3X Touch) | 2 × GDU 116BX (AXIS) | «GDU 116» |
| Transponder | GTX 35R | GTX 45R (ADS-B In) | GTX 45R |
| Autopilot-Servos | 2 (Roll, Pitch) | Onboarding: GFC 500 mit 3 Servos | 2 |
| GAD 27 (Flaps, Trim, Lichter) | nicht gekauft | in Offerte | zentral im Schema |
| GAD 29C | je 1 × in beiden Rechnungen | – | 1 |
| GAP 26 Pitot beheizt | nicht gekauft | in Offerte | im Schema |
| IBBS | 1 gekauft | 1 | 2 (EFIS und NAV) |
| GPS-Antennen | 1 × GA 35 + 1 × BNC | 2 × GA 35 | – |
| Lichter | – | Aveo MiniMax Beacon, AeroLED Pulsar NSP | Aveo Tip-Lights, Aveo Beacon, Landescheinwerfer mit Wig-Wag, Taxi |
| USB | – | 2 × PowerWerx | 3 × PowerWerx |
| Kleinteile | – | Tosten Grips, Interior-Lights-Kit, Master Caution, Master/Start-Schalter | IntelliKey, Master Caution, EarthX-Batterie, CIES-Fuel-Sender |

## Vorschlag: so kommen Arbeitsschritte in die App

Das Schema (C) ist bereits in **41 Blätter je System** gegliedert (Diagram Key, Air Data, Autopilot 2 ×, Audio 4 ×, COM 2 2 ×,
Traffic, GAD 27 7 ×, Transponder, GTN 5 ×, GDU 5 ×, Backup 3 ×, GEA 24 3 ×, VP-X, ELT, Aithre 2 ×, CAN-Bus, GHA 15). Das
entspricht genau der Struktur «Handbuch → Abschnitt → Seite», mit der die App arbeitet.

Vorschlag für die Umsetzung (eigener Schritt nach M1, vor oder mit M4):

1. **Projekt-eigene Handbücher.** Die Tabellen `manuals`/`manual_revisions` bekommen ein optionales `project_id`
   (Migration, kein Bruch). Ein projekt-eigenes Handbuch «Elektrik HB-YMR (Midwest, 28.08.2026)» ersetzt für dieses Projekt
   das Sling-Electrics-Handbuch; Revisionswechsel funktioniert wie bei Sling-Handbüchern (neue Version von Adam = neue Revision).
2. **Import des Schemas** über dieselbe Pipeline wie die Sling-PDFs (M4: Textebene lesen, pro Blatt Titel «System: …
   Remarks: …», Seitenzahl). Die PDF bleibt im Drive, die App speichert nur Struktur und Hash.
3. **Geräteliste als Modul** (`equipment`): Positionen aus `equipment.json` mit Status (bestätigt / offen / eingebaut),
   Seriennummern, Verknüpfung zu Schema-Blättern und zu Fehlteilen/Einkauf (M2/M3); Export für EAS 12.29c und FOCA 53074.
   Upload der Equipment-Liste (CSV/PDF) im Onboarding, wenn `electrics_plan = custom`.
4. **Ableitung von Arbeitsschritten:** pro Schema-Blatt eine Seite (abhakbar), pro Gerät optional Zusatzarbeiten
   («Rack montieren», «Harness einziehen», «Konfiguration laut Blatt 25») als Vorschläge, die der Erbauer übernimmt oder streicht.

Offen vor dem Bau: Punkte 1–4 oben (Geräteliste), und ob Adams Schema als eigenes «Handbuch» erscheinen soll (Vorschlag) oder
die Blätter im Sling-Electrics-Handbuch an die Stelle der Sling-Seiten treten.
