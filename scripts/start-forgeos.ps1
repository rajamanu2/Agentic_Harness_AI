param(
    [switch]$SkipServices,
    [switch]$Development,
    [switch]$NoRestart
)

$ErrorActionPreference = "Stop"
$ForgeRoot = Split-Path -Parent $PSScriptRoot
$PlatformRoot = Join-Path $ForgeRoot "forgeos-platform"
$DesktopRoot = Join-Path $PlatformRoot "apps\examples\desktop-app"
$CargoBin = Join-Path $env:USERPROFILE ".cargo\bin"

if (Test-Path -LiteralPath $CargoBin) {
    $env:Path = "$CargoBin;$env:Path"
}

$env:FORGEOS_ENGINE_URL = if ($env:FORGEOS_ENGINE_URL) { $env:FORGEOS_ENGINE_URL } else { "http://127.0.0.1:8797" }
$env:AGENTICA_BASE_URL = $env:FORGEOS_ENGINE_URL
$env:COMMAND_CENTER_BASE_URL = if ($env:COMMAND_CENTER_BASE_URL) { $env:COMMAND_CENTER_BASE_URL } else { "http://127.0.0.1:8080" }
$env:FORGEOS_HOME = if ($env:FORGEOS_HOME) { $env:FORGEOS_HOME } else { Join-Path $env:USERPROFILE ".forgeos" }
$env:FORGEOS_DATA_DIR = Join-Path $env:FORGEOS_HOME "data"

function Test-ForgeService([string]$Url) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    } catch {
        return $false
    }
}

function Start-ForgeService([string]$Name, [string]$FilePath, [string[]]$Arguments, [string]$WorkingDirectory, [string]$HealthUrl) {
    if (Test-ForgeService $HealthUrl) {
        Write-Host "$Name is already healthy."
        return
    }
    $LogRoot = Join-Path $env:FORGEOS_HOME "logs"
    New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
    $stdout = Join-Path $LogRoot "$Name.out.log"
    $stderr = Join-Path $LogRoot "$Name.err.log"
    $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    Set-Content -LiteralPath (Join-Path $LogRoot "$Name.pid") -Value $process.Id
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        if (Test-ForgeService $HealthUrl) {
            Write-Host "$Name started (PID $($process.Id))."
            return
        }
        if ($process.HasExited) { throw "$Name exited during startup. See $stderr" }
    }
    if (-not $NoRestart) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    throw "$Name did not become healthy. See $stderr"
}

if (-not $SkipServices) {
    Start-ForgeService "forgeos-engine" "node.exe" @("server.mjs") (Join-Path $ForgeRoot "agentic-harness") "$($env:FORGEOS_ENGINE_URL)/api/health"
    Start-ForgeService "forgeos-control-plane" (Join-Path $ForgeRoot "backend\mvnw.cmd") @("spring-boot:run") (Join-Path $ForgeRoot "backend") "$($env:COMMAND_CENTER_BASE_URL)/actuator/health"
}

if ($Development) {
    Push-Location $PlatformRoot
    try {
        & npx.cmd --yes bun@1.3.13 -F '@forgeos/code' dev
    } finally {
        Pop-Location
    }
    exit $LASTEXITCODE
}

$NativeExecutable = Join-Path $DesktopRoot "src-tauri\target\release\forgeos.exe"
if (-not (Test-Path -LiteralPath $NativeExecutable)) {
    throw "ForgeOS is not built. Run: cd forgeos-platform; npx --yes bun@1.3.13 -F @forgeos/code build:binary"
}

Start-Process -FilePath $NativeExecutable -WorkingDirectory $DesktopRoot
