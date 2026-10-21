$ErrorActionPreference='Stop'
try {
 $taskLocalApp=Join-Path $env:LOCALAPPDATA 'EstacionHidrometrica\App-PC'
 $taskVersion=(Get-Content -LiteralPath (Join-Path $taskLocalApp 'VERSION.txt') -Raw).Trim()
 & (Join-Path $PSScriptRoot 'Abrir-App.ps1') -Version $taskVersion -CarpetaVersion $taskLocalApp
} catch {Write-Host 'No se pudo abrir la app local. Abre ABRIR-APP.cmd desde la USB para preparar su copia.' -ForegroundColor Red;exit 1}
