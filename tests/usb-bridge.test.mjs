import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const ps=join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');

test('USB acepta solo el alias confirmado y rechaza datos malformados sin abrir COM', {skip:process.platform!=='win32'},()=>{
 const dir=mkdtempSync(join(tmpdir(),'hydro-usb-parser-'));
 try {
  for(const node of ['RIO_01','RIO_02']){
   const config=join(dir,'config.json');
   writeFileSync(config,JSON.stringify({station_serial:'EST-1234567890ABCDEF',legacy_node_id:node,sensor_validated:false}));
   const output=execFileSync(ps,['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('firmware/practica-cubeta/Conectar_Gateway_USB.ps1'),'-Configuracion',config,'-ProbarParser'],{encoding:'utf8',windowsHide:true,timeout:15000});
   assert.match(output,/OK: trama real/);
  }
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('los scripts de USB y arranque tienen sintaxis PowerShell válida', {skip:process.platform!=='win32'},()=>{
 const files=['desktop/abrir-app.ps1',...readdirSync('firmware/practica-cubeta').filter(f=>f.endsWith('.ps1')).map(f=>'firmware/practica-cubeta/'+f)];
 for(const file of files){
  const script="$e=$null;[void][Management.Automation.Language.Parser]::ParseFile('"+resolve(file).replaceAll("'","''")+"',[ref]$null,[ref]$e);if($e.Count){throw 'Error de sintaxis'}";
  execFileSync(ps,['-NoProfile','-Command',script],{windowsHide:true,timeout:15000});
 }
});
