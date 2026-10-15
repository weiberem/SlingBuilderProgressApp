# Sling Builder Tracker – Architektur und Datenmodell

Stand: 15.10.2026 · Status: **Entwurf zur Freigabe** · Phase 1 (ein Nutzer, ein Projekt HB-YMR)

Dieses Dokument beschreibt, wie die App gebaut wird, wie die Daten modelliert sind und welche
Teile für den späteren Mehrnutzerbetrieb bereits vorbereitet sind, ohne gebaut zu werden.
Offene Entscheidungen stehen in `docs/rueckfragen.md`.

---

## 1. Leitentscheidungen

| Thema | Entscheid | Begründung |
|---|---|---|
| Frontend + Backend | **Next.js 16.4 (App Router), TypeScript, React 19** als ein Dienst (`web`) | Vorgabe; Server Actions und Route Handlers decken M1–M6 ab. Kein separater API-Dienst nötig. |
| Hintergrundjobs | Eigener Prozess **`worker`** (gleiches Repo, gleicher Code) mit **pg-boss 12** auf PostgreSQL | PDF-Import, OCR, Dropbox→Drive-Sync und Mail-Sync laufen nie im Request. pg-boss braucht **kein Redis**, das vereinfacht Hosting und Backup. |
| Datenbank | **PostgreSQL 16** | Vorgabe. Eine Datenbank für Fachdaten und Job-Queue. |
| ORM / Migrationen | **Drizzle ORM 0.45 + drizzle-kit** | Migrationen sind versionierte, lesbare SQL-Dateien (prüfbar, auditierbar). Drizzle läuft gegen PostgreSQL und gegen PGlite (Tests ohne Docker). Prisma wäre ebenfalls möglich; Drizzle ist SQL-näher, leichter im Container und braucht keinen Query-Engine-Prozess. |
| Auth | Eigene Session-Auth nach dem Lucia-Muster: **argon2id** (`@node-rs/argon2`), DB-Sessions, HttpOnly-Cookies, Rate-Limit in Postgres | Credentials-Login mit DB-Sessions ist mit Auth.js nur umständlich möglich (Credentials-Provider = JWT-Sessions). Lucia ist seit 2025 eine Anleitung, keine Bibliothek mehr; deren Muster ist klein, geprüft und ohne Abhängigkeiten. OAuth nur für Integrationen (Bibliothek `arctic`). |
| i18n | **next-intl 4**, Texte in `messages/de.json`; `en`/`fr` als leere Strukturen vorbereitet. Stammdaten-Labels als JSON `{de,en,fr}` | Keine Texte im Code. |
| UI | Tailwind CSS 4, eigene kleine Komponenten, Design-Tokens in `src/styles/tokens.css` | Design nach Sling Aircraft Switzerland (siehe 9). Grosse Touch-Ziele. |
| PWA / Offline | Web-App-Manifest, Service Worker (Serwist-Runtime, separat mit esbuild gebündelt), **Offline-Warteschlange in IndexedDB (Dexie)**, idempotenter Sync-Endpunkt | Abhaken im Hangar ohne Netz; Synchronisation später. |
| PDF | `poppler-utils` (pdftotext, pdftoppm), `ocrmypdf`/Tesseract im Worker-Container; Seitenbilder on demand | Vorgabe. PDFs werden nie zentral gespeichert (nur temporär während der Aufbereitung). |
| Hosting | Docker Compose (`web`, `worker`, `db`, `caddy`, `backup`) | Lokal und auf einem kleinen VPS identisch. Datenstandort frei wählbar (CH/EU). |
| Tests | Vitest (Engines, Services gegen PGlite/Postgres), Playwright (Onboarding, Abhaken) | Kritische Logik = Applicability, Alias, Revisions-Mapping. |

Next.js 16 wird **ohne** `cacheComponents` betrieben (klassisches, pro Request dynamisches Rendering), weil die App vollständig privat und datengetrieben ist. `middleware.ts` heisst in Next 16 `proxy.ts` und macht nur den optimistischen Cookie-Check; die echte Autorisierung passiert in der Datenzugriffsschicht.

---

## 2. Module und Verzeichnisstruktur

