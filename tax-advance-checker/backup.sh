#!/usr/bin/env bash
# גיבוי יומי — PostgreSQL + MinIO. שמור עותקים ב-backups/ (גבה גם לכונן/NAS נפרד).
set -euo pipefail
cd "$(dirname "$0")"

DATE=$(date +%F)
DIR="backups"
mkdir -p "$DIR"

# --- מסד הנתונים (היסטוריית הבדיקות) ---
docker exec tac_db pg_dump -U "${POSTGRES_USER:-tac}" "${POSTGRES_DB:-tax_advance_checker}" > "$DIR/db_$DATE.sql"

# --- קבצים שהועלו (MinIO) ---
docker run --rm --network container:tac_minio \
  -v "$(pwd)/$DIR:/backup" minio/mc sh -c "
    mc alias set m http://localhost:9000 '${MINIO_ROOT_USER:-minioadmin}' '${MINIO_ROOT_PASSWORD:-minioadmin}' &&
    mc mirror --overwrite m/${MINIO_BUCKET:-tac-files} /backup/files_$DATE
  " || echo 'MinIO backup skipped (check mc availability)'

# --- שמירת 30 גיבויים אחרונים בלבד ---
ls -1t "$DIR"/db_*.sql 2>/dev/null | tail -n +31 | xargs -r rm -f

echo "[OK] Backup complete: $DIR/db_$DATE.sql"
