param([string]$Version,[switch]$Comprobar)
$ErrorActionPreference='Stop'
try {
 $taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
 $taskParent=Split-Path -Parent $taskRoot
 $taskVersions=if((Split-Path -Leaf $taskParent) -eq 'Codigo') {
  Join-Path (Split-Path -Parent $taskParent) 'Aplicaciones'
 } else { Join-Path $taskRoot 'aplicacion-pc' }
 if(-not $Version) {
  $taskCurrent=Join-Path $taskVersions 'Actual.txt'
  if(Test-Path -LiteralPath $taskCurrent) {$Version=(Get-Content -LiteralPath $taskCurrent -Raw).Trim().TrimStart('v')}
  else {$Version=(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json).version}
 }
 if($Version -notmatch '^\d+\.\d+\.\d+$') {throw 'Version invalida.'}
 $taskApp=Join-Path $taskVersions ('v'+$Version+'\Programa\Hackeando las inundaciones.exe')
 if(-not (Test-Path -LiteralPath $taskApp)) {throw ('No se encuentra la aplicacion v'+$Version+'. Compilala antes de abrirla.')}
 # Reuse the fast local copy only when it is explicitly the requested version.
 $taskInstalled=Join-Path $env:LOCALAPPDATA 'EstacionHidrometrica\App-PC'
 $taskInstalledVersion=Join-Path $taskInstalled 'VERSION.txt'
 $taskInstalledApp=Join-Path $taskInstalled 'Hackeando las inundaciones.exe'
 if((Test-Path -LiteralPath $taskInstalledVersion) -and (Test-Path -LiteralPath $taskInstalledApp)) {
  if((Get-Content -LiteralPath $taskInstalledVersion -Raw).Trim() -eq $Version) {$taskApp=$taskInstalledApp}
 }
 if($Comprobar) {Write-Output ('Version: '+$Version);Write-Output ('Aplicacion: '+$taskApp);exit 0}
 Start-Process -FilePath $taskApp -WindowStyle Normal
} catch {Write-Host $_.Exception.Message -ForegroundColor Red;exit 1}