```
src/
  app/                      Routen (App Router), nur dünne Seiten/Layouts
    (auth)/login, …         Login, Passwort-Reset, (Registrierung vorbereitet, nicht verlinkt)
    (app)/p/[projectId]/…   Projektbereich: Handbücher, Seiten, Zusatzarbeiten, Einkauf, Tickets, EAS
    api/…                   Route Handlers (Sync, OAuth-Callbacks, Webhooks, Downloads)
    manifest.ts, sw-register
  modules/                  Fachmodule, jedes mit schema.ts (Drizzle), service.ts, actions.ts, tests
    auth/        Nutzer, Sessions, Tokens, Rate-Limit
    projects/    Projekte, Mitglieder, Onboarding-Antworten, Abweichungen
    manuals/     Stammdaten: Modelle, Handbücher, Revisionen, Abschnitte, Seiten, Optionen, Regeln, Aliase
                 + Import-Pipeline (Jobs) + Review + Revisions-Mapping
    progress/    Seitenstatus, Fotos, Visa, Zusatzarbeiten, Fehlteile, Fortschrittsberechnung
    eas/         Dossier-Vorlagen (EAS 12.34), Dossier-Punkte, Fristen, AFM/AMM-Workflow, Self-Checkout
    tickets/     Tickets, Nachrichten, Empfänger-Stammdaten
    purchasing/  Einkaufsposten, Bestellungen, Sendungen, Kosten, Rechnungen
    integrations/ Provider-Interfaces + Implementierungen (google, microsoft, dropbox, mail)
    files/       Datei-Referenzen (Provider, ID, Revision), Vorschau-Cache
    audit/       Audit-Log
  lib/                      db, i18n, crypto (Token-Verschlüsselung), logger, env, offline-client
  styles/tokens.css         Design-Tokens
worker/                     pg-boss Worker (Einstieg worker/index.ts), Job-Handler je Modul
drizzle/                    SQL-Migrationen (versioniert, nie editiert nach dem Commit)
seed/                       Stammdaten als Daten (JSON/TS): Modelle, Handbücher, Optionen, Regeln, Aliase,
                            EAS-Vorlage, Organisationen, Projekt HB-YMR
messages/                   de.json (en.json, fr.json vorbereitet)
docker/                     Dockerfiles, Compose, Caddyfile, Backup-Skript
e2e/                        Playwright
```

Regeln:
- Keine HB-YMR-Spezifika im Code. Alles Projektspezifische liegt in `seed/` oder in der Datenbank.
- Fachmodule greifen nur über ihre `service.ts` aufeinander zu, nie direkt auf fremde Tabellen.
- Jede Service-Funktion, die Projektdaten liest oder schreibt, erhält einen **`ProjectContext`** (`userId`, `projectId`, `role`). Ohne Kontext kein Zugriff. Das ist die Mandantentrennung.
- Integrationen nur über Interfaces (`StorageProvider`, `MailProvider`, `TrackingProvider`).

---

## 3. Datenmodell

Alle Tabellen haben `id` (UUID v7), `created_at`, `updated_at`. Projektbezogene Tabellen haben `project_id`
(FK, indexiert); nutzerbezogene Tabellen `user_id`. Stammdaten (Abschnitt 3.2) sind global und werden
vom Plattform-Admin gepflegt.

### 3.1 Nutzer, Projekte, Rollen (Modul auth, projects)

| Tabelle | Wichtige Felder | Bemerkung |
|---|---|---|
| `users` | `email` (citext, unique), `password_hash`, `email_verified_at`, `locale`, `is_platform_admin`, `totp_secret_enc` (null) | Phase 1: ein Datensatz (Remy, Admin). TOTP nur als Spalte vorbereitet. |
| `sessions` | `user_id`, `expires_at`, `last_seen_at`, `user_agent` | Gleitende Verlängerung, serverseitig widerrufbar. |
| `auth_tokens` | `user_id`, `kind` (verify_email, reset_password), `token_hash`, `expires_at`, `used_at` | Nur Hash gespeichert. |
| `auth_rate_limits` | `key` (ip / email), `window_start`, `count` | Login-Bremse ohne Redis. |
| `projects` | `owner_user_id`, `aircraft_model_id`, `registration` (HB-YMR), `kit_number`, `name`, `planned_inspection_date` | Ein Flugzeug = ein Projekt. |
| `project_members` | `project_id`, `user_id`, `role` (owner, co_builder, advisor, viewer), `invited_by`, `accepted_at` | Phase 1: nur owner-Eintrag. Einladungs-UI kommt später, die Tabelle ist da. |
| `project_options` | `project_id`, `dimension_id`, `value` (JSON: Code(s), Zahl, Text oder `{"unknown":true}`), `updated_by` | Onboarding-Antworten. «weiss ich nicht» ist ein gültiger Wert. |
| `project_build_types` | `project_id`, `assembly_group`, `build_type` (standard, quick_build) | Build-Art je Baugruppe. |
| `project_deviations` | `project_id`, `title`, `description`, `category`, `status`, `planned` | Eigene Abweichungen → EAS 12.28. |
| `project_manual_revisions` | `project_id`, `manual_id`, `revision_id`, `activated_at` | Welche Revision der Builder gerade nutzt (Standard: neueste freigegebene). |

