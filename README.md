# Sling Builder Tracker

Web-App für Erbauer von Sling-Kitflugzeugen: Baufortschritt Seite für Seite nach den Sling
Construction Manuals, Zusatzarbeiten, Fehlteile, später Tickets, Einkauf und das EAS/BAZL-Dossier.
Mobil zuerst, als PWA installierbar und im Hangar auch ohne Netz bedienbar. Sprache: Deutsch (Schweiz).

Stand M1: Login, ein Projekt mit vorbelegter Konfiguration, Handbuch-Stammdaten aus `seed/`, Abhaken pro
Seite und Abschnitt, Zusatzarbeiten, Fortschritt, Audit-Log, PWA, Worker-Grundgerüst, Docker-Betrieb.

- Architektur und Datenmodell: [`docs/architecture.md`](docs/architecture.md)
- Betrieb (VPS, Docker Compose, Backups, Updates): [`docs/betrieb.md`](docs/betrieb.md)
- Offene Fragen: [`docs/rueckfragen.md`](docs/rueckfragen.md), Recherche: [`docs/recherche.md`](docs/recherche.md)
- Arbeitsregeln im Repo: [`CLAUDE.md`](CLAUDE.md)

## Technik

Next.js 16 (App Router, React 19, TypeScript), Tailwind CSS 4, Drizzle ORM auf PostgreSQL 16, next-intl,
pg-boss (Hintergrundjobs ohne Redis), Serwist (Service Worker), Vitest und Playwright.

## Voraussetzungen

- Node.js 22 und pnpm 10 (`corepack enable` oder `npm i -g pnpm@10`)
- PostgreSQL 16 (lokal) **oder** Docker mit Compose v2
- Für den Worker-Container: nichts weiter; PDF-Werkzeuge (poppler, ocrmypdf, Tesseract) liegen im Image.

## Lokale Entwicklung ohne Docker

```bash
pnpm install
cp .env.example .env            # DATABASE_URL, APP_ENCRYPTION_KEY (openssl rand -base64 32), SEED_ADMIN_*
createdb sling_dev && createdb sling_test
pnpm db:migrate                 # SQL-Migrationen aus drizzle/ anwenden
pnpm seed                       # Stammdaten Sling 4 TSi, erster Nutzer (SEED_ADMIN_*), Projekt
pnpm dev                        # http://localhost:3000, Login mit SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
```

Der Service Worker ist in der Entwicklung abgeschaltet; die PWA prüft man mit dem Produktionsbuild:

```bash
pnpm build && pnpm start        # baut public/sw.js (esbuild) und die App (Turbopack, standalone)
pnpm worker                     # Worker-Prozess (pg-boss) im Vordergrund
```

### Prototyp-Stand importieren

Der bisherige Stand aus dem Prototyp (Seitenstatus, Zusatzarbeiten) liegt als JSON-Export unter
`seed/hb-ymr/` und wird einmalig, idempotent importiert:

```bash
pnpm import:prototype seed/hb-ymr/prototype-export-2026-10-15.json
```

## Lokale Entwicklung mit Docker Compose

Dieselben Container wie auf dem Server (Caddy, web, worker, db, backup):

```bash
cp .env.example .env            # POSTGRES_PASSWORD und APP_ENCRYPTION_KEY setzen, DOMAIN leer lassen
docker compose up -d --build    # http://localhost (Caddy ohne TLS)
docker compose exec web node dist/migrate.cjs    # Migrationen laufen auch automatisch beim Start
docker compose logs -f web worker
```

Seed und Import laufen gegen die Container-Datenbank am einfachsten vom Host aus mit
`DATABASE_URL=postgres://sling:<POSTGRES_PASSWORD>@localhost:5432/sling pnpm seed`, wenn der Port 5432 in
`docker-compose.yml` freigegeben wird (Standard: nicht freigegeben, siehe `docs/betrieb.md`).

## Tests

```bash
pnpm typecheck && pnpm lint
pnpm test                       # Vitest: Engines + Services gegen TEST_DATABASE_URL (wird pro Lauf geleert)
pnpm test:e2e                   # Playwright: startet next dev auf Port 3105, meldet sich mit SEED_ADMIN_* an
pnpm build                      # Produktionsbuild
```

CI (`.github/workflows/ci.yml`) führt Lint, Typecheck, Vitest (PostgreSQL-Service) und Build bei jedem
Push aus; der Playwright-Smoke-Test läuft als zweiter, nicht blockierender Job.

## Struktur

```
src/app/              Routen (App Router): (auth)/login …, (app)/p/[projectId]/…, settings, offline
src/modules/<modul>/  schema.ts (Drizzle), service.ts, *-actions.ts (Server Actions), Tests daneben
  auth, projects, manuals (Applicability- und Alias-Engine), progress, audit
src/components/ui     Primitive (Button, Card, Badge, Field, ProgressBar); src/components/app App-Rahmen, SW, PWA
src/styles/tokens.css Design-Tokens (Sling Aircraft Switzerland: Schwarz, Weiss, Rot)
src/sw/sw.ts          Service Worker (Serwist), gebündelt nach public/sw.js
src/lib/              db, env, crypto, logger, mailer, format
messages/de/*.json    UI-Texte (ein Namensraum pro Datei, next-intl)
seed/                 Stammdaten (Modell, Handbücher, Optionen, Regeln, Aliase) und Projektdaten
drizzle/              SQL-Migrationen (versioniert, nie nachträglich editieren)
worker/               pg-boss-Worker (index.ts, jobs.ts)
scripts/              migrate.ts (Migrationen ohne drizzle-kit, für den Container)
docker/, Dockerfile.* Container, Caddyfile, Backup
e2e/                  Playwright
docs/                 Architektur, Betrieb, Rückfragen, Recherche
```

Grundsätze (siehe `CLAUDE.md`): nie mutmassen (Unklares heisst «ungeklärt»), keine projektspezifischen
Daten im Code, jeder Datenzugriff über einen `ProjectContext`, keine PDFs zentral speichern, keine
Texte im Code, jede Statusänderung ins Audit-Log.
