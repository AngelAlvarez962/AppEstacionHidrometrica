param([switch]$NoCopy)
$ErrorActionPreference='Stop'
try {
 $taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
 $taskNode=Join-Path $env:ProgramFiles 'nodejs\node.exe'
 if(-not (Test-Path -LiteralPath $taskNode)) { $taskNode=(Get-Command node.exe -ErrorAction SilentlyContinue).Source }
 if(-not $taskNode) { throw 'Instala Node.js 22.12 o superior para compilar. La app compilada no lo necesita.' }
 $taskNpm=Join-Path (Split-Path -Parent $taskNode) 'npm.cmd'
 $taskToolsRoot=Join-Path $env:LOCALAPPDATA 'EstacionHidrometrica\herramientas-pc-44.7.0-26.15.3'
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
 foreach($taskFile in @('desktop\main.cjs','desktop\runtime.cjs','desktop\site.json','desktop\icon.png','desktop\icon.ico','server.mjs','lib\server.js','src\core.js','config\public.json')) {
  Copy-Item -LiteralPath (Join-Path $taskRoot $taskFile) -Destination (Join-Path $taskStage $taskFile)
 }
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'package.json') -Destination (Join-Path $taskStage 'package.json')
 Copy-Item -LiteralPath (Join-Path $taskRoot 'dist') -Destination (Join-Path $taskStage 'dist') -Recurse
 $taskOutput=Join-Path $taskRoot 'aplicacion-pc'
 [IO.Directory]::CreateDirectory($taskOutput) | Out-Null
 $taskBuilderConfig=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'builder.json') -Raw | ConvertFrom-Json
 $taskBuiltOutput=Join-Path $taskToolsRoot 'salida'
 $taskBuilderConfig | Add-Member -NotePropertyName directories -NotePropertyValue @{app=$taskStage;output=$taskBuiltOutput}
 $taskBuilderConfig | Add-Member -NotePropertyName electronDist -NotePropertyValue (Join-Path $taskToolsRoot 'node_modules\electron\dist')
 $taskBuilderConfig | Add-Member -NotePropertyName electronVersion -NotePropertyValue '44.7.0'
 $taskConfigFile=Join-Path $taskToolsRoot 'builder-current.json'
 [IO.File]::WriteAllText($taskConfigFile,($taskBuilderConfig | ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
 $env:CSC_IDENTITY_AUTO_DISCOVERY='false'
 & $taskNode (Join-Path $taskToolsRoot 'node_modules\electron-builder\cli.js') --config $taskConfigFile --win --x64 --publish never
 if($LASTEXITCODE -ne 0) { throw 'No se pudieron generar los ejecutables de Windows.' }
 $taskVersion=(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json).version
 foreach($taskSuffix in @('Portable','Instalador')) {
  $taskArtifact='Hackeando-Inundaciones-PC-'+$taskVersion+'-'+$taskSuffix+'.exe'
  if(-not $NoCopy) { Copy-Item -LiteralPath (Join-Path $taskBuiltOutput $taskArtifact) -Destination (Join-Path $taskOutput $taskArtifact) }
 }
 Write-Host ('Aplicacion lista en: '+$(if($NoCopy){$taskBuiltOutput}else{$taskOutput})) -ForegroundColor Green
} catch { Write-Host ('Error: '+$_.Exception.Message) -ForegroundColor Red; exit 1 }
