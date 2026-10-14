param([string]$Puerto='COM3',[switch]$SoloLectura,[switch]$ProbarParser)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition -eq 'Core') {
 $taskLegacyArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath,'-Puerto',$Puerto)
 if($SoloLectura) {$taskLegacyArgs+='-SoloLectura'}
 if($ProbarParser) {$taskLegacyArgs+='-ProbarParser'}
 & (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') @taskLegacyArgs
 exit $LASTEXITCODE
}
$taskConfig=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'configuracion.json') -Raw | ConvertFrom-Json

function Convert-GatewayLine([string]$Line) {
 if($Line.Length -gt 192 -or $Line -notmatch '^RX:\s*(?<node>EST-[A-F0-9]{16}|RIO_[0-9]{2}),(?<distance>[0-9]+(?:\.[0-9]+)?),(?<status>OK|ERR_CABLE|ERR_CORTO|SIN_ECO|MUY_CERCA|FUERA_RANGO|ERR_DESBORDE),(?<packet>[0-9]+)\s*\|\s*RSSI:\s*(?<rssi>-?[0-9]+)\s*dBm\s*$') {return $null}
 $taskMatch=$Matches.Clone()
 if($taskMatch.node -ne $taskConfig.station_serial -and $taskMatch.node -ne $taskConfig.legacy_node_id) {return $null}
 $taskDistance=0.0;$taskPacket=0L;$taskRssi=0
 if(-not [double]::TryParse($taskMatch.distance,[Globalization.NumberStyles]::AllowDecimalPoint,[Globalization.CultureInfo]::InvariantCulture,[ref]$taskDistance) -or $taskDistance -gt 10000) {return $null}
 if(-not [long]::TryParse($taskMatch.packet,[ref]$taskPacket) -or $taskPacket -gt 9007199254740991L) {return $null}
 if(-not [int]::TryParse($taskMatch.rssi,[ref]$taskRssi) -or $taskRssi -lt -200 -or $taskRssi -gt 0) {return $null}
 return [PSCustomObject]@{distance_cm=$taskDistance;sensor_status=$taskMatch.status;packet=$taskPacket;rssi=$taskRssi}
}

if($ProbarParser) {
 $taskValid=Convert-GatewayLine 'RX: RIO_01,54.3,OK,18 | RSSI: -77 dBm'
 if(-not $taskValid -or $taskValid.distance_cm -ne 54.3 -or $taskValid.packet -ne 18) {throw 'No se reconoce la trama de la practica'}
 foreach($taskBad in @('RX: RIO_02,54.3,OK,18 | RSSI: -77 dBm','RX: RIO_01,NaN,OK,18 | RSSI: -77 dBm','RX: RIO_01,54.3,OK,18 | RSSI: -250 dBm','RX: RIO_01,54.3,OK,99999999999999999999 | RSSI: -77 dBm')) {
  if($null -ne (Convert-GatewayLine $taskBad)) {throw 'Se acepto una trama invalida o de otra estacion'}
 }
 Write-Output 'OK: trama real, distancia decimal, contador, RSSI y rechazo de otras estaciones.'
 exit 0
}

