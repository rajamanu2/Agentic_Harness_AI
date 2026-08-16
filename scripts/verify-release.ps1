param([string]$ReleaseRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) "release"))

$ErrorActionPreference = "Stop"
$resolved = (Resolve-Path -LiteralPath $ReleaseRoot).Path
$required = @("ForgeOS_0.0.13_x64-setup.exe", "ForgeOS_0.0.13_x64_en-US.msi", "forgeos.exe", "resources\forgeos-runtime\engine\forgeos-engine.exe", "resources\forgeos-runtime\control-plane\forgeos-control-plane.jar", "resources\forgeos-runtime\control-plane\jre-all\bin\javaw.exe")
foreach ($relative in $required) {
    $target = Join-Path $resolved $relative
    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Missing release artifact: $relative" }
}

$ports = 8797, 8080
foreach ($port in $ports) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is already in use; release verification requires isolated local ports." }
}

$app = Start-Process -FilePath (Join-Path $resolved "forgeos.exe") -WorkingDirectory $resolved -WindowStyle Hidden -PassThru
try {
    $engine = $false; $control = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Seconds 1
        try { $catalog = Invoke-RestMethod http://127.0.0.1:8797/api/adapters -TimeoutSec 2; $engine = $catalog.adapters.Count -ge 23 } catch {}
        try { $hello = Invoke-WebRequest http://127.0.0.1:8080/api/system/hello -UseBasicParsing -TimeoutSec 2; $control = $hello.StatusCode -eq 200 } catch {}
        if ($engine -and $control) { break }
        if ($app.HasExited) { throw "ForgeOS exited during release verification." }
    }
    $connections = Invoke-RestMethod http://127.0.0.1:8797/api/connections -TimeoutSec 20
    $connectionJson = $connections | ConvertTo-Json -Depth 8
    if (-not $engine -or -not $control -or $connections.providers.Count -lt 6) { throw "A bundled ForgeOS service did not become ready." }
    if ($connectionJson -match 'accessToken|apiKey') { throw "Connection discovery returned a prohibited secret field." }
    Get-FileHash (Join-Path $resolved "ForgeOS_0.0.13_x64-setup.exe"),(Join-Path $resolved "ForgeOS_0.0.13_x64_en-US.msi"),(Join-Path $resolved "forgeos.exe") -Algorithm SHA256
    Write-Host "ForgeOS release verification passed: desktop, 23 adapters, control plane, and 6 provider states."
} finally {
    Stop-Process -Id $app.Id -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    foreach ($port in $ports) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -ErrorAction SilentlyContinue }
    }
}
