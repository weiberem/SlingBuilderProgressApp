# Betrieb – Sling Builder Tracker

Stand: 16.10.2026. **Zielbetrieb laut Entscheid vom 16.10.2026: Vercel + verwaltetes PostgreSQL in der EU**
(Abschnitt 0). Der Docker-Compose-Stack (Abschnitte 1–7) bleibt die gleichwertige Alternative für einen
VPS oder den lokalen Betrieb; lokal und auf dem Server laufen dieselben Container.

## 0. Vercel + EU-Postgres (Zielbetrieb)

Noch nicht eingerichtet; Reihenfolge, sobald die Zugänge vorliegen:

1. **Datenbank:** Supabase-Projekt in der Region `eu-central-1` (Frankfurt) anlegen (oder Neon/Vercel Postgres EU).
   Verbindungs-URL mit Pooler (Port 6543, `?pgbouncer=true`) als `DATABASE_URL`, die direkte URL (Port 5432) als
   `DIRECT_DATABASE_URL` für Migrationen. Supabase sichert täglich (Pro-Plan, 7 Tage); zusätzlich bleibt der manuelle
   JSON-Export in der App (Dashboard → «Datensicherung», Erinnerung alle 3 Tage).
2. **Vercel-Projekt** aus dem GitHub-Repo, Framework Next.js, Build `pnpm build`, Node 22. Umgebungsvariablen wie in
   Abschnitt 2 (ohne `DOMAIN`, `POSTGRES_*`, `BACKUP_*`, `RCLONE_*`), zusätzlich `DATABASE_URL`, `DIRECT_DATABASE_URL`.
   Migrationen vor dem Deploy: `pnpm db:migrate` als Build-Schritt (`vercel-build`) oder manuell von einem Rechner mit `DIRECT_DATABASE_URL`.
3. **Domain:** in Vercel die Subdomain hinzufügen (z. B. `tracker.slingaircraft.ch`; Name mit Remy festlegen) und beim
   DNS-Anbieter von `slingaircraft.ch` einen CNAME auf `cname.vercel-dns.com` setzen. Zertifikat kommt von Vercel.
4. **Worker:** PDF-Import/OCR (M4) und Mail-Sync (M2) brauchen einen dauerhaft laufenden Prozess mit poppler/ocrmypdf;
   dafür den `worker`-Container aus `docker/` auf einem kleinen Host (Fly.io, Railway, VPS) mit derselben `DATABASE_URL`
   betreiben. Kurze, periodische Jobs können alternativ über Vercel Cron laufen. Entscheid mit M2.
5. **System-Mails:** Absender noch offen (Rückfrage 8): Resend/Brevo mit Domain-Verifizierung (SPF/DKIM für
   `slingaircraft.ch`) oder SMTP von `info@slingaircraft.ch`. Ohne SMTP werden Reset-Mails nur geloggt.

Grenzen auf Vercel: Server Actions und Route Handler laufen als Functions (Zeitlimit, kein Dateisystem, keine
Hintergrundprozesse); die Offline-Synchronisation und alle M1-Funktionen sind davon nicht betroffen.

```
Internet ──443──▶ caddy (TLS, Reverse-Proxy) ──▶ web (Next.js, Migrationen beim Start)
                                                 worker (pg-boss, poppler, ocrmypdf)
                                                 db (PostgreSQL 16, Volume db_data)
                                                 backup (pg_dump nachts → ./backups, 30 Tage, optional rclone)
```

## 1. Server vorbereiten

1. Ubuntu 24.04 LTS, Benutzer mit sudo, SSH-Schlüssel, `ufw allow 22,80,443/tcp` und `ufw allow 443/udp` (HTTP/3).
2. Docker Engine und Compose v2 installieren: <https://docs.docker.com/engine/install/ubuntu/>.
3. DNS: A/AAAA-Record der Domain (z. B. `tracker.example.ch`) auf den Server. Caddy holt das Zertifikat
   automatisch von Let's Encrypt, sobald Port 80/443 erreichbar sind.
4. Code holen: `git clone <repo> /opt/sling && cd /opt/sling` (Updates später mit `git pull`).

## 2. Konfiguration (.env)

