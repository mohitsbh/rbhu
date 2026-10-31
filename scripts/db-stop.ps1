# Stops the portable PostgreSQL server (process listening on port 5433).
$ErrorActionPreference = "SilentlyContinue"
$conn = Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 5433 }
if ($conn) {
    foreach ($c in ($conn | Select-Object -ExpandProperty OwningProcess -Unique)) {
        Stop-Process -Id $c -Force
        Write-Host "[db] stopped PID $c"
    }
} else {
    Write-Host "[db] nothing listening on 5433"
}
