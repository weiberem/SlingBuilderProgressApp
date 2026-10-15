# Rückfragen an Remy (Stand 15.10.2026)

Acht gebündelte Fragen. Zu jeder steht, was ich ohne Antwort annehme, damit die Arbeit nicht stillsteht.
Die Recherche dazu liegt in `docs/recherche.md`; Hoster-Preise konnten aus der Build-Umgebung nicht auf den
offiziellen Seiten verifiziert werden (Netzwerk gesperrt) und sind deshalb als «zu bestätigen» markiert.

## 1. Hosting: kleiner Server oder lokal?

**Vorschlag (Standard):** Infomaniak «VPS Lite» in der Schweiz (2 vCPU, 4 GB, 60 GB NVMe, ca. CHF 7–8 pro Monat, zu bestätigen)
mit Docker Compose und Caddy (automatisches TLS), nächtlicher `pg_dump` in einen Infomaniak-Swiss-Backup-Speicher
(ca. CHF 4 pro Monat, S3/SFTP). Alles in der Schweiz, zusammen rund CHF 12 pro Monat.

**Alternativen:** EU-VPS (netcup oder Hetzner, ca. EUR 6–8, Hetzners günstige CX-Linie war im Herbst 2026 teils nicht
bestellbar) oder zu Hause auf NAS/Mini-PC mit Cloudflare Tunnel (gratis, aber Einzelpunkt-Ausfall, Updates und TLS
selbst betreuen; für die PWA im Hangar braucht es eine vertrauenswürdige HTTPS-Adresse).

**Fragen:** Schweiz als Datenstandort Pflicht oder EU in Ordnung? Soll die App unter `app.slingaircraft.ch` laufen,
und wer verwaltet das DNS dieser Domain? Betreibst du den Server selbst (mit Anleitung in `docs/betrieb.md`)?

**Annahme ohne Antwort:** Infomaniak, Subdomain `app.slingaircraft.ch`, Betrieb durch dich mit Anleitung.

## 2. Gmail-Zugriff in Phase 1

Fakten (recherchiert): Dein Konto ist ein privates Gmail-Konto, also gibt es keinen «internen» OAuth-Modus. Im Modus
«Testing» laufen Google-Refresh-Tokens bei **jedem** Gmail-Scope nach 7 Tagen ab. Ein OAuth-Client, der auf
«In production» gestellt, aber **nicht verifiziert** ist, funktioniert mit `gmail.readonly` trotzdem: Du klickst einmal
den Warnbildschirm «Google hat diese App nicht überprüft» weg, die Tokens laufen nicht ab, und die App ist auf 100 Nutzer
insgesamt begrenzt (für Phase 1 egal). Google nennt das die Ausnahme für «persönliche Nutzung».

**Varianten:**
- (a) **Empfohlen:** OAuth-Client «In production», unverifiziert, Scopes `gmail.readonly` + `gmail.send`. Kein 7-Tage-Problem.
- (b) Wie im Auftrag: Modus «Testing», alle 7 Tage neu verbinden (die App zeigt «Gmail neu verbinden»).
- (c) Ohne OAuth: Google-App-Passwort mit IMAP/SMTP (braucht 2-Schritt-Verifizierung; 2026 noch verfügbar,
  von Google als «nicht empfohlen» geführt). Gmail-IMAP liefert Thread-IDs (`X-GM-THRID`), Zuordnung klappt also auch so.
  Ich baue (c) ohnehin als zweiten Provider hinter dem Mail-Interface (später generisches IMAP).

Für den späteren Mehrnutzerbetrieb braucht `gmail.readonly` eine Google-Verifizierung mit jährlichem CASA-Assessment
(Stufe AL1, grob USD 540–1200 pro Jahr), oder man weicht auf «nur senden plus Weiterleitung» aus.

**Frage:** Variante (a) in Ordnung? Dann legst du das Google-Cloud-Projekt mit meiner Anleitung an (OAuth-Client-ID
und -Secret kommen in die `.env`).

**Annahme ohne Antwort:** (a), mit (c) als Fallback.

## 3. Sendungsverfolgung: Links oder API?

**Vorschlag für M3:** Nur Tracking-Links pro Carrier (Swiss Post, DHL, UPS, FedEx, USPS, GLS, DPD) und automatische
Carrier-Erkennung aus Nummernformat und Absender-Domain, immer als bestätigbarer Vorschlag. Kostenlos, keine API-Schlüssel.

**Später möglich:** Kostenlose Carrier-APIs (DHL 250 Abfragen/Tag; UPS und FedEx mit Kundenkonto) oder ein Aggregator:
Parcels App Pro (USD 19/Monat, 300 Nummern, inkl. Luft-/Seefracht, nützlich für Kit-Kisten) oder Ship24 (USD 39/Monat).
Die Swiss-Post-API ist nur für Geschäftskunden.

**Frage:** Reichen Links in M3? Gibt es ein Budget für einen Aggregator, und ab wann?

**Annahme ohne Antwort:** Links, Aggregator-Schnittstelle nur vorbereitet.

## 4. Fehlende Beilagen

`EAS_12_34E_Aircraft_file.pdf`, `GuidetoAFMandAMM_e.pdf` und `HB-YMR_Export_2026-10-15.json` waren in dieser Sitzung
nicht vorhanden (weder im Repo noch in deinem Drive oder Gmail auffindbar).

- **Prototyp-Stand:** Ich habe stattdessen die Datenbank deines Claude-Artifacts «HB-YMR Baufortschritt» direkt gelesen
  (Stand 15.10.2026): Empennage S. 1–23 erledigt, S. 24 offen; Wing S. 1–62 erledigt; 33 Zusatzarbeiten (3 erledigt).
  Diese Daten liegen in `seed/hb-ymr/prototype-export-2026-10-15.json` und sind importiert. Importierte Seiten tragen als
  Datum den 15.10.2026 mit der Notiz «Datum des Abhakens unbekannt».
