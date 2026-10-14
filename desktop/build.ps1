param([switch]$NoCopy)
$ErrorActionPreference='Stop'
try {
 $taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
 $taskVersion=(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json).version
 if($taskVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Version de aplicacion invalida.' }
 $taskParent=Split-Path -Parent $taskRoot
 $taskOrganized=(Split-Path -Leaf $taskParent) -eq 'Codigo'
 $taskWorkspace=if($taskOrganized){Split-Path -Parent $taskParent}else{$taskRoot}
 $taskVersions=Join-Path $taskWorkspace $(if($taskOrganized){'Aplicaciones'}else{'aplicacion-pc'})
 $taskOutput=Join-Path $taskVersions ('v'+$taskVersion)
 $taskProgram=Join-Path $taskOutput 'Programa'
 $taskNode=Join-Path $env:ProgramFiles 'nodejs\node.exe'
 if(-not (Test-Path -LiteralPath $taskNode)) { $taskNode=(Get-Command node.exe -ErrorAction SilentlyContinue).Source }
 if(-not $taskNode) { throw 'Instala Node.js 22.12 o superior para compilar. La app compilada no lo necesita.' }
 $taskNpm=Join-Path (Split-Path -Parent $taskNode) 'npm.cmd'
 $taskToolsRoot=Join-Path $env:LOCALAPPDATA 'EstacionHidrometrica\herramientas-pc-44.7.0-26.15.3'
 $taskInstalled=Join-Path $env:LOCALAPPDATA 'EstacionHidrometrica\App-PC'
 $taskExistingExe=Join-Path $taskInstalled 'Hackeando las inundaciones.exe'
 $taskBuildExe=Join-Path $taskToolsRoot 'salida\win-unpacked\Hackeando las inundaciones.exe'
 $taskVersionExe=Join-Path $taskProgram 'Hackeando las inundaciones.exe'
 if(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -in @($taskExistingExe,$taskBuildExe,$taskVersionExe)}) { throw 'Cierra la app de monitoreo antes de compilar una nueva version.' }
 [IO.Directory]::CreateDirectory($taskToolsRoot) | Out-Null
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'tools-package.json') -Destination (Join-Path $taskToolsRoot 'package.json')
 if(-not (Test-Path -LiteralPath (Join-Path $taskToolsRoot 'node_modules\electron\dist\electron.exe')) -or -not (Test-Path -LiteralPath (Join-Path $taskToolsRoot 'node_modules\electron-builder\cli.js'))) {
  Write-Host 'Preparando herramientas oficiales de Electron. La primera compilacion requiere descargar archivos.' -ForegroundColor Cyan
  & $taskNpm install --prefix $taskToolsRoot --no-fund --no-audit
  if($LASTEXITCODE -ne 0) { throw 'No se pudieron preparar las herramientas de Windows.' }
 }
 if(-not (Test-Path -LiteralPath (Join-Path $taskToolsRoot 'node_modules\electron\dist\electron.exe'))) {
  # New npm versions may skip package install scripts; run only Electron's official installer.
  & $taskNode (Join-Path $taskToolsRoot 'node_modules\electron\install.js')
  if($LASTEXITCODE -ne 0) { throw 'No se pudo descargar el runtime oficial de Electron.' }
 }
 Set-Location -LiteralPath $taskRoot
 & $taskNpm run build
 if($LASTEXITCODE -ne 0) { throw 'No se pudo compilar la interfaz web.' }
 & $taskNode (Join-Path $PSScriptRoot 'icon.mjs')
 if($LASTEXITCODE -ne 0) { throw 'No se pudo generar el icono.' }
 # Stage only the allowlisted source and public config, never .env or kit credentials.
 $taskStage=Join-Path $taskToolsRoot ('compilacion-'+[guid]::NewGuid().ToString('N'))
 [IO.Directory]::CreateDirectory($taskStage) | Out-Null
 foreach($taskFolder in @('desktop','lib','src','config')) { [IO.Directory]::CreateDirectory((Join-Path $taskStage $taskFolder)) | Out-Null }
 foreach($taskFile in @('desktop\main.cjs','desktop\runtime.cjs','desktop\site.json','desktop\icon.png','desktop\icon.ico','server.mjs','lib\server.js','lib\email.js','src\core.js','config\public.json')) {
  Copy-Item -LiteralPath (Join-Path $taskRoot $taskFile) -Destination (Join-Path $taskStage $taskFile)
 }
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'package.json') -Destination (Join-Path $taskStage 'package.json')
 Copy-Item -LiteralPath (Join-Path $taskRoot 'dist') -Destination (Join-Path $taskStage 'dist') -Recurse
 $taskBuilderConfig=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'builder.json') -Raw | ConvertFrom-Json
 $taskBuiltOutput=Join-Path $taskToolsRoot 'salida'
 $taskBuilderConfig | Add-Member -NotePropertyName directories -NotePropertyValue @{app=$taskStage;output=$taskBuiltOutput}
 $taskBuilderConfig | Add-Member -NotePropertyName electronDist -NotePropertyValue (Join-Path $taskToolsRoot 'node_modules\electron\dist')
 $taskBuilderConfig | Add-Member -NotePropertyName electronVersion -NotePropertyValue '44.7.0'
 $taskConfigFile=Join-Path $taskToolsRoot 'builder-current.json'
 [IO.File]::WriteAllText($taskConfigFile,($taskBuilderConfig | ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
 $env:CSC_IDENTITY_AUTO_DISCOVERY='false'
 & $taskNode (Join-Path $taskToolsRoot 'node_modules\electron-builder\cli.js') --config $taskConfigFile --win --x64 --dir --publish never
 if($LASTEXITCODE -ne 0) { throw 'No se pudieron generar los ejecutables de Windows.' }
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'LEEME-PC.txt') -Destination (Join-Path $taskBuiltOutput 'win-unpacked\LEEME-PC.txt') -Force
 [IO.File]::WriteAllText((Join-Path $taskBuiltOutput 'win-unpacked\VERSION.txt'),$taskVersion,[Text.UTF8Encoding]::new($false))
 if(-not $NoCopy) {
  [IO.Directory]::CreateDirectory($taskProgram) | Out-Null
  Get-ChildItem -LiteralPath (Join-Path $taskBuiltOutput 'win-unpacked') -Force | Copy-Item -Destination $taskProgram -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'abrir-app.ps1') -Destination (Join-Path $taskOutput 'ABRIR.ps1') -Force
  $taskLauncher='@echo off'+"`r`n"+'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0ABRIR.ps1" -CarpetaVersion "%~dp0." -Version '+$taskVersion+"`r`n"+'if errorlevel 1 pause'+"`r`n"
  [IO.File]::WriteAllText((Join-Path $taskOutput 'ABRIR-ESTA-VERSION.cmd'),$taskLauncher,[Text.ASCIIEncoding]::new())
  [IO.File]::WriteAllText((Join-Path $taskOutput 'LEEME.txt'),('Version '+$taskVersion+"`r`nAbre ABRIR-ESTA-VERSION.cmd: usa una copia rapida en el disco de cada PC.`r`nLa primera apertura puede tardar mientras copia desde la USB. Las siguientes no vuelven a copiar.`r`nConserva la carpeta Programa completa y ABRIR.ps1 junto al lanzador.`r`nCierra otras versiones de la app antes de abrir esta.`r`n"),[Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText((Join-Path $taskVersions 'Actual.txt'),('v'+$taskVersion),[Text.UTF8Encoding]::new($false))
  [IO.Directory]::CreateDirectory($taskInstalled) | Out-Null
  Get-ChildItem -LiteralPath (Join-Path $taskBuiltOutput 'win-unpacked') -Force | Copy-Item -Destination $taskInstalled -Recurse -Force
 }
 Write-Host ('Aplicacion lista en: '+$(if($NoCopy){$taskBuiltOutput}else{$taskOutput})) -ForegroundColor Green
} catch { Write-Host ('Error: '+$_.Exception.Message) -ForegroundColor Red; exit 1 }
