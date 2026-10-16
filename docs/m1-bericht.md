# M1-Bericht (15.10.2026)

Meilenstein 1 ist umgesetzt, getestet und auf `master` gepusht. Dieser Bericht sagt, was funktioniert, was nicht,
und was ungeklärt ist. Offene Fragen an Remy stehen in `docs/rueckfragen.md`.

## Was funktioniert

**Login und Konto**
- Anmeldung mit E-Mail und Passwort (argon2id, Datenbank-Sessions, 30 Tage gleitend), Abmelden, Passwort ändern.
- Passwort-Reset und E-Mail-Verifizierung per Link (Mailversand über SMTP, ohne SMTP nur geloggt).
- Login-Bremse: 10 Versuche pro E-Mail und 15 Minuten, 50 pro IP. Registrierung ist implementiert, aber nicht verlinkt (Feature-Flag).

**Projekt HB-YMR und Konfiguration**
- Projekt aus Seed-Daten (Kit 575, Sling 4 TSi), Antworten des Onboardings vorbelegt (916 iS, MT-Propeller mit SCU 9iS,
  kein Rettungsschirm, Beringer Dual Toe Brakes, 198 L + Long Range, Garmin AXIS, Aithre-O2; Winglets und 250-L-Ferry-Tank als Abweichungen).
- Konfigurations-Wizard mit einem Schritt pro Gruppe, «weiss ich nicht» überall erlaubt, Build-Art je Baugruppe,
  Abweichungen pflegbar. Vor jeder Änderung mit Seitenwirkung zeigt die App, welche Seiten dazukommen, wegfallen oder neu zu klären sind.

**Handbücher und Abhaken**
- Stammdaten Sling 4 TSi: 10 Handbücher, 23 Revisionen (neueste freigegeben, ältere nur als Datei bekannt), 104 Abschnitte, 223 Seiten,
  48 Varianten-Regeln (46 bestätigt, 2 bewusst unbestätigt), 7 Aliase, 15 Konfigurationsachsen.
- Erwartung aus dem Auftrag erfüllt und per Test abgesichert: MATCO-Seiten, Standardbremsen-Seiten und Parachute-Seiten fallen weg,
  Long-Range-Seiten bleiben, Canopy-Versionsseiten bleiben «klären».
- Seiten-Chips (56 px): Antippen wechselt offen → erledigt → trifft nicht zu → offen; langes Drücken oder «…» öffnet alle fünf Status,
  Datum und Notiz. Abschnitt erledigen und zurücksetzen mit einem Klick. Filter «nur offene», «Varianten klären», Legende, Hinweise zur Revision.
- Seitendetail mit Original- und Anzeigetitel (Aliase mit Tooltip «im Handbuch: …»), Regeln und Begründungen, Flags
  (Inhaltsverzeichnis-Abweichung, fehlende Seite, Varianten-Hinweis, QB-Konflikt), Fehlteile pro Seite, verknüpfte Zusatzarbeiten,
  Visa (nur Anzeige), Verlauf aus dem Audit-Log, Vor/Zurück.
- Fortschritt pro Handbuch und gesamt, gerechnet nur über zutreffende Seiten; Konflikte «manueller Status widerspricht Konfiguration» werden gezählt.

**Zusatzarbeiten und Fehlteile**
- Zusatzarbeiten mit Bereich, Notiz, Fälligkeit (überfällig markiert), Filter, Gruppierung, Bearbeiten, zweistufiges Löschen,
  Verknüpfung mit einer Handbuchseite. Fehlteile mit Position, Teilenummer, Menge, Statuskette und CSV-Export für die Bestellung.

**Offline und PWA**
- Änderungen werden lokal in IndexedDB gesammelt und idempotent synchronisiert (`clientChangeId`); Banner zeigt offline und wartende Änderungen.
- Service Worker (Serwist): App-Shell und Assets gecacht, Offline-Seite, Installationshinweis in den Einstellungen. Manifest und Icons aus dem Logo.

**Betrieb**
- Docker Compose (Caddy mit automatischem TLS, web, worker, PostgreSQL, Backup mit täglichem Dump und Rotation), CI (Lint, Typecheck, Vitest, Build, Playwright),
  Anleitungen in `README.md` und `docs/betrieb.md`.
- Einmaliger Import des Prototyp-Stands: 85 Seiten (Empennage 1–23, Wing 1–62) und 33 Zusatzarbeiten übernommen, idempotent.

**Tests:** 113 Unit- und Service-Tests (Vitest, gegen PostgreSQL), 15 End-to-End-Tests (Playwright, Desktop und Mobil), Produktions-Build grün.

## Was nicht funktioniert oder fehlt

- **Fuselage 8.5, Firewall Forward 4.4 und Electrics 4.1 haben keine Seiten** (keine Textebene, OCR kommt mit M4). Übergangslösung wie im Prototyp:
  In den Stammdaten kann die Anzahl Bauseiten erfasst werden, dann erscheinen Seiten ohne Titel. Im Prototyp war keine Seitenzahl gesetzt.
- **Docker-Images sind nicht gebaut worden**, weil in der Build-Umgebung kein Docker-Daemon läuft; `docker compose config` ist gültig, die
  Schritte der Dockerfiles wurden lokal nachvollzogen. Erster Start auf einem Server bitte mit `docs/betrieb.md` prüfen.
- **Fotos pro Seite** fehlen (brauchen Google Drive, M4). Die Tabelle `page_photos` ist noch nicht angelegt.
- **Bauberater-Visa** werden angezeigt, aber es gibt noch keine Eingabe (kein Advisor-Login in Phase 1); kommt mit dem EAS-Modul.
- Fehlteile lassen sich nach dem Anlegen nur im Status ändern oder löschen, nicht bearbeiten; keine manuelle Sortierung von Zusatzarbeiten.
- Importierte Seiten tragen als «erledigt am» den 15.10.2026, weil der Prototyp keine Daten speicherte (Notiz weist darauf hin).
- Design (nachgetragen 16.10.2026): auf das Design-System «Sling Aircraft Switzerland» umgestellt (dark-first, Sling-Rot, Inter, SVG-Logo); Tokens in `src/styles/tokens.css`.

## Was ungeklärt ist

- Build-Art je Baugruppe, Canopy-Version, Lichter, Wing S. 32 (Rib 26), Finishing-QB-Hinweis, Motor-Anzeige: siehe Rückfrage 6.
  Bis zur Antwort bleiben 60 Seiten als «Variante klären» markiert (8 Canopy, 50 Finishing wegen Build-Art, 2 Wing).
- Hosting, Gmail-Variante, Sendungsverfolgung, fehlende EAS-PDFs, SMTP-Absender: Rückfragen 1–4 und 8.
- Next.js 17 wird «Cache Components» voraussichtlich verbindlich machen; die App läuft bewusst noch im klassischen Modell (eigener späterer Schritt).

## Nächste Schritte (M2)

Tickets an Sling über das Gmail-Konto (Senden, Antworten zuordnen, Nachfassen) und Einkaufsliste mit Statuskette, sobald die
Gmail-Variante (Rückfrage 2) bestätigt ist. Der `MailProvider` wird mit Gmail-API und IMAP/SMTP als zweitem Weg gebaut.