`cp .env.example .env` und setzen:

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `DOMAIN` | ja (Server) | Hostname für Caddy, z. B. `tracker.example.ch`. Leer → `http://localhost` ohne TLS (lokal). |
| `APP_URL` | ja | Öffentliche URL, z. B. `https://tracker.example.ch` (Links in Mails, OAuth-Callbacks). |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | ja | Datenbank im Container. `POSTGRES_PASSWORD` hat keinen Standard. Daraus bildet Compose `DATABASE_URL` für web und worker. |
| `APP_ENCRYPTION_KEY` | ja | 32 Bytes base64 (`openssl rand -base64 32`). Verschlüsselt Integrations-Tokens. **Nie ändern** und **mit sichern**: ohne Schlüssel sind gesicherte Tokens wertlos. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | für `pnpm seed` | Erster Nutzer. Passwort nach dem ersten Login in den Einstellungen ändern. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | für Passwort-Reset | Ohne SMTP werden Reset-Mails nur geloggt. |
| `LOG_LEVEL` | nein | `info` (Standard), `debug` zur Fehlersuche. |
| `TZ` | nein | Zeitzone für Backup-Cron (Standard `Europe/Zurich`). |
| `BACKUP_CRON`, `BACKUP_KEEP_DAYS`, `BACKUP_ON_START` | nein | Backup-Zeitplan (Standard 03:30), Aufbewahrung (30 Tage), sofortiges Backup beim Start (`1`). |
| `RCLONE_REMOTE`, `RCLONE_CONFIG_DIR` | nein | Entferntes Backup-Ziel (`<remote>:<pfad>`), Ordner mit `rclone.conf`. |

`.env` ist in `.gitignore` und wird nie ins Image gebaut; Compose reicht sie zur Laufzeit an die
Container. Rechte: `chmod 600 .env`.

## 3. Erster Start

```bash
docker compose build                 # web (Next standalone), worker (Node + poppler + ocrmypdf), backup
docker compose up -d                 # Reihenfolge: db → web (führt Migrationen aus) → worker, caddy, backup
docker compose logs -f web           # "Migrationen angewendet" … "Ready"
```

Stammdaten und ersten Nutzer säen (einmalig, idempotent). Die Datenbank ist nur im Compose-Netz
erreichbar, deshalb per Tunnel aus einem temporären Node-Container im selben Netz:

```bash
docker compose run --rm --no-deps -v "$PWD":/src -w /src \
  -e DATABASE_URL="postgres://sling:$(grep ^POSTGRES_PASSWORD .env | cut -d= -f2)@db:5432/sling" \
  --entrypoint sh web -c "npm i -g pnpm@10.28.0 >/dev/null && pnpm install --frozen-lockfile && pnpm seed && pnpm import:prototype seed/hb-ymr/prototype-export-2026-10-15.json"
```

Alternativ für Wartungsarbeiten Port 5432 vorübergehend freigeben (`ports: ["127.0.0.1:5432:5432"]` beim
Dienst `db`) und vom Host mit `DATABASE_URL=postgres://sling:<pw>@localhost:5432/sling pnpm seed` arbeiten.

Danach: `https://<DOMAIN>` öffnen, mit `SEED_ADMIN_EMAIL` anmelden, Passwort ändern, in den Einstellungen
«Als App installieren» prüfen (Android: Knopf, iOS: Teilen → Zum Home-Bildschirm).

## 4. Updates

```bash
cd /opt/sling
git pull
docker compose build web worker      # Images neu bauen
docker compose up -d                 # ersetzt die Container; web wendet neue Migrationen beim Start an
docker compose logs --since 5m web worker
docker image prune -f                # alte Images aufräumen
```

Migrationen sind vorwärts-kompatibel und laufen vor dem Start des Servers (`dist/migrate.cjs`, Drizzle-
Migrator auf `drizzle/`). Schlägt eine Migration fehl, startet `web` nicht und der alte Stand der Daten
bleibt unverändert; Log prüfen, Problem beheben, `docker compose up -d web`.

Von Hand: `docker compose exec web node dist/migrate.cjs`.

## 5. Backups

**Manuelle Sicherung durch den Erbauer (gilt immer, Entscheid 16.10.2026):** Dashboard → «Datensicherung» →
«Projekt als JSON exportieren». Die Datei (`HB-YMR_Export_<Datum>.json`) enthält Konfiguration, Status aller Seiten,
Zusatzarbeiten, Fehlteile und den Verlauf, keine PDFs; sie gehört ins Drive des Erbauers. Die App erinnert auf dem
Dashboard, sobald der letzte Export 3 Tage zurückliegt.

Bei Docker-Betrieb zusätzlich: Der Dienst `backup` erstellt täglich (`BACKUP_CRON`, Standard 03:30 Zeitzone `TZ`) einen Dump im
PostgreSQL-Custom-Format nach `./backups/<db>-<datum>.dump` und löscht Dumps, die älter als
`BACKUP_KEEP_DAYS` Tage sind. Zusätzlich sichern:

- **`.env`** (enthält `APP_ENCRYPTION_KEY`!) an einem zweiten Ort, z. B. im Passwort-Manager.
- Optional **rclone** in einen entfernten Speicher (Infomaniak Swiss Backup, S3, SFTP …):
  `rclone config` lokal ausführen, die entstandene `rclone.conf` nach `docker/rclone/` legen (Rechte 600),
  `RCLONE_REMOTE=<remote>:<bucket-oder-pfad>` in `.env`, `docker compose up -d backup`.
  Der Dump wird nach dem Schreiben kopiert; entfernte Dumps werden nach `BACKUP_KEEP_DAYS` Tagen gelöscht.

Sofort ein Backup auslösen: `docker compose exec backup /usr/local/bin/backup.sh`.

PDFs liegen nie auf dem Server (nur Hashes und Struktur), Fotos im Drive des Builders; die Datenbank ist
der einzige Zustand, der gesichert werden muss.

### Wiederherstellung (und vierteljährlicher Test)

```bash
# 1. Dump wählen
ls -lh backups/
# 2. In eine Test-Datenbank einspielen (zerstört nichts)
docker compose exec -T db createdb -U sling sling_restore_test
docker compose exec -T db pg_restore -U sling -d sling_restore_test --no-owner --no-privileges < backups/sling-YYYYMMDD-HHMMSS.dump
docker compose exec -T db psql -U sling -d sling_restore_test -c "select count(*) as seiten_status from page_status;"
docker compose exec -T db dropdb -U sling sling_restore_test
```

Echte Wiederherstellung (Datenverlust oder neuer Server):

```bash
docker compose stop web worker
docker compose exec -T db psql -U sling -d postgres -c "drop database sling;" -c "create database sling;"
docker compose exec -T db pg_restore -U sling -d sling --no-owner --no-privileges < backups/sling-YYYYMMDD-HHMMSS.dump
docker compose start web worker
```

Auf einem neuen Server: Repo klonen, `.env` aus der Sicherung einspielen (gleicher
`APP_ENCRYPTION_KEY`), `docker compose up -d db`, Dump wie oben einspielen, dann `docker compose up -d`.

## 6. Logs und Diagnose

```bash
docker compose ps                              # Zustand und Healthchecks
docker compose logs -f --tail=200 web          # Next.js (JSON-Zeilen von pino, Request-Fehler)
docker compose logs -f --tail=200 worker       # pg-boss: "pg-boss gestartet", Job-Ergebnisse
docker compose logs -f caddy                   # Zugriffe, Zertifikate
docker compose logs backup                     # "[backup] … fertig"
docker compose exec db psql -U sling -d sling  # SQL-Konsole; Jobs: select * from pgboss.job order by created_on desc limit 20;
```

Log-Rotation von Docker einschalten (`/etc/docker/daemon.json`):
`{"log-driver":"json-file","log-opts":{"max-size":"20m","max-file":"5"}}`, danach `systemctl restart docker`.

Typische Fälle:

| Symptom | Prüfen |
|---|---|
| `web` startet nicht, Log «Datenbank noch nicht erreichbar» | `docker compose logs db`, `POSTGRES_PASSWORD` in `.env` geändert? Dann Volume `db_data` passt nicht mehr zum Passwort. |
| Kein Zertifikat | DNS zeigt auf den Server? Port 80 und 443 offen? `docker compose logs caddy`. |
| App zeigt alte Fassung nach Update | Der Service Worker lädt neue Versionen beim nächsten Öffnen; `sw.js` wird nie gecacht (Header in `next.config.ts`). Im Zweifel Seite neu laden. |
| Worker führt nichts aus | `docker compose logs worker`; Tabelle `pgboss.schedule` zeigt den Zeitplan (`maintenance.cleanup-sessions`, täglich 03:15). |

## 7. Sicherheit und Pflege

- Nur Caddy ist von aussen erreichbar (80/443). `web`, `worker`, `db` liegen im internen Compose-Netz.
- Container laufen als unprivilegierte Nutzer; Images enthalten keine Secrets.
- Betriebssystem-Updates: `unattended-upgrades` aktivieren; Docker-Images regelmässig neu bauen
  (`docker compose build --pull`), damit Basis-Images (Node, Alpine, Debian) aktuell sind.
- Sessions laufen nach 30 Tagen ab; der Worker räumt abgelaufene Sessions täglich auf.
- Vierteljährlich: Wiederherstellung testen (Abschnitt 5), `.env`-Sicherung prüfen, Speicherplatz
  (`df -h`, `du -sh backups/`).