### 3.2 Handbuch-Stammdaten (Modul manuals)

| Tabelle | Wichtige Felder | Bemerkung |
|---|---|---|
| `aircraft_models` | `code` (sling-4-tsi), `name`, `active` | Weitere Modelle sind nur Daten. |
| `manuals` | `aircraft_model_id`, `doc_number` (DC-KAI-003-X-F), `title`, `assembly_group`, `sort_order` | Dokumentnummer ist der stabile Schlüssel über Revisionen. |
| `manual_revisions` | `manual_id`, `revision` («8.5»), `revision_date`, `cover_revision_label`, `source_hash` (sha256), `source_name`, `source_size`, `status` (draft, in_review, released), `page_count`, `import_report` (JSON: Konflikte, Hinweise), `released_at/by` | Nur `released` ist für Builder sichtbar. Der Hash identifiziert die Fassung; keine PDF-Ablage. |
| `sections` | `revision_id`, `sort_order`, `title_display`, `title_original`, `page_from`, `page_to`, `drawing_number` (UN-ASM-001-X-F), `drawing_revision`, `is_untitled`, `flags` (JSON) | «Seite ohne Titel» = `is_untitled`. Original bleibt immer gespeichert. |
| `pages` | `revision_id`, `section_id`, `page_number` (aus Zeichnungskopf), `title_original`, `title_display`, `drawing_number`, `quick_build` (none, assembled_by_sling, jig_not_applicable), `quick_build_source` (toc, page_note, conflict), `flags` (JSON: toc_mismatch, title_missing, type_header_mismatch …), `notes` | unique(`revision_id`,`page_number`). |
| `option_dimensions` | `aircraft_model_id`, `code` (brakes, brake_control, tanks, canopy_version, …), `kind` (single, multi, bool, text), `label` (JSON i18n), `help` (JSON i18n), `assembly_scoped` (bool), `sort_order` | Achsen des Onboardings. |
| `option_values` | `dimension_id`, `code`, `label` (JSON), `help` (JSON), `sort_order` | Werte der Achsen. |
| `applicability_rules` | `target_type` (page, section), `target_id`, `expression` (JSON-AST), `effect` (applies_only_if, qb_prebuilt), `source_text`, `confirmed_by`, `confirmed_at` | Vom Import vorgeschlagen, vom Admin bestätigt. Unbestätigte Regeln wirken nicht. |
| `aliases` | `scope_model_id`, `scope_manual_id`, `scope_revision_id` (je nullable), `kind` (typo, term, engine, type_header), `match` (Text oder Regex), `replacement` (Text, darf `{project.engine}` referenzieren), `rationale`, `active` | Jede Normalisierung ist eine Regel mit Geltungsbereich und Begründung. |
| `import_jobs` | `manual_id`, `detected_revision`, `source_hash`, `source` (dropbox, drive, upload), `status`, `log` | Entsteht auch ohne PDF, wenn ein Builder eine unbekannte Revision in seiner Dropbox hat. |

### 3.3 Fortschritt (Modul progress)

