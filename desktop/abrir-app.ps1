param([string]$Version,[string]$CarpetaVersion,[switch]$Comprobar,[switch]$Preparar)
$ErrorActionPreference='Stop'
try {
 if($CarpetaVersion) {
  $taskVersionFolder=[IO.Path]::GetFullPath($CarpetaVersion)
  if(-not $Version) {$Version=(Get-Content -LiteralPath (Join-Path $taskVersionFolder 'Programa\VERSION.txt') -Raw).Trim()}
 } else {
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
  $taskVersionFolder=Join-Path $taskVersions ('v'+$Version)
 }
 if($Version -notmatch '^\d+\.\d+\.\d+$') {throw 'Version invalida.'}
 $taskSource=Join-Path $taskVersionFolder 'Programa'
 $taskExeName='Hackeando las inundaciones.exe'
 # Reuse a complete local copy only when its marker matches the requested version.
 function Test-LocalApp([string]$Folder) {
  $taskMarker=Join-Path $Folder 'VERSION.txt'
  return ((Test-Path -LiteralPath $taskMarker) -and
   (Test-Path -LiteralPath (Join-Path $Folder $taskExeName)) -and
   (Test-Path -LiteralPath (Join-Path $Folder 'resources\app.asar')) -and
   ((Get-Content -LiteralPath $taskMarker -Raw).Trim() -eq $Version))
 }
 function Get-PackageHash([string]$File) {
  $taskStream=[IO.File]::OpenRead($File)
  $taskHasher=[Security.Cryptography.SHA256]::Create()
  try {return [Convert]::ToBase64String($taskHasher.ComputeHash($taskStream))}
  finally {$taskHasher.Dispose();$taskStream.Dispose()}
 }
 $taskInstalled=Join-Path $env:LOCALAPPDATA 'EstacionHidrometrica\App-PC'
 $taskCache=Join-Path $env:LOCALAPPDATA ('EstacionHidrometrica\Aplicaciones\v'+$Version)
 $taskSelected=if(Test-LocalApp $taskInstalled){$taskInstalled}elseif(Test-LocalApp $taskCache){$taskCache}else{$null}
 if($Comprobar) {
  Write-Output ('Version: '+$Version)
  if($taskSelected){Write-Output ('Aplicacion: '+(Join-Path $taskSelected $taskExeName))}
  else {Write-Output ('Preparar copia local desde: '+$taskSource)}
  exit 0
 }
 if(-not $taskSelected) {
  if(-not (Test-Path -LiteralPath (Join-Path $taskSource $taskExeName)) -or
   -not (Test-Path -LiteralPath (Join-Path $taskSource 'resources\app.asar'))) {throw ('No se encuentra la aplicacion completa v'+$Version+'. Compilala antes de abrirla.')}
  $taskSourceMarker=Join-Path $taskSource 'VERSION.txt'
  if((Test-Path -LiteralPath $taskSourceMarker) -and (Get-Content -LiteralPath $taskSourceMarker -Raw).Trim() -ne $Version){throw 'La version del programa de origen no coincide con la seleccionada.'}
  if(Get-CimInstance Win32_Process -Filter "name='Hackeando las inundaciones.exe'" | Where-Object {$_.ExecutablePath -eq (Join-Path $taskCache $taskExeName)}) {throw 'Cierra la copia local de esta version antes de repararla.'}
  Write-Host 'Preparando la copia rapida en esta computadora. Solo es necesario la primera vez; conserva conectada la USB.' -ForegroundColor Cyan
  [IO.Directory]::CreateDirectory($taskCache) | Out-Null
  $taskMarker=Join-Path $taskCache 'VERSION.txt'
  if(Test-Path -LiteralPath $taskMarker){Remove-Item -LiteralPath $taskMarker}
  & (Join-Path $env:SystemRoot 'System32\robocopy.exe') $taskSource $taskCache /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XF VERSION.txt | Out-Null
  if($LASTEXITCODE -ge 8){throw 'No se pudo completar la copia local. Revisa el espacio disponible y la conexion de la USB.'}
  # A completed copy must match the USB's app package before marking it usable.
  $taskSourceHash=Get-PackageHash (Join-Path $taskSource 'resources\app.asar')
  $taskCacheHash=Get-PackageHash (Join-Path $taskCache 'resources\app.asar')
  if($taskSourceHash -ne $taskCacheHash){throw 'La copia local no coincide con el programa de la USB. Vuelve a intentarlo.'}
  [IO.File]::WriteAllText($taskMarker,$Version,[Text.UTF8Encoding]::new($false))
  $taskSelected=$taskCache
 }
 $taskApp=Join-Path $taskSelected $taskExeName
 if($Preparar){Write-Output ('Aplicacion preparada: '+$taskApp);exit 0}
 Start-Process -FilePath $taskApp -WorkingDirectory $taskSelected -WindowStyle Normal
} catch {Write-Host $_.Exception.Message -ForegroundColor Red;exit 1}
