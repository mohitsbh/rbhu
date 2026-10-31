# Initializes the portable PostgreSQL data directory once.
# Layout expected: .pg\pgsql\bin (binary distribution).
# NOTE: these MinGW-built binaries require libgcc_s_seh-1.dll in the same
# directory; if it is missing we copy it from Git for Windows, when available.
# Usage:  npm run db:init    (root)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$pgRoot = Join-Path $root ".pg"
$pgsql = Join-Path $pgRoot "pgsql"
$dataDir = Join-Path $pgRoot "data"
$bin = Join-Path $pgsql "bin"

if (-not (Test-Path (Join-Path $bin "initdb.exe"))) {
    Write-Error "Portable PostgreSQL not found under $pgRoot. See README 'Local database setup'."
}

# MinGW runtime fix (loader hangs in a modal dialog without it).
if (-not (Test-Path (Join-Path $bin "libgcc_s_seh-1.dll"))) {
    $candidates = @(
        "C:\Program Files\Git\mingw64\bin\libgcc_s_seh-1.dll",
        "C:\Program Files\Git\usr\bin\libgcc_s_seh-1.dll",
        "C:\msys64\ucrt64\bin\libgcc_s_seh-1.dll"
    )
    $src = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $src) { Write-Error "libgcc_s_seh-1.dll missing; install Git for Windows or copy the DLL into $bin" }
    Copy-Item $src (Join-Path $bin "libgcc_s_seh-1.dll")
    Write-Host "[db-init] copied libgcc_s_seh-1.dll from $src"
}

if (Test-Path (Join-Path $dataDir "PG_VERSION")) {
    Write-Host "[db-init] data directory already initialized at $dataDir"
    exit 0
}

$pwFile = Join-Path $env:TEMP "rbhu-pwfile.txt"
Set-Content -Path $pwFile -Value "RbhuDemo@123" -NoNewline

Write-Host "[db-init] initdb -> $dataDir"
& "$bin\initdb.exe" -D $dataDir -U rbhu --pwfile="$pwFile" -E UTF8 -A scram-sha-256 | Out-Null
Remove-Item $pwFile -ErrorAction SilentlyContinue

Add-Content -Path (Join-Path $dataDir "postgresql.conf") -Value "`nlisten_addresses = 'localhost'"
Write-Host "[db-init] done (user=rbhu, password=RbhuDemo@123, default port 5433 at start)"
