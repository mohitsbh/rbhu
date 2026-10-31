# Starts the portable PostgreSQL cluster on port 5433 (if not running).
# Spawns postgres.exe directly (pg_ctl's child processes proved unstable in
# some environments); stop with scripts/db-stop.ps1.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$pgRoot = Join-Path $root ".pg"
$bin = Join-Path $pgRoot "pgsql\bin"
$dataDir = Join-Path $pgRoot "data"
$pgPort = 5433

if (-not (Test-Path (Join-Path $bin "postgres.exe"))) { Write-Error "Portable PostgreSQL not found. Run scripts/db-init first." }

function Test-PgReady {
    $client = New-Object Net.Sockets.TcpClient
    try { $client.Connect("localhost", $pgPort); return $true } catch { return $false } finally { $client.Dispose() }
}

if (-not (Test-PgReady)) {
    Write-Host "[db] starting PostgreSQL on port $pgPort..."
    $logOut = Join-Path $pgRoot "postgres-stdout.log"
    $logErr = Join-Path $pgRoot "pgsql.log"
    Start-Process -FilePath (Join-Path $bin "postgres.exe") `
        -ArgumentList "-D", "`"$dataDir`"", "-p", "$pgPort" `
        -WindowStyle Hidden `
        -RedirectStandardOutput $logOut -RedirectStandardError $logErr | Out-Null
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-PgReady) { break }
    }
}
if (-not (Test-PgReady)) { Write-Error "[db] PostgreSQL did not become reachable on port $pgPort (see .pg\pgsql.log)" }

# Create application database once (node + pg, since minimal package has no psql)
node (Join-Path $PSScriptRoot "db-create.mjs")
Write-Host "[db] ready at postgresql://rbhu:***@localhost:$pgPort/rbhu_platform"
