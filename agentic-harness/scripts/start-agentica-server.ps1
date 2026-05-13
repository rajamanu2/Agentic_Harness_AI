$ErrorActionPreference = "Stop"

$project = Split-Path -Parent $PSScriptRoot
$workspace = Split-Path -Parent $project
$apacheRoot = Join-Path $workspace ".runtime\apache-full\Apache24"
$apacheExe = Join-Path $apacheRoot "bin\httpd.exe"
$apacheConf = Join-Path $apacheRoot "conf\agentica-httpd.conf"
$logDir = Join-Path $workspace ".runtime-logs"
$port = 8088
$apiPort = 8797

function To-ApachePath($value) {
  return $value.Replace("\", "/")
}

$ip = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object -First 1 -ExpandProperty IPAddress

if (-not $ip) {
  $ip = "127.0.0.1"
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $apacheRoot "logs") | Out-Null

Push-Location $project
try {
  npm run build

  $apiPids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -eq $apiPort } |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($id in $apiPids) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }

  $env:PORT = [string]$apiPort
  Start-Process -FilePath "node.exe" `
    -ArgumentList @("server.mjs") `
    -WorkingDirectory $project `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "agentica-api-$apiPort.out.log") `
    -RedirectStandardError (Join-Path $logDir "agentica-api-$apiPort.err.log")

  $serverRoot = To-ApachePath $apacheRoot
  $documentRoot = To-ApachePath (Join-Path $project "dist")
  $config = @"
ServerRoot "$serverRoot"
Listen 0.0.0.0:$port
ServerName ${ip}:$port
PidFile "logs/agentica-httpd.pid"

LoadModule authz_core_module modules/mod_authz_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule dir_module modules/mod_dir.so
LoadModule mime_module modules/mod_mime.so
LoadModule log_config_module modules/mod_log_config.so
LoadModule alias_module modules/mod_alias.so
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule headers_module modules/mod_headers.so

TypesConfig conf/mime.types
DirectoryIndex index.html
ErrorLog "logs/agentica-error.log"
CustomLog "logs/agentica-access.log" common
LogLevel warn
DocumentRoot "$documentRoot"

<Directory "$documentRoot">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/api/
    RewriteCond %{REQUEST_URI} !^/artifacts/
    RewriteCond %{REQUEST_URI} !^/live-projects/
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</Directory>

ProxyRequests Off
ProxyPreserveHost On
ProxyPass "/api/" "http://127.0.0.1:$apiPort/api/"
ProxyPassReverse "/api/" "http://127.0.0.1:$apiPort/api/"
ProxyPass "/artifacts/" "http://127.0.0.1:$apiPort/artifacts/"
ProxyPassReverse "/artifacts/" "http://127.0.0.1:$apiPort/artifacts/"
ProxyPass "/live-projects/" "http://127.0.0.1:$apiPort/live-projects/"
ProxyPassReverse "/live-projects/" "http://127.0.0.1:$apiPort/live-projects/"
"@
  Set-Content -Path $apacheConf -Value $config -Encoding UTF8

  & $apacheExe -t -f $apacheConf

  $apachePids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -eq $port } |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($id in $apachePids) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }

  $apacheLaunch = "Set-Location -LiteralPath '$($apacheRoot.Replace("'", "''"))'; & '$($apacheExe.Replace("'", "''"))' -f '$($apacheConf.Replace("'", "''"))'"
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $apacheLaunch) `
    -WorkingDirectory $apacheRoot `
    -WindowStyle Hidden

  Start-Sleep -Seconds 3
  Write-Host "Agentica is live at http://${ip}:$port/"
  Write-Host "If another device cannot open it, allow inbound TCP port $port in Windows Firewall."
} finally {
  Pop-Location
}
