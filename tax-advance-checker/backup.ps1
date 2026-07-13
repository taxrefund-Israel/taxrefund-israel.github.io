# גיבוי יומי ל-Windows Server — PostgreSQL + MinIO.
# הרצה ב-Task Scheduler פעם ביום. גבה את תיקיית backups\ גם לכונן/NAS נפרד.
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$date = Get-Date -Format "yyyy-MM-dd"
$dir = Join-Path $PSScriptRoot "backups"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

# טען משתני סביבה מ-.env (אם קיים)
$pgUser = "tac"; $pgDb = "tax_advance_checker"
if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match "^POSTGRES_USER=(.+)$") { $pgUser = $Matches[1] }
    if ($_ -match "^POSTGRES_DB=(.+)$")   { $pgDb   = $Matches[1] }
  }
}

# --- גיבוי מסד הנתונים (היסטוריית הבדיקות) ---
$dbFile = Join-Path $dir "db_$date.sql"
docker exec tac_db pg_dump -U $pgUser $pgDb | Out-File -FilePath $dbFile -Encoding utf8
Write-Host "[OK] Database backup: $dbFile"

# --- גיבוי קבצים (MinIO) ---
$filesDir = Join-Path $dir "files_$date"
try {
  docker run --rm --network container:tac_minio -v "${filesDir}:/backup" minio/mc sh -c `
    "mc alias set m http://localhost:9000 minioadmin minioadmin && mc mirror --overwrite m/tac-files /backup"
  Write-Host "[OK] Files backup: $filesDir"
} catch { Write-Host "[skip] MinIO backup — בדוק זמינות mc" }

# --- שמירת 30 גיבויים אחרונים בלבד ---
Get-ChildItem $dir -Filter "db_*.sql" | Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 30 | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "[OK] Backup complete for $date"