| Tabelle | Wichtige Felder | Bemerkung |
|---|---|---|
| `page_status` | `project_id`, `page_id`, `status` (open, in_progress, done, not_applicable, problem), `na_reason` (manual, config, quick_build), `done_at` (Datum), `note`, `updated_by` | unique(`project_id`,`page_id`). Fehlende Zeile = `open`. |
| `page_photos` | `project_id`, `page_id`, `file_ref_id`, `caption`, `taken_at` | Fotos liegen im Drive des Builders. |
| `visas` | `project_id`, `target_type` (page, section, dossier_item), `target_id`, `advisor_user_id`, `visa_date`, `note` | Bauberater-Visum. Phase 1: Tabelle und Anzeige, kein Advisor-Login. |
| `extra_tasks` | `project_id`, `title`, `category`, `note`, `due_date`, `done`, `done_at`, `sort_order`, `page_id`, `dossier_item_id`, `file_ref_id`, `origin` (manual, ticket, import) | Zusatzarbeiten. |
| `missing_parts` | `project_id`, `page_id`, `position`, `part_number`, `description`, `quantity`, `status`, `purchase_item_id` | Fehlteile pro Seite, exportierbar. |
| `audit_log` | `project_id`, `user_id`, `entity_type`, `entity_id`, `action`, `old` (JSON), `new` (JSON), `client_change_id`, `at` | Jede Statusänderung: wer, wann, alt → neu. `client_change_id` macht den Offline-Sync idempotent. |

### 3.4 Dateien und Integrationen (Module files, integrations)

| Tabelle | Wichtige Felder | Bemerkung |
|---|---|---|
| `file_refs` | `project_id`, `provider` (gdrive, onedrive, dropbox, upload), `external_id`, `name`, `mime`, `size`, `etag_or_rev`, `web_url`, `path_hint` | Dateien werden referenziert, nicht dupliziert. |
| `integration_connections` | `user_id`, `provider` (google, microsoft, dropbox), `account_email`, `scopes`, `access_token_enc`, `refresh_token_enc`, `expires_at`, `status` (ok, needs_reconnect, revoked), `last_error` | Tokens mit AES-256-GCM und App-Schlüssel verschlüsselt. **Pro Nutzer**, nie global. |
| `project_integrations` | `project_id`, `provider`, `config` (JSON: Drive-Ordner-ID, Dropbox-Pfad, OneDrive-Share-ID, Ordnerstruktur) | Projektbezogene Ordnerwahl. |
| `sync_cursors` | `connection_id`, `scope`, `cursor`, `updated_at` | Dropbox `list_folder/continue`, Gmail `historyId`, Graph delta. |
| `manual_copies` | `project_id`, `manual_revision_id` (nullable), `doc_number`, `revision_label`, `content_hash`, `dropbox_path`, `drive_file_id`, `is_current` | Welche PDF-Fassung im Drive des Builders liegt. Weicht der Hash von der freigegebenen Revision ab → markiert, nie stillschweigend gleichgesetzt. |

### 3.5 Tickets (M2), Einkauf (M2/M3), EAS (M5) – Kurzfassung

- `organisations`, `contacts` (Stammdaten: Sling Technical, Sling Spares, Händler, Panelbauer, Bauberater, EAS-Stellen; Lieferanten mit Absender-Domains).
- `tickets` (`project_id`, `number`, `subject`, `status`, `recipient_contact_ids`, `mail_thread_id`, `last_outbound_at`, `follow_up_after_days`, `resolution`, Verknüpfungen zu `page_id`, `extra_task_id`, `missing_part_id`, `dossier_item_id`), `ticket_messages` (`direction`, `mail_message_id`, `from`, `to`, `sent_at`, `body_text`, `body_html_ref`), `ticket_attachments` (`file_ref_id`).
- `purchase_items` (Teilenummer, Beschreibung, Menge, `supplier_id`, Preis, Währung, Priorität, `blocks_page_id`, Status benötigt→angefragt→bestellt→versendet→geliefert→verbaut), `orders`, `order_items` (Teillieferungen, Rücksendungen), `shipments` (Carrier, Trackingnummer, Status, Link), `cost_entries` (Zoll, MWST, Spedition pro Sendung), `invoices` (`file_ref_id`), `mail_suggestions` (aus Mails extrahierte Vorschläge, vom Builder bestätigt).
- `eas_templates` (Version «12.34 v5.1»), `eas_template_items` (Nummer, Dokument, Formular, Verteilung aircraft_file/foca_a/foca_b/foca_c, Pflicht-Visa), `dossier_items` (pro Projekt: Status fehlt→Entwurf→beim Advisor→bei EAS→akzeptiert→unterschrieben, `builder_visa_at`, `advisor_visa_at`, Fälligkeit), `dossier_item_files`, `afm_amm_workflows` (Dokumenttyp, Zustand, `round` Zähler, OneDrive-Referenzen), `self_checkout_items`, `eas_contacts` (Stammdaten).

---

## 4. Kernlogik

### 4.1 Applicability-Engine (Varianten)

