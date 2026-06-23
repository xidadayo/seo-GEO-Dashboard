$ErrorActionPreference = "Stop"

function Read-DotEnv {
  param([Parameter(Mandatory = $true)][string]$Path)

  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) {
      continue
    }

    $parts = $trimmed.Split("=", 2)
    if ($parts.Count -ne 2) {
      continue
    }

    $value = $parts[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$parts[0].Trim()] = $value
  }

  return $values
}

function ConvertTo-WslPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  if ($Path -match "^([A-Za-z]):\\(.*)$") {
    $drive = $Matches[1].ToLowerInvariant()
    $tail = $Matches[2] -replace "\\", "/"
    return "/mnt/$drive/$tail"
  }

  return $Path
}

function Required {
  param(
    [Parameter(Mandatory = $true)]$Values,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $value = $Values[$Name]
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing $Name in .env. See .env.example for LOG_SYNC_* settings."
  }
  return $value
}

$envPath = Join-Path (Get-Location) ".env"
$config = Read-DotEnv $envPath

$hostName = Required $config "LOG_SYNC_HOST"
$userName = Required $config "LOG_SYNC_USER"
$remotePath = Required $config "LOG_SYNC_REMOTE_PATH"
$localDir = $config["LOG_SYNC_LOCAL_DIR"]
if ([string]::IsNullOrWhiteSpace($localDir)) {
  $localDir = "D:\real-server-logs\nginx"
}

$sshKey = $config["LOG_SYNC_SSH_KEY"]
$port = $config["LOG_SYNC_PORT"]
if ([string]::IsNullOrWhiteSpace($port)) {
  $port = "22"
}

New-Item -ItemType Directory -Force -Path $localDir | Out-Null

$wslLocalDir = ConvertTo-WslPath $localDir
$remote = "${userName}@${hostName}:${remotePath}"
$sshArgs = "-p $port -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
if (-not [string]::IsNullOrWhiteSpace($sshKey)) {
  $sshArgs = "$sshArgs -i $(ConvertTo-WslPath $sshKey)"
}

$command = "mkdir -p '$wslLocalDir' && rsync -az --partial --append-verify -e ""ssh $sshArgs"" '$remote' '$wslLocalDir/'"

Write-Host "Syncing logs from $remote to $localDir ..."
wsl -e sh -lc $command
if ($LASTEXITCODE -ne 0) {
  throw "Log sync failed with exit code $LASTEXITCODE"
}

Write-Host "Log sync complete."
