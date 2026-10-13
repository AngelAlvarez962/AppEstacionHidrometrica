import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {spawn} from 'node:child_process';
import {loadEnvFile} from 'node:process';
import {makeHandler} from './lib/server.js';
const production=process.argv.includes('--production');
const root=fileURLToPath(new URL('.',import.meta.url)),dist=resolve(root,'dist');
try{const config=JSON.parse(await readFile(resolve(root,'config/public.json'),'utf8'));process.env.SUPABASE_URL ||= config.url;if(config.key)process.env.SUPABASE_PUBLISHABLE_KEY ||= config.key;}catch(_){/* Vercel uses its environment variables. */}
// npm and the USB launchers use the same private profile on each Windows PC.
if(process.platform==='win32'&&!process.env.SUPABASE_SECRET_KEY&&process.env.LOCALAPPDATA){
  const ref=/^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(process.env.SUPABASE_URL||'')?.[1];
  if(ref){try{loadEnvFile(resolve(process.env.LOCALAPPDATA,'EstacionHidrometrica',ref,'.env.local'));}catch(_){/* The app explains missing configuration. */}}
}
const vite=production?null:await (await import('vite')).createServer({root,server:{middlewareMode:true},appType:'spa'});
const handlers={'/api/config':makeHandler('config'),'/api/kits':makeHandler('kits'),'/api/device':makeHandler('device')};
export const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(handlers[pathname]){
    res.status=code=>{res.statusCode=code;return res};res.json=value=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value))};
    let size=0,raw='';try{for await(const chunk of req){size+=chunk.length;if(size>16384){res.status(413).json({error:'Solicitud demasiado grande.'});return}raw+=chunk.toString('utf8')}req.body=raw?JSON.parse(raw):{};}catch(_){res.status(400).json({error:'JSON inválido.'});return}
    await handlers[pathname](req,res);return;
  }
  if(vite){vite.middlewares(req,res);return}
  let path;
  try{path=resolve(dist,'.'+decodeURIComponent(pathname));}catch(_){res.writeHead(400);res.end();return}
  if(path!==dist&&!path.startsWith(dist+sep)){res.writeHead(404);res.end();return}
  if(path===dist)path=resolve(dist,'index.html');
  try{const content=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(content);}catch(_){res.writeHead(404);res.end('No encontrado')}
});
const port=Number(process.env.PORT||8790);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Puerto local inválido.');
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'El puerto '+port+' ya está ocupado. Usa la ventana que está abierta o cambia PORT en .env.local.':error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
  const url='http://127.0.0.1:'+port;
  console.log('Monitoreo de kits: '+url+'\nDeja esta ventana abierta. Para terminar, cierra la ventana.');
  if(process.argv.includes('--open')&&process.platform==='win32')spawn('powershell.exe',['-NoLogo','-NoProfile','-Command',"Start-Process '"+url+"'"],{windowsHide:true,stdio:'ignore'}).on('error',()=>console.log('Abre la dirección anterior en tu navegador.'));
});
