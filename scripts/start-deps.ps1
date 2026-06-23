$ErrorActionPreference = "Stop"

$services = @("postgres", "redis")

function Test-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $FilePath @Arguments 2>&1 | ForEach-Object { Write-Host $_ }
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    throw "$FilePath exited with code $exitCode"
  }
}

function ConvertTo-WslPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  if ($Path -notmatch "^([A-Za-z]):\\(.*)$") {
    throw "Only drive-letter Windows paths can be translated automatically: $Path"
  }

  $drive = $Matches[1].ToLowerInvariant()
  $tail = $Matches[2] -replace "\\", "/"
  return "/mnt/$drive/$tail"
}

if (Test-Command "docker") {
  Write-Host "Starting dependencies with Windows Docker..."
  Invoke-Checked "docker" (@("compose", "up", "-d") + $services)
  exit 0
}

if (-not (Test-Command "wsl")) {
  throw "Docker was not found on Windows, and WSL is not available. Install Docker or enable WSL Docker."
}

$windowsPath = (Get-Location).Path
$wslPath = ConvertTo-WslPath $windowsPath
$quotedWslPath = "'" + ($wslPath -replace "'", "'\''") + "'"
$serviceList = $services -join " "
$command = "cd $quotedWslPath && docker compose up -d $serviceList"

Write-Host "Starting dependencies with Docker inside WSL..."
Invoke-Checked "wsl" @("-e", "sh", "-lc", $command)