- Eine Regel hat einen JSON-Ausdruck mit dreiwertiger Logik: `true`, `false`, `unknown`.
  Beispiel: `{"all":[{"dim":"brakes","in":["beringer"]},{"dim":"brake_control","in":["toe_single","toe_dual"]}]}`.
  Operatoren: `all`, `any`, `not`, `dim/in`, `dim/eq`, `dim/is_unknown`, `build_type/eq` (je Baugruppe).
- Eine Seite **gilt**, wenn alle bestätigten Regeln mit Effekt `applies_only_if` `true` ergeben. Ist mindestens eine `unknown` und keine `false` → Seite bleibt sichtbar mit Markierung **«Variante klären»**. Ohne Regeln gilt die Seite immer.
- Effekt `qb_prebuilt`: Ist die Baugruppe als Quick Build konfiguriert und die Seite trägt `assembled_by_sling` → Status wird als «ab Werk erledigt» (not_applicable, `na_reason=quick_build`) vorgeschlagen und zählt nicht zu den zutreffenden Seiten. Generische Hinweise («must still be installed by the builder») werden nie ausgewertet.
- Vorrang: manueller Status des Builders > Konfiguration > Vorschlag. Ändert der Builder eine Option, zeigt die App vorher, welche Seiten dazukommen oder wegfallen (Diff), und schreibt nichts automatisch um, was er manuell gesetzt hat.
- Fortschritt = erledigte Seiten / zutreffende Seiten (gilt-Status `true` oder `unknown`, ohne `not_applicable`).

### 4.2 Alias-Engine

Regeln werden beim Rendern angewandt (nicht beim Import), damit die Originaltexte unverändert bleiben:
`title_display = apply(aliases in scope, title_original)`. Der Originaltext steht als Tooltip («im Handbuch: 915 iS»). Platzhalter wie `{project.engine}` werden aus der Projektkonfiguration gefüllt. Reihenfolge: engere Scope (Revision) vor weiterer (Modell). Ergebnisse werden pro Revision und Projekt gecacht.

### 4.3 Import-Pipeline (Worker-Jobs)

1. `manual.fetch` – PDF aus Dropbox/Drive/Upload in ein temporäres Verzeichnis streamen, SHA-256 bilden. Bekannter Hash → Abbruch «bereits importiert». Datei wird nach dem Lauf immer gelöscht.
2. `manual.extract` – `pdfinfo` (Seitenzahl), `pdftotext -layout` **seitenweise**. Seiten ohne Text → `ocrmypdf --skip-text` nur für Deckblatt, Revisionstabelle, Inhaltsverzeichnis und die Kopfzeile jeder Zeichnung (gerastert mit `pdftoppm -r 150`, Ausschnitt oben).
3. `manual.structure` – Inhaltsverzeichnis und Zeichnungsköpfe («PAGE n», Zeichnungsnummer, Rev, Titel) getrennt parsen und abgleichen. Massgebend ist der Zeichnungskopf. Abweichungen (Versatz, fehlende Seiten, Dubletten, falscher Flugzeugtyp im Kopf) werden als Konflikte im `import_report` gespeichert.
4. `manual.suggest` – Varianten-Hinweise (Long Range, 198L, Toe Brakes, Beringer, MATCO, Parachute, Version 2019/2020/2021/2023, Autopilot, Wig Wag) und spezifische Quick-Build-Hinweise als **unbestätigte** Regeln vorschlagen. Revisionstabelle lesen; fehlt die Deckblatt-Revision → Hinweis.
5. Review-UI (Admin): Konflikte abarbeiten, Titel für Seiten ohne Text erfassen, Regeln bestätigen, dann **freigeben** (`released`). Erst dann sichtbar.

Grosse Dateien (100–250 MB) werden gestreamt; es wird nie ein ganzes PDF in den Speicher geladen.

### 4.4 Revisionswechsel

Mapping alte → neue Revision, nie über die Seitennummer allein:
1. Zeichnungsnummer identisch (ohne Rev-Suffix) → **sicher**.
2. Sonst normalisierter Abschnittstitel (Aliase angewandt, Kleinschreibung, Sonderzeichen entfernt) gleich und Position der Seite im Abschnitt gleich → **wahrscheinlich** (wird dem Builder als «übernommen, bitte prüfen» gezeigt).
3. Sonst → **neu in Rev X – prüfen**.
Der Builder sieht die Diff-Ansicht (übernommen / prüfen / neu / entfallen), bestätigt, und erst dann werden `page_status`-Zeilen für die neue Revision angelegt. Die alten bleiben als Historie erhalten; `project_manual_revisions` zeigt auf die aktive Revision.