- **EAS-Formulare:** Online ist nur eine alte Version 3.0 (2012) der EAS 12.34 auffindbar. Dort steht «Dossierkopie eine
  Arbeitswoche vor der Abnahme an den BAZL-Experten», nicht 14 Tage. Ohne die PDFs baue ich die Dossier-Checkliste (M5)
  nach deiner Beschreibung im Auftrag und markiere jeden Punkt als «aus Auftrag, gegen EAS 12.34 v5.1 zu prüfen».

**Frage:** Lege die beiden PDFs bitte in `docs/sources/` im Repo (oder in den Drive-Ordner `01_Vorgaben&Dokumente-EAS-BAZL`).
Stimmt der importierte Stand, oder gibt es einen neueren Export?

## 5. Design: slingaircraft.ch ist aus der Build-Umgebung gesperrt

Die Netzwerkrichtlinie der Cloud-Umgebung lässt `slingaircraft.ch`, `slingaircraft.com` und `experimental.ch` nicht zu.
Das Design in M1 stammt deshalb aus deinem Logo (Schwarz, Weiss, Rot `#C00000`, gesperrte Versalien) und liegt komplett in
`src/styles/tokens.css`.

**Bitte:** Gib in den Einstellungen der Cloud-Umgebung (Menü in der Titelzeile, «Edit», Netzwerkzugriff) die Domains
`slingaircraft.ch`, `www.slingaircraft.ch`, `slingaircraft.com` und `experimental.ch` frei (Stufe «Limited», Allowed domains).
Danach gleiche ich Farben, Schriften und Abstände in einem Schritt an. Alternativ: Screenshot der Startseite plus
Farbcodes und Schriftnamen.

## 6. Offene Antworten im Onboarding HB-YMR

Diese Punkte stehen auf «weiss ich nicht»; betroffene Seiten bleiben sichtbar und sind als «Variante klären» markiert:

| Punkt | Wirkung | Frage |
|---|---|---|
| Build-Art je Baugruppe (Standard oder Quick Build) | QB-Hinweise «assembled by Sling» würden Seiten als ab Werk erledigt kennzeichnen | Welche Baugruppen sind Quick Build? |
| Canopy-Version (2019 / 2020–21 / 2023) | 8 Canopy-Seiten | Welche Version, und woran erkennt man sie (für den Hilfetext)? |
| Lichter (Wig-Wag Standard / Aveo) | Wing S. 22 | Was ist verbaut? |
| Wing S. 32 «Rib 26 nur 198 L» | laut Auftrag nur ohne Long Range, im Prototyp aber erledigt | Regel bestätigen oder Seite gilt trotzdem? |
| Finishing «alles QB-Hinweis» | ich habe den Hinweis auf alle 58 Seiten gelegt, Quelle «Auftrag» | Richtig verstanden: jede Seite trägt den Hinweis? |
| Motor-Anzeige | Aliase zeigen «916 iS» statt «915 iS» | Soll «916 iS» oder «916 iS A» stehen? |

**Annahme ohne Antwort:** alles bleibt «klären».

## 7. EAS-Stammdaten aus deiner Korrespondenz übernehmen?

In deinem Postfach finden sich: EAS-Projekt Typ 1 (BAZL-EAS-Vereinbarung 79000693), Projektregistrierung 21.11.2023,
Projektannahme 28.11.2023, Bauberater Dan Ruiter (aerofun.ch), EAS-Adressen `coordination@`, `acceptance@`,
`technics@experimental.ch`, BAZL-Register `aircraftregistry@bazl.admin.ch` (Kennzeichen HB-YMR reserviert).

**Frage:** Darf ich diese Angaben als Stammdaten (Organisationen, Kontakte) und als Dossier-Daten des Projekts säen?
Und: Gibt es ein geplantes Datum für die BAZL-Endabnahme (Basis für die EAS-Fristen)? Aus deinem Oshkosh-Dokument lese
ich «Flugerprobung ab Mitte Januar 2027», also Abnahme etwa Dezember 2026 bis Januar 2027.

**Annahme ohne Antwort:** Stammdaten werden erst in M5 gesät, Abnahmedatum bleibt leer.

## 8. Vorgehen und Stack bestätigen

Ich habe M1 **vor** der Freigabe des Architektur-Dokuments gebaut, weil nichts davon von den Fragen oben abhängt und
alles Projektspezifische in Seed-Daten liegt. Abweichungen vom Auftrag, bitte bestätigen oder jetzt ändern lassen,
solange es günstig ist:

- **Drizzle** statt Prisma (SQL-Migrationen als Dateien, läuft auch ohne Docker in Tests).
- **Eigene Session-Auth** nach dem Lucia-Muster statt Auth.js (Credentials-Login mit Datenbank-Sessions ist in Auth.js nur
  mit JWT möglich; Lucia ist seit 2025 keine Bibliothek mehr, sondern eine Anleitung).
- **pg-boss ohne Redis** (ein Dienst weniger im Betrieb).
- **Next.js 16 ohne «Cache Components»** (die App ist komplett privat und datengetrieben).
- Antippen einer Seite wechselt wie im Prototyp offen → erledigt → trifft nicht zu; «in Arbeit» und «Problem» über das
  Seiten-Menü.

**Frage:** Einverstanden? Und von welcher Absenderadresse sollen System-Mails (Passwort-Reset) verschickt werden
(SMTP-Zugang, z. B. Infomaniak-Mail oder Gmail mit App-Passwort)?
