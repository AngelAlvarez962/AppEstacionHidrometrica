$ErrorActionPreference='Stop'
try {
 $taskProject=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
 $taskPublicPath=Join-Path $taskProject 'config\public.json'
 $taskPublic=Get-Content -LiteralPath $taskPublicPath -Raw | ConvertFrom-Json
 $taskConfig=Join-Path $PSScriptRoot 'configuracion.json'
 if(-not (Test-Path -LiteralPath $taskConfig)) {throw 'Falta la asociacion personal del gateway en esta PC.'}
 $taskPrivate=Join-Path $env:LOCALAPPDATA ('EstacionHidrometrica\'+$taskPublic.project_ref+'\.env.local')
 if(-not (Test-Path -LiteralPath $taskPrivate)) {throw 'Esta PC no tiene su perfil privado de desarrollo. No copiarlo a compradores.'}
 $taskLocal=Join-Path $env:LOCALAPPDATA 'EstacionHidrometrica\Gateway-USB'
 [IO.Directory]::CreateDirectory($taskLocal) | Out-Null
 foreach($taskFile in @('Conectar_Gateway_USB.ps1','Supervisor_Gateway_USB.ps1','Abrir-Tacotalpa.ps1','configuracion.json')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $taskFile) -Destination (Join-Path $taskLocal $taskFile) -Force
 }
 Copy-Item -LiteralPath $taskPublicPath -Destination (Join-Path $taskLocal 'public.json') -Force
 Copy-Item -LiteralPath (Join-Path $taskProject 'desktop\abrir-app.ps1') -Destination (Join-Path $taskLocal 'Abrir-App.ps1') -Force
 $taskShortcutPath=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Tacotalpa - monitoreo.lnk'
 $taskShell=New-Object -ComObject WScript.Shell
 $taskShortcut=$taskShell.CreateShortcut($taskShortcutPath)
 $taskShortcut.TargetPath=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
 $taskShortcut.Arguments='-NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+(Join-Path $taskLocal 'Abrir-Tacotalpa.ps1')+'"'
 $taskShortcut.WorkingDirectory=$taskLocal
 $taskShortcut.IconLocation=Join-Path $env:LOCALAPPDATA 'EstacionHidrometrica\App-PC\Hackeando las inundaciones.exe'
 $taskShortcut.Description='Abre el monitoreo y conecta el gateway USB personal mientras la app permanece abierta.'
 $taskShortcut.Save()
 Write-Output 'Puente USB preparado en esta PC. No se copio ninguna clave a la USB.'
} catch {Write-Host $_.Exception.Message -ForegroundColor Red;exit 1}