### 4.5 Offline-Sync

- Der Client hält pro Projekt einen Snapshot (Seiten, Status, Zusatzarbeiten) in IndexedDB.
- Jede Änderung wird lokal angewandt und mit `client_change_id` (UUID), Zeitstempel und Vorher-Wert in eine Warteschlange geschrieben.
- Der Sync-Endpunkt verarbeitet Änderungen idempotent (bereits gesehene `client_change_id` werden ignoriert) und antwortet mit dem aktuellen Serverstand. Konflikte: letzter Schreiber gewinnt pro Seite, beide Schritte stehen im Audit-Log.
- Der Service Worker cached App-Shell und statische Assets (Network-first mit Fallback), damit die App im Hangar startet.

---

## 5. Sicherheit

- Passwörter argon2id (Parameter nach OWASP), Sessions 30 Tage gleitend, Cookie `HttpOnly; Secure; SameSite=Lax`.
- Rate-Limit: 10 Loginversuche pro E-Mail und 15 min, 50 pro IP.
- E-Mail-Verifizierung und Passwort-Reset über einmalige, gehashte Tokens (System-Mail über SMTP, konfigurierbar).
- Integrations-Tokens verschlüsselt (AES-256-GCM, Schlüssel aus `APP_ENCRYPTION_KEY`), nie im Log.
- Server Actions prüfen Session **und** Projektmitgliedschaft; `proxy.ts` leitet nur um.
- Content-Security-Policy, keine Inline-Skripte ausser Nonce; Uploads werden nach MIME und Grösse geprüft.
- Audit-Log ist append-only (keine Update/Delete-Rechte für die App-Rolle, per Migration).

---

## 6. Integrationen hinter Interfaces

```ts
interface StorageProvider {            // gdrive | onedrive | dropbox
  listChildren(ref, cursor?): Promise<{items, cursor}>
  getMeta(ref): Promise<FileMeta>
  download(ref): ReadableStream        // gestreamt
  uploadResumable(target, stream, meta): Promise<FileRef>
  changes(cursor): Promise<{changes, cursor}>
}
interface MailProvider {                // gmail-api | imap-smtp (später: graph-outlook)
  send(message): Promise<{messageId, threadId}>
  fetchThread(threadId): Promise<Message[]>
  changesSince(cursor): Promise<{messages, cursor}>
}
interface TrackingProvider {            // link-only | aggregator (später)
  trackingUrl(carrier, number): string
  status?(carrier, number): Promise<TrackingStatus>
}
```

Pro Nutzer eine Verbindung pro Provider (`integration_connections`). Alle Jobs, die Fremddienste aufrufen, laufen im Worker mit Backoff und Fehlerprotokoll. Läuft ein Google-Refresh-Token ab (Testmodus, 7 Tage), setzt der Worker `status=needs_reconnect`, und die UI zeigt «Google neu verbinden».

---

## 7. Hosting und Betrieb

```
docker compose: caddy (TLS, Reverse Proxy) → web (Next.js) ; worker (pg-boss, poppler, ocrmypdf) ; db (postgres:16) ; backup (pg_dump täglich → ./backups + optional rclone nach Drive/S3)
```

- Ein `.env` mit `DATABASE_URL`, `APP_ENCRYPTION_KEY`, `SESSION_SECRET`, SMTP, OAuth-Client-IDs.
- Migrationen laufen beim Start von `web` (`drizzle-kit migrate`), Seeds per Kommando (`pnpm seed`), idempotent.
- Backups: täglicher Dump, 30 Tage Rotation, Wiederherstellung dokumentiert und getestet.
- Lokal identisch (Docker Desktop oder Podman). Wahl des Hosters: siehe Rückfragen.

---

## 8. Design

Quelle in Phase 1: das Logo «Sling Aircraft Switzerland» (schwarzer Grund, weisser Schriftzug, rotes Akzent-Element, Schweizer Fahne). Die Website slingaircraft.ch war aus der Build-Umgebung nicht erreichbar (Netzwerkrichtlinie), deshalb sind alle Farben und Schriften als **Tokens in einer Datei** (`src/styles/tokens.css`) hinterlegt und werden nach Sichtung der Website in einem Schritt angeglichen.

