#!/bin/sh
# Start des web-Containers: zuerst Migrationen (wartet auf die Datenbank), dann der Next-Server.
set -eu
cd /app
echo "[web] Migrationen anwenden …"
node dist/migrate.cjs
echo "[web] Server starten auf :${PORT:-3000}"
exec node server.js
