#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/admisia_$STAMP.sql.gz"

docker compose exec -T db pg_dump -U "${POSTGRES_USER:-admisia}" "${POSTGRES_DB:-admisia}" | gzip > "$FILE"
chmod 600 "$FILE"

find "$BACKUP_DIR" -type f -name 'admisia_*.sql.gz' -mtime +30 -delete

echo "Backup creado: $FILE"
