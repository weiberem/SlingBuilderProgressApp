#!/bin/sh
# Schreibt die Container-Umgebung in eine Datei (busybox crond reicht sie nicht weiter),
# legt den Cron-Eintrag an und startet crond im Vordergrund. BACKUP_ON_START=1 sichert sofort.
set -eu

: "${BACKUP_CRON:=30 3 * * *}"
: "${BACKUP_KEEP_DAYS:=30}"

env | grep -E '^(PG|BACKUP_|RCLONE_|TZ=)' | sed 's/^/export /; s/=/="/; s/$/"/' > /etc/backup.env
chmod 600 /etc/backup.env

echo "${BACKUP_CRON} . /etc/backup.env && /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "[backup] Zeitplan: ${BACKUP_CRON} (TZ=${TZ:-UTC}), Aufbewahrung ${BACKUP_KEEP_DAYS} Tage, Ziel /backups"

if [ "${BACKUP_ON_START:-0}" = "1" ]; then
  /usr/local/bin/backup.sh || echo "[backup] Erstes Backup fehlgeschlagen (DB noch nicht bereit?)"
fi

exec crond -f -l 8
