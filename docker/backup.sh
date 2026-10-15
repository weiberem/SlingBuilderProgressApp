#!/bin/sh
# Nächtlicher Dump der Datenbank (Custom-Format, komprimiert) nach /backups mit Rotation.
# Umgebung: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE (aus docker-compose), BACKUP_KEEP_DAYS,
# optional RCLONE_REMOTE (z. B. "swissbackup:sling") → Push in den entfernten Speicher.
# Wiederherstellung: siehe docs/betrieb.md.
set -eu

: "${BACKUP_DIR:=/backups}"
: "${BACKUP_KEEP_DAYS:=30}"
: "${PGDATABASE:=sling}"

stamp="$(date +%Y%m%d-%H%M%S)"
file="${BACKUP_DIR}/${PGDATABASE}-${stamp}.dump"
tmp="${file}.part"

mkdir -p "${BACKUP_DIR}"
echo "[backup] ${stamp}: pg_dump ${PGDATABASE}@${PGHOST:-db} → ${file}"
pg_dump --format=custom --compress=6 --no-owner --no-privileges --file="${tmp}" "${PGDATABASE}"
mv "${tmp}" "${file}"
echo "[backup] fertig: $(du -h "${file}" | cut -f1)"

# Rotation: alles älter als BACKUP_KEEP_DAYS Tage löschen (auch liegengebliebene .part-Dateien).
find "${BACKUP_DIR}" -name "${PGDATABASE}-*.dump" -type f -mtime "+${BACKUP_KEEP_DAYS}" -print -delete | sed 's/^/[backup] gelöscht: /'
find "${BACKUP_DIR}" -name "*.part" -type f -mmin +120 -delete

# Optional: Kopie ins entfernte Ziel (rclone-Konfiguration unter /config/rclone/rclone.conf
# oder über RCLONE_CONFIG_<REMOTE>_*-Variablen).
if [ -n "${RCLONE_REMOTE:-}" ]; then
  echo "[backup] rclone → ${RCLONE_REMOTE}"
  rclone copy "${file}" "${RCLONE_REMOTE}" --config "${RCLONE_CONFIG:-/config/rclone/rclone.conf}" 2>&1 | sed 's/^/[backup] rclone: /' || echo "[backup] rclone fehlgeschlagen"
  rclone delete "${RCLONE_REMOTE}" --min-age "${BACKUP_KEEP_DAYS}d" --config "${RCLONE_CONFIG:-/config/rclone/rclone.conf}" 2>&1 | sed 's/^/[backup] rclone: /' || true
fi