Tokens (Entwurf): Hintergrund Weiss `#FFFFFF`, Fläche `#F4F4F5`, Text `#111111`, Kopfleiste Schwarz `#000000`, Akzent Rot `#C00000` (Hover `#A30000`), Linien `#D4D4D8`, Status-Farben: erledigt Grün `#2E7D32`, in Arbeit Blau `#1565C0`, Problem Orange `#E65100`, trifft nicht zu Grau `#8C969F`. Typografie: Überschriften in einer schmalen, gesperrten Grotesk (wie im Logo), Fliesstext in einer gut lesbaren Sans. Dunkelmodus vorbereitet.

Bedienung: Touch-Ziele mindestens 48 px, Seiten-Chips 56 px, Kontrast AA, Bedienung mit Handschuhen (keine Hover-Only-Funktionen, keine Doppeltipps). Mobile zuerst.

---

## 9. Vorbereitet für Mehrnutzerbetrieb (nicht gebaut)

| Bereich | In Phase 1 vorhanden | Später nur ergänzen |
|---|---|---|
| Mandanten | `project_id`/`user_id` an allen Tabellen, `ProjectContext` in jedem Service, Indizes | Optional Postgres Row-Level-Security |
| Rollen | `project_members.role` mit vier Rollen, Rechteprüfung pro Aktion (`can(ctx, 'page.setStatus')`) | Einladungs-UI, Advisor-Ansicht, Registrierung freischalten |
| Login | Registrierung, Verifizierung, Reset als Server Actions implementiert, Registrierung nicht verlinkt (Feature-Flag) | Flag umlegen, 2FA-UI (Spalte vorhanden) |
| Handbücher | Freigabe-Status pro Revision, `released_by` | Mehrstufiger Freigabe-Workflow |
| Modelle | `aircraft_models` + Optionen als Daten | Seeds für Sling 2 / Sling HW |
| Integrationen | Tokens pro Nutzer, Provider-Interfaces | Google-Verifizierung, Outlook/IMAP |
| i18n | next-intl, keine Texte im Code, Labels als JSON | `en.json`, `fr.json` füllen |
| Wissensdatenbank | `tickets.resolution`, `share_anonymised` (bool, Standard false) | Freigabe-Workflow und Anzeige |

---

## 10. Teststrategie

- **Unit (Vitest)**: Applicability-Engine (alle Operatoren, Tri-State, QB), Alias-Engine (Scopes, Platzhalter), Revisions-Mapping (Zeichnungsnummer, Titel+Position, neu/entfallen), Fortschrittsrechnung, Fristenlogik EAS.
- **Service/Integration (Vitest gegen PGlite oder lokalem Postgres)**: Seeds, Import des Prototyp-Stands, Statuswechsel mit Audit-Log, Sync-Idempotenz, Rechteprüfung.
- **E2E (Playwright)**: Login, Onboarding-Wizard mit HB-YMR-Antworten, Abhaken einer Seite und eines Abschnitts, Zusatzarbeit anlegen, Offline-Abhaken mit anschliessendem Sync (Netzwerk im Browser abgeschaltet).
- Kein Meilenstein gilt als fertig ohne grüne Tests und eine Liste von «funktioniert / funktioniert nicht / ungeklärt».

---

## 11. Meilensteine

| | Umfang | Dieses Dokument |
|---|---|---|
| M1 | Login (nur Remy), Projekt HB-YMR mit vorbelegtem Onboarding, Handbuch-Stammdaten per Seed, Abhaken pro Seite/Abschnitt, Zusatzarbeiten, Fortschritt, mobil/PWA, Import des Prototyp-Stands, Audit-Log | 3.1–3.3, 4.1, 4.2, 4.5, 5, 8 |
| M2 | Tickets via Gmail, Einkaufsliste mit Statuskette | 3.5, 6 (MailProvider) |
| M3 | Bestell-Mails auslesen, Tracking, Rechnungen, Kostenübersicht | 3.5, 6 (TrackingProvider) |
| M4 | Dropbox → Drive-Sync, Import-Pipeline mit Review, Alias-Engine im Admin, Revisionswechsel mit Diff | 3.2, 3.4, 4.3, 4.4 |
| M5 | EAS-Modul mit OneDrive | 3.5 (eas), 6 |
| M6 | Export, Audit-Log-Ansicht | 3.3 |