if($Puerto -notmatch '^COM[0-9]{1,3}$') {throw 'Usa el puerto COM de tu gateway.'}
$taskReader=$null;$taskHeaders=$null;$taskDeviceHash=$null
try {
 if(-not $SoloLectura -and $taskConfig.sensor_validated) {
  # Developer-PC bridge only. The Supabase secret remains in this PC's profile.
  $taskProject=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
  $taskPublic=Get-Content -LiteralPath (Join-Path $taskProject 'config\public.json') -Raw | ConvertFrom-Json
  $taskPrivate=Join-Path $env:LOCALAPPDATA ('EstacionHidrometrica\'+$taskPublic.project_ref+'\.env.local')
  $taskSecretLine=@(Get-Content -LiteralPath $taskPrivate | Where-Object {$_ -match '^SUPABASE_SECRET_KEY='})
  if($taskSecretLine.Count -ne 1) {throw 'Configura primero la conexion privada de esta computadora.'}
  $taskSecret=$taskSecretLine[0].Substring('SUPABASE_SECRET_KEY='.Length).Trim()
  if($taskSecret -notmatch '^sb_secret_[A-Za-z0-9_-]+$') {throw 'Clave de conexion no valida.'}
  $taskHeaders=@{apikey=$taskSecret;'Content-Type'='application/json'}
  $taskBase=$taskPublic.url+'/rest/v1/'
  $taskStation=@(Invoke-RestMethod -Uri ($taskBase+'kit_stations?id=eq.'+$taskConfig.station_id+'&deleted_at=is.null&select=id,kit_id,gateway_id,setup_pending,serial,bed_height,capacity_height,yellow_alert,red_alert') -Headers $taskHeaders -UserAgent 'EstacionHidrometrica-USB/0.2.0' -TimeoutSec 10)
  if($taskStation.Count -ne 1 -or $taskStation[0].setup_pending -or $taskStation[0].gateway_id -ne $taskConfig.gateway_id -or $taskStation[0].serial -ne $taskConfig.station_serial) {throw 'La estacion no esta configurada con este gateway.'}
  foreach($taskField in @('bed_height','capacity_height','yellow_alert','red_alert')) {
   if($null -eq $taskStation[0].$taskField -or [Math]::Abs([double]$taskStation[0].$taskField-[double]$taskConfig.$taskField) -gt 0.01) {throw 'La calibracion de la app no coincide con la practica. Actualiza ambas antes de publicar.'}
  }
  $taskKit=@(Invoke-RestMethod -Uri ($taskBase+'kit_kits?id=eq.'+$taskStation[0].kit_id+'&select=owner_id') -Headers $taskHeaders -UserAgent 'EstacionHidrometrica-USB/0.2.0' -TimeoutSec 10)
  if($taskKit.Count -ne 1 -or $taskKit[0].owner_id -ne $taskConfig.owner_id) {throw 'No corresponde al propietario configurado para esta practica.'}
  $taskKey=@(Invoke-RestMethod -Uri ($taskBase+'kit_gateway_keys?gateway_id=eq.'+$taskConfig.gateway_id+'&revoked_at=is.null&select=token_hash') -Headers $taskHeaders -UserAgent 'EstacionHidrometrica-USB/0.2.0' -TimeoutSec 10)
  if($taskKey.Count -ne 1 -or $taskKey[0].token_hash -notmatch '^[0-9a-f]{64}$') {throw 'El gateway no tiene una credencial activa.'}
  $taskDeviceHash=$taskKey[0].token_hash
 }
 if(-not ('HydroUsbReader' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO.Ports;
using System.Text;
public class HydroUsbLine {
 public string Text; public DateTime Received;
 public HydroUsbLine(string text) { Text=text; Received=DateTime.UtcNow; }
}
public sealed class HydroUsbReader : IDisposable {
 private SerialPort port; private object sync=new object(); private string pending="";
 private Queue<HydroUsbLine> lines=new Queue<HydroUsbLine>(); private bool failed;
 public bool Failed { get { lock(sync) { return failed; } } }
 public HydroUsbReader(string name) {
  port=new SerialPort(name,115200,Parity.None,8,StopBits.One);
  port.Encoding=Encoding.ASCII;port.ReadBufferSize=65536;port.DtrEnable=false;port.RtsEnable=false;
  port.DataReceived+=Receive;port.Open();
 }
 private void Receive(object sender,SerialDataReceivedEventArgs args) {
  try { lock(sync) {
   pending+=port.ReadExisting();int pos;
   while((pos=pending.IndexOf('\n'))>=0) {
    string line=pending.Substring(0,pos).Trim();pending=pending.Substring(pos+1);
    if(line.Length>0 && line.Length<=192) { lines.Enqueue(new HydroUsbLine(line));while(lines.Count>100)lines.Dequeue(); }
   }
   if(pending.Length>512)pending="";
  } } catch { lock(sync) { failed=true; } }
 }
 public HydroUsbLine Take() { lock(sync) { return lines.Count==0?null:lines.Dequeue(); } }
 public void Dispose() { port.DataReceived-=Receive;port.Close();port.Dispose(); }
}
'@
 }
 $taskReader=New-Object HydroUsbReader $Puerto
 Write-Host ('Gateway conectado: '+$Puerto+' a 115200 baudios.') -ForegroundColor Cyan
 if(-not $taskDeviceHash) {Write-Host 'SOLO DIAGNOSTICO: falta confirmar el eco al fondo. No se envian datos a la nube.' -ForegroundColor Yellow}
 else {Write-Host 'Lecturas reales hacia EST-000001. Deja abierta tambien tu aplicacion.' -ForegroundColor Green}
 Write-Host 'Para terminar: Ctrl+C o cerrar esta ventana. Cierra este lector antes de cargar firmware.'
 $taskNextAttempt=[DateTime]::MinValue
 while(-not $taskReader.Failed) {
  $taskLast=$null;$taskLine=$taskReader.Take()
  while($null -ne $taskLine) {
   $taskParsed=Convert-GatewayLine $taskLine.Text
   if($null -ne $taskParsed -and ([DateTime]::UtcNow-$taskLine.Received).TotalSeconds -lt 5) {$taskLast=$taskParsed}
   $taskLine=$taskReader.Take()
  }
  if($null -eq $taskLast) {Start-Sleep -Milliseconds 30;continue}
  $taskDistanceText=$taskLast.distance_cm.ToString('0.0',[Globalization.CultureInfo]::InvariantCulture)
  Write-Host ('USB: '+$taskDistanceText+' cm | '+$taskLast.sensor_status+' | RSSI '+$taskLast.rssi)
  if(-not $taskDeviceHash -or [DateTime]::UtcNow -lt $taskNextAttempt) {continue}
  $taskBody=@{p_hash=$taskDeviceHash;p_station_serial=$taskConfig.station_serial;p_distance=$taskLast.distance_cm;p_status=$taskLast.sensor_status;p_packet=$taskLast.packet;p_rssi=$taskLast.rssi} | ConvertTo-Json -Compress
  try {
   Invoke-RestMethod -Uri ($taskBase+'rpc/kit_ingest') -Method Post -Headers $taskHeaders -UserAgent 'EstacionHidrometrica-USB/0.2.0' -Body $taskBody -TimeoutSec 8 | Out-Null
   Write-Host 'Guardada en tu aplicacion.' -ForegroundColor Green
  } catch {
   Write-Host 'No se pudo guardar. Se sigue recibiendo USB; reintento con lecturas recientes en 10 s.' -ForegroundColor Yellow
   $taskNextAttempt=[DateTime]::UtcNow.AddSeconds(10)
  }
 }
 throw 'Se interrumpio la conexion USB. Revisa el cable y vuelve a abrir el lector.'
} catch {Write-Host $_.Exception.Message -ForegroundColor Red;exit 1}
finally {if($taskReader){$taskReader.Dispose()};$taskDeviceHash=$null;$taskHeaders=$null}
