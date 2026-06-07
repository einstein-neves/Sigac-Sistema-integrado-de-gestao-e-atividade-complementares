@echo off
setlocal
set "ROOT=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$root = [System.IO.Path]::GetFullPath('%ROOT%');" ^
  "$zip = Join-Path $root 'SIGAC-envio.zip';" ^
  "$stage = Join-Path $env:TEMP ('SIGAC-envio-' + [guid]::NewGuid().ToString('N'));" ^
  "$excludeDirs = @('.git','node_modules','.expo','dist','build','data','exports','.sixth','tools','tmp','temp');" ^
  "$excludeFileNames = @('.env','AGENTS.md','SIGAC-envio.zip','migrate-to-remote.ps1');" ^
  "$excludePatterns = @('*.log','*.tmp','*.bak','*.sqlite','*.sqlite-*','*.db','*.session','*.sess','*.rar','*.zip','node.exe','expo-*.png','*-current.png','*-final.png');" ^
  "New-Item -ItemType Directory -Path $stage | Out-Null;" ^
  "$items = Get-ChildItem -LiteralPath $root -Force -Recurse;" ^
  "foreach ($item in $items) {" ^
  "  $relative = [System.IO.Path]::GetRelativePath($root, $item.FullName);" ^
  "  $parts = $relative -split '[\\/]';" ^
  "  if ($parts | Where-Object { $excludeDirs -contains $_ }) { continue }" ^
  "  $name = $item.Name;" ^
  "  if (-not $item.PSIsContainer -and (($excludeFileNames -contains $name) -or ($excludePatterns | Where-Object { $name -like $_ }))) { continue }" ^
  "  if ($item.PSIsContainer) { continue }" ^
  "  $dest = Join-Path $stage $relative;" ^
  "  New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null;" ^
  "  Copy-Item -LiteralPath $item.FullName -Destination $dest -Force;" ^
  "}" ^
  "if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force };" ^
  "Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force;" ^
  "Add-Type -AssemblyName System.IO.Compression.FileSystem;" ^
  "$archive = [System.IO.Compression.ZipFile]::OpenRead($zip);" ^
  "try { $entries = $archive.Entries.FullName; $bad = $entries | Where-Object { $_ -eq '.env' -or $_ -like '*/.env' -or $_ -like '.git/*' -or $_ -like '*/.git/*' -or $_ -like 'node_modules/*' -or $_ -like '*/node_modules/*' -or $_ -like '.expo/*' -or $_ -like '*/.expo/*' -or $_ -like 'dist/*' -or $_ -like '*/dist/*' -or $_ -like 'build/*' -or $_ -like '*/build/*' -or $_ -like 'data/*' -or $_ -like 'exports/*' -or $_ -like '*.log' -or $_ -like '*.zip' -or $_ -like '*.sqlite' -or $_ -like '*.sqlite-*' -or $_ -like '*.db' -or $_ -like '*.session' -or $_ -like '*.sess' }; if ($bad) { throw ('ZIP contem itens bloqueados: ' + ($bad -join ', ')) } } finally { $archive.Dispose() };" ^
  "Remove-Item -LiteralPath $stage -Recurse -Force;" ^
  "Write-Host 'Pacote gerado com sucesso:' $zip;"

if errorlevel 1 (
  echo Falha ao gerar SIGAC-envio.zip.
  exit /b 1
)

echo SIGAC-envio.zip pronto para envio.
endlocal
