param([Parameter(Mandatory=$true)][int]$ProcesoAppId)
$ErrorActionPreference='Stop'
$taskLock=New-Object Threading.Mutex($false,'Local\TacotalpaGatewayUsbPC')
$taskOwned=$false
try {
 try {$taskOwned=$taskLock.WaitOne(0)} catch [Threading.AbandonedMutexException] {$taskOwned=$true}
 if(-not $taskOwned) {exit 0}
 $taskConfigPath=Join-Path $PSScriptRoot 'configuracion.json'
 $taskConfig=Get-Content -LiteralPath $taskConfigPath -Raw | ConvertFrom-Json
 if($taskConfig.port -notmatch '^COM[0-9]{1,3}$') {throw 'Configura el puerto del gateway.'}
 $taskLog=Join-Path $PSScriptRoot 'Conexion-USB.log'
 while(Get-Process -Id $ProcesoAppId -ErrorAction SilentlyContinue) {
  $taskPauseFile=Join-Path $PSScriptRoot 'pausa-ui.txt'
  if(Test-Path -LiteralPath $taskPauseFile) {
   try {if([int64](Get-Content -LiteralPath $taskPauseFile -Raw) -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()){Start-Sleep -Milliseconds 500;continue}} catch {}
  }
  # Runs from this PC. The USB with source code can be removed after opening.
  & (Join-Path $PSScriptRoot 'Conectar_Gateway_USB.ps1') -Puerto $taskConfig.port -Configuracion $taskConfigPath -ProcesoAppId $ProcesoAppId -Registro $taskLog
  if(-not (Get-Process -Id $ProcesoAppId -ErrorAction SilentlyContinue)) {break}
  # Retry network startup or unplugged receiver without replaying old packets.
  Start-Sleep -Seconds 5
 }
} finally {
 if($taskOwned) {$taskLock.ReleaseMutex()}
 $taskLock.Dispose()
}
