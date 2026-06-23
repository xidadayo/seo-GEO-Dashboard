param([Parameter(Mandatory=$true)][string]$BackupDirectory)
$ErrorActionPreference = "Stop"
$resolved = Resolve-Path $BackupDirectory
$dump = Join-Path $resolved "database.sql"
if (-not (Test-Path $dump)) { throw "database.sql not found in backup directory" }
Get-Content -Raw $dump | docker compose exec -T postgres psql -U seo_geo -d seo_geo
foreach ($name in @("uploads", "reports", "logs")) {
  $source = Join-Path $resolved $name
  if (Test-Path $source) { Copy-Item -Recurse -Force $source (Join-Path $PSScriptRoot "..\$name") }
}
Write-Output "Restore completed from: $resolved"
