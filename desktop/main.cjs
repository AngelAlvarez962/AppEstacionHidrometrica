const {app,BrowserWindow,Menu,dialog,shell}=require('electron');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {cloudUrl,sameOrigin}=require('./runtime.cjs');

app.setName('Hackeando las inundaciones');
let window,ownedServer,trustedUrl;
const root=path.resolve(__dirname,'..');
const locked=app.requestSingleInstanceLock();
if(!locked){app.quit();}else{
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.whenReady().then(start).catch(error=>{dialog.showErrorBox('No se pudo abrir el monitoreo',error.message);app.quit();});
}

async function localUrl(){
  const config=JSON.parse(await readFile(path.join(root,'config/public.json'),'utf8'));
  const url='http://127.0.0.1:8790/';
  // Reuse only this project's already-running local server.
  try{
    const response=await fetch(url+'api/config',{signal:AbortSignal.timeout(1500)});
    const existing=await response.json();
    if(existing.app!=='estacion-hidrometrica-kits'||existing.project_ref!==config.project_ref)throw Error('El puerto 8790 lo usa otra aplicación. Cierra esa aplicación y vuelve a abrir el monitoreo.');
    return url;
  }catch(error){if(error.message?.includes('El puerto 8790'))throw error;}
  process.env.PORT='8790';
  if(!process.argv.includes('--production'))process.argv.push('--production');
  const module=await import(pathToFileURL(path.join(root,'server.mjs')).href);
  ownedServer=module.server;
  if(!ownedServer.listening)await new Promise((resolve,reject)=>{ownedServer.once('listening',resolve);ownedServer.once('error',reject);});
  return url;
}

async function start(){
  const site=JSON.parse(await readFile(path.join(__dirname,'site.json'),'utf8'));
  trustedUrl=cloudUrl(site.webUrl)||await localUrl();
  window=new BrowserWindow({width:1280,height:860,minWidth:840,minHeight:620,show:false,title:'Hackeando las inundaciones · Monitoreo',backgroundColor:'#f4fafc',icon:path.join(__dirname,'icon.png'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  window.webContents.session.setPermissionRequestHandler((contents,permission,callback,details)=>callback(permission==='serial'&&contents===window.webContents&&sameOrigin(details.requestingUrl||contents.getURL(),trustedUrl)));
  window.webContents.session.setPermissionCheckHandler((contents,permission,origin)=>permission==='serial'&&contents===window.webContents&&sameOrigin(origin,trustedUrl));
  window.webContents.session.on('select-serial-port',async(event,ports,contents,callback)=>{
    event.preventDefault();
    if(contents!==window.webContents||!sameOrigin(contents.getURL(),trustedUrl)){callback('');return;}
    const compatible=ports.filter(p=>['10c4','1a86','303a'].includes(String(p.vendorId||'').toLowerCase().replace(/^0x/,''))).slice(0,8);
    if(!compatible.length){callback('');return;}
    try{
      const choice=await dialog.showMessageBox(window,{type:'question',title:'Conecta tu gateway',message:'Selecciona el puerto del gateway que conectaste.',detail:'La app sólo usará el puerto que elijas. Si no lo reconoces, cancela y desconecta otros receptores.',buttons:[...compatible.map(p=>p.portName+' · '+(p.displayName||'Receptor USB')),'Cancelar'],defaultId:compatible.length,cancelId:compatible.length,noLink:true});
      callback(compatible[choice.response]?.portId||'');
    }catch{callback('');}
  });
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(!sameOrigin(url,trustedUrl))event.preventDefault();});
  window.webContents.on('will-redirect',(event,url)=>{if(!sameOrigin(url,trustedUrl))event.preventDefault();});
  window.webContents.on('page-title-updated',event=>event.preventDefault());
  window.once('ready-to-show',()=>{window.show();console.log('DESKTOP_READY');});
  window.webContents.on('did-fail-load',(_event,code,description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3)dialog.showErrorBox('No se pudo cargar el monitoreo','Comprueba tu conexión y vuelve a abrir la aplicación. '+description);});
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'Monitoreo',submenu:[{label:'Abrir versión para navegador',click:()=>shell.openExternal(trustedUrl)},{role:'reload',label:'Actualizar pantalla'},{type:'separator'},{role:'quit',label:'Cerrar'}]},
    {label:'Editar',submenu:[{role:'undo',label:'Deshacer'},{role:'redo',label:'Rehacer'},{type:'separator'},{role:'cut',label:'Cortar'},{role:'copy',label:'Copiar'},{role:'paste',label:'Pegar'},{role:'selectAll',label:'Seleccionar todo'}]},
    {label:'Ver',submenu:[{role:'resetZoom',label:'Tamaño normal'},{role:'zoomIn',label:'Acercar'},{role:'zoomOut',label:'Alejar'},{role:'togglefullscreen',label:'Pantalla completa'}]},
    {label:'Ayuda',submenu:[{label:'Acerca de esta versión',click:()=>dialog.showMessageBox(window,{type:'info',title:'Hackeando las inundaciones',message:'Monitoreo hidrométrico para PC',detail:'Versión '+app.getVersion()+'\nEsta versión de prueba consulta Supabase por Internet. Las lecturas reales requieren un gateway vinculado. El modo demo usa datos de ejemplo.'})}]}
  ]));
  await window.loadURL(trustedUrl);
}

app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(ownedServer){ownedServer.closeAllConnections();ownedServer.close();}});
