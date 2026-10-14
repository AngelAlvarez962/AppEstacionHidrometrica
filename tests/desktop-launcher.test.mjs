import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

test('launcher prepara una sola copia local y conserva la version elegida', {skip:process.platform!=='win32'},()=>{
 const root=mkdtempSync(join(tmpdir(),'hydro-launcher-'));
 const profile=join(root,'perfil'),folder=join(root,'v0.2.0'),source=join(folder,'Programa');
 const cache=join(profile,'EstacionHidrometrica','Aplicaciones','v0.2.0');
 const installed=join(profile,'EstacionHidrometrica','App-PC');
 const exe='Hackeando las inundaciones.exe';
 function packageAt(dir,version){
  mkdirSync(join(dir,'resources'),{recursive:true});
  writeFileSync(join(dir,exe),'archivo de prueba; nunca ejecutar');
  writeFileSync(join(dir,'resources','app.asar'),'paquete-'+version);
  writeFileSync(join(dir,'VERSION.txt'),version);
 }
 function run(...args){return execFileSync(join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),[
  '-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('desktop/abrir-app.ps1'),
  '-CarpetaVersion',folder,'-Version','0.2.0',...args
 ],{env:{...process.env,LOCALAPPDATA:profile},encoding:'utf8',windowsHide:true,timeout:30000});}
 try{
  packageAt(source,'0.2.0');packageAt(installed,'0.1.0');
  assert.match(run('-Comprobar'),/Preparar copia local/);
  assert.equal(existsSync(cache),false,'comprobar no copia ni abre la app');
  assert.match(run('-Preparar'),/Aplicacion preparada/);
  assert.equal(readFileSync(join(cache,'VERSION.txt'),'utf8'),'0.2.0');
  assert.equal(readFileSync(join(cache,'resources','app.asar'),'utf8'),'paquete-0.2.0');
  assert.ok(run('-Comprobar').includes(join(cache,exe)),'no usa la copia 0.1.0');
  // An already-prepared cache remains usable without rereading/copying the USB.
  rmSync(source,{recursive:true,force:true});
  assert.match(run('-Preparar'),/Aplicacion preparada/);
  assert.equal(readFileSync(join(installed,'VERSION.txt'),'utf8'),'0.1.0');
  // Incomplete caches are not accepted as a usable app.
  rmSync(join(cache,'resources','app.asar'));
  assert.match(run('-Comprobar'),/Preparar copia local/);
  assert.throws(()=>run('-Preparar'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
