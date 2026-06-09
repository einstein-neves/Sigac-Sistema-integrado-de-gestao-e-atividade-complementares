param(
  [string]$ApiUrl = '',
  [int]$Port = 8082,
  [switch]$Tunnel
)

$ErrorActionPreference = 'Stop'

function Get-SigacLocalIp {
  $addresses = Get-NetIPConfiguration |
    Where-Object { $_.IPv4Address -and $_.NetAdapter.Status -eq 'Up' } |
    ForEach-Object { $_.IPv4Address.IPAddress } |
    Where-Object { $_ -notlike '127.*' -and $_ -notlike '169.254.*' }

  $preferred = $addresses |
    Where-Object { $_ -like '192.168.*' -or $_ -like '10.*' -or $_ -like '172.1[6-9].*' -or $_ -like '172.2[0-9].*' -or $_ -like '172.3[0-1].*' } |
    Select-Object -First 1

  if ($preferred) { return $preferred }
  return $addresses | Select-Object -First 1
}

function Get-FreePort([int]$StartPort) {
  $candidate = $StartPort
  while (Get-NetTCPConnection -LocalPort $candidate -State Listen -ErrorAction SilentlyContinue) {
    $candidate++
  }
  return $candidate
}

$ip = Get-SigacLocalIp

if (-not $ApiUrl) {
  if (Test-Path .env) {
    $envApiUrl = Select-String -Path .env -Pattern '^EXPO_PUBLIC_API_URL=(.+)$' | Select-Object -First 1
    if ($envApiUrl) {
      $ApiUrl = $envApiUrl.Matches[0].Groups[1].Value.Trim()
    }
  }

  if (-not $ip) {
    throw 'Nao foi possivel detectar um IP local. Informe manualmente: .\start-expo-go.ps1 -ApiUrl http://SEU-IP:3000'
  }

  if (-not $ApiUrl) {
    $ApiUrl = "http://$ip`:3000"
  }
}

$Port = Get-FreePort $Port
$env:EXPO_PUBLIC_API_URL = $ApiUrl
if (-not $Tunnel) {
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip
}

Write-Host "SIGAC Mobile - Expo Go"
Write-Host "API: $env:EXPO_PUBLIC_API_URL"
if ($Tunnel) {
  Write-Host "Metro host: tunnel"
} else {
  Write-Host "Metro host: $env:REACT_NATIVE_PACKAGER_HOSTNAME"
  Write-Host "Metro port: $Port"
}
Write-Host "No .env da raiz, use HOST=0.0.0.0 para o celular acessar o backend local."
Write-Host ""

if ($Tunnel) {
  npx expo start --tunnel --clear
} else {
  npx expo start --lan --clear --port $Port
}
