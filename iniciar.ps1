param([switch]$Configurar,[switch]$Desarrollo)
$ErrorActionPreference='Stop'
try {
 $taskRoot=$PSScriptRoot
 $taskConfigPath=Join-Path $taskRoot 'config\public.json'
 $taskConfig=Get-Content -LiteralPath $taskConfigPath -Raw | ConvertFrom-Json
 $taskNode=Join-Path $env:ProgramFiles 'nodejs\node.exe'
 if(-not (Test-Path -LiteralPath $taskNode)) { $taskNode=(Get-Command node.exe -ErrorAction SilentlyContinue).Source }
 if(-not $taskNode) { throw 'Instala Node.js 22.12 o superior desde https://nodejs.org y vuelve a abrir este archivo.' }
 $taskVersion=[version]((& $taskNode -p 'process.versions.node').Trim())
 if($taskVersion -lt [version]'22.12.0') { throw 'Se necesita Node.js 22.12 o superior.' }
 if($taskConfig.project_ref -notmatch '^[a-z]{20}$') { throw 'Referencia de proyecto invalida.' }
 $taskPrivateFolder=Join-Path $env:LOCALAPPDATA ('EstacionHidrometrica\'+$taskConfig.project_ref)
 $taskPrivateFile=Join-Path $taskPrivateFolder '.env.local'
 if($Configurar) {
  Write-Host 'CONEXION CON SUPABASE' -ForegroundColor Cyan
  Write-Host ('Proyecto: '+$taskConfig.project_name)
  Write-Host 'Las claves privadas se guardan solo en esta computadora, fuera de la USB.'
  if(-not $taskConfig.key) {
   $taskPublic=Read-Host 'Pega la clave publishable (sb_publishable_...)'
   if($taskPublic -notmatch '^sb_publishable_[A-Za-z0-9_-]+$') { throw 'Usa la clave publishable publica del proyecto nuevo.' }
   $taskConfig.key=$taskPublic
   [IO.File]::WriteAllText($taskConfigPath,($taskConfig | ConvertTo-Json),[Text.UTF8Encoding]::new($false))
  }
  $taskSecure=Read-Host 'Pega la clave secret (sb_secret_...). No se mostrara al escribir' -AsSecureString
  $taskPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecure)
  try { $taskSecret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer) }
  if($taskSecret -notmatch '^sb_secret_[A-Za-z0-9_-]+$') { throw 'Usa la clave secret del proyecto nuevo.' }
  [IO.Directory]::CreateDirectory($taskPrivateFolder) | Out-Null
  [IO.File]::WriteAllText($taskPrivateFile,('SUPABASE_SECRET_KEY='+$taskSecret),[Text.UTF8Encoding]::new($false))
  $taskSecret=''
  Write-Host 'Conexion guardada. Abre ABRIR-MONITOREO.cmd para probar el acceso.' -ForegroundColor Green
  exit 0
 }
 Set-Location -LiteralPath $taskRoot
 if(-not $Desarrollo) {
  try {
   $taskRunning=Invoke-RestMethod -Uri 'http://127.0.0.1:8790/api/config' -TimeoutSec 2
   if($taskRunning.app -eq 'estacion-hidrometrica-kits' -and $taskRunning.project_ref -eq $taskConfig.project_ref -and $taskRunning.configured) {
    Write-Host 'La aplicacion ya esta abierta. Se abrira su pagina en el navegador.'
    Start-Process 'http://127.0.0.1:8790/'
    exit 0
   }
  } catch { }
 }
 if($Desarrollo) {
  if(-not (Test-Path -LiteralPath (Join-Path $taskRoot 'node_modules\vite'))) {
   $taskNpm=Join-Path (Split-Path -Parent $taskNode) 'npm.cmd'
   & $taskNpm ci
   if($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
  }
  & $taskNode ('--env-file-if-exists='+$taskPrivateFile) 'server.mjs' '--open'
 } else {
  & $taskNode ('--env-file-if-exists='+$taskPrivateFile) 'server.mjs' '--production' '--open'
 }
 if($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} catch { Write-Host ('Error: '+$_.Exception.Message) -ForegroundColor Red; exit 1 }
