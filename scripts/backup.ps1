$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dir = Join-Path $PSScriptRoot "..\backups\$stamp"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
docker compose exec -T postgres pg_dump -U seo_geo seo_geo | Set-Content -Encoding utf8 (Join-Path $dir "database.sql")
foreach ($name in @("uploads", "reports", "logs")) {
  $source = Join-Path $PSScriptRoot "..\$name"
  if (Test-Path $source) { Copy-Item -Recurse -Force $source (Join-Path $dir $name) }
}
Write-Output "Backup created: $dir"
