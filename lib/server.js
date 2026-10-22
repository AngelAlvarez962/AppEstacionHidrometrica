import {createHash,randomBytes} from 'node:crypto';
import {calibration,text,uuid,validCode,sensorStates} from '../src/core.js';
import {emailConfigured,deliverAlerts} from './email.js';
import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
export const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (status,message) => Object.assign(Error(message),{status});
export function environment(env=process.env) {
  const url = String(env.SUPABASE_URL||'').replace(/\/$/,'');
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const role=key=>{try{return JSON.parse(Buffer.from(String(key).split('.')[1],'base64url').toString()).role}catch(_){return null}};
  const safePublic=publicKey?.startsWith('sb_publishable_')||role(publicKey)==='anon';
  const safeSecret=secretKey?.startsWith('sb_secret_')||role(secretKey)==='service_role';
  return {url,publicKey,secretKey,configured:Boolean(/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && safePublic && safeSecret)};
}
export function publicConfig(env=process.env) { const cfg=environment(env); return {app:'estacion-hidrometrica-kits',project_ref:cfg.url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/)?.[1]||null,configured:cfg.configured,emailConfigured:emailConfigured(env),url:cfg.configured?cfg.url:null,key:cfg.configured?cfg.publicKey:null}; }
export async function processEmailQueue(env=process.env,fetcher=fetch){const cfg=environment(env);if(cfg.configured)await deliverAlerts(database(cfg,fetcher,null,true),{env,fetcher})}
function tokenFrom(req) {
  const header=req.headers.authorization;
  if(typeof header!=='string'||!/^Bearer [A-Za-z0-9_.-]{20,4096}$/.test(header))throw fail(401,'Inicia sesión para continuar.');
  return header.slice(7);
}
function input(req) {
  if(!String(req.headers['content-type']||'').startsWith('application/json'))throw fail(415,'Envía JSON.');
  if(req.headers['sec-fetch-site']==='cross-site')throw fail(403,'Origen no permitido.');
  const raw=req.body;
  try { const body=typeof raw==='string'?JSON.parse(raw):raw;
    if(!body||Array.isArray(body)||typeof body!=='object'||JSON.stringify(body).length>16384)throw Error();
    return body;
  } catch(_) {throw fail(400,'Solicitud inválida.');}
}
function database(cfg, fetcher, token, privileged=false) {
  return async function(route,method='GET',body) {
    const key=privileged?cfg.secretKey:cfg.publicKey;
    const headers={apikey:key,'Content-Type':'application/json',Prefer:route.includes('on_conflict=')?'resolution=merge-duplicates,return=representation':'return=representation'};
    if(!privileged)headers.Authorization='Bearer '+token;
    else if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
    let response;
    try {response=await fetcher(cfg.url+'/rest/v1/'+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});} catch(_){throw fail(503,'No se pudo contactar con la base de datos.');}
    if(!response.ok){
      const problem=await response.json().catch(()=>({}));
      if(problem.message?.includes('DEVICE_NOT_ALLOWED'))throw fail(403,'Gateway o estación no autorizados.');
      if(problem.message?.includes('ADMIN_REQUIRED'))throw fail(403,'Se requiere administración.');
      if(problem.message?.includes('ENTITY_NOT_OWNED'))throw fail(403,'La entidad debe pertenecer al propietario de la estación.');
      if(problem.message?.includes('GATEWAY_NOT_OWNED'))throw fail(403,'Selecciona un gateway de la misma cuenta que la estación.');
      if(problem.message?.includes('GATEWAY_CHANGED'))throw fail(409,'El gateway guardado cambió en otra ventana. Actualiza antes de continuar.');
      if(problem.message?.includes('GATEWAY_CONFIRM_REQUIRED'))throw fail(409,'Confirma si deseas cambiar al nuevo gateway.');
      if(problem.message?.includes('SETUP_EXPIRED'))throw fail(409,'La configuración venció o no fue confirmada por el equipo. Vuelve a conectar el USB.');
      if(problem.code==='23505')throw fail(409,'Ya existe un elemento con ese nombre.');
      if(problem.code==='23503')throw fail(400,'La entidad o estación ya no está disponible.');
      if(response.status===401)throw fail(401,'La sesión venció. Vuelve a entrar.');
      throw fail(503,'No se pudo completar la operación. Revisa la configuración de la plataforma.');
    }
    const raw=await response.text();return raw?JSON.parse(raw):null;
  };
}
async function verifiedUser(cfg,fetcher,token) {
  let response;
  try {response=await fetcher(cfg.url+'/auth/v1/user',{headers:{apikey:cfg.publicKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});}catch(_){throw fail(503,'No se pudo verificar la sesión.');}
  if(!response.ok)throw fail(401,'La sesión no es válida. Vuelve a entrar.');
  const user=await response.json();
  if(!uuid(user.id)||!user.email_confirmed_at)throw fail(403,'Confirma tu correo antes de usar tus equipos.');
  return user;
}
export function makeHandler(kind,{env=process.env,fetcher=fetch}={}) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    try {
      if(kind==='config'){if(req.method!=='GET')throw fail(405,'Método no permitido.');return res.status(200).json(publicConfig(env));}
      const cfg=environment(env);if(!cfg.configured)throw fail(503,'Esta versión aún necesita conectar Supabase. Puedes explorar la demo.');
      if(kind==='device') {
        if(req.method!=='POST')throw fail(405,'Método no permitido.');
        const token=tokenFrom(req),body=input(req);
        if(!/^GW_[a-f0-9]{64}$/.test(token))throw fail(401,'Credencial de gateway inválida.');
        if(!/^EST-[A-F0-9]{16}$/.test(body.station_serial)||!sensorStates.has(body.sensor_status)||typeof body.distance_cm!=='number'||!Number.isFinite(body.distance_cm)||body.distance_cm<0||body.distance_cm>10000||!Number.isSafeInteger(body.packet)||body.packet<0||!Number.isInteger(body.rssi)||body.rssi<-200||body.rssi>0)throw fail(400,'Medición inválida.');
        const service=database(cfg,fetcher,null,true);
        const id=await service('rpc/kit_ingest','POST',{p_hash:hash(token),p_station_serial:body.station_serial,p_distance:body.distance_cm,p_status:body.sensor_status,p_packet:body.packet,p_rssi:body.rssi});
        await deliverAlerts(service,{env,fetcher});
        return res.status(201).json({received:true,id});
      }
      if(!['GET','POST','PATCH','DELETE'].includes(req.method))throw fail(405,'Método no permitido.');
      const token=tokenFrom(req),user=await verifiedUser(cfg,fetcher,token);
      const db=database(cfg,fetcher,token);
      if(req.method==='GET'){
        const snapshot=await db('rpc/kit_snapshot','POST',{});
        snapshot.emailConfigured=emailConfigured(env);
        if(snapshot.admin)snapshot.inventory=await database(cfg,fetcher,null,true)('kit_kits?select=id,serial,friendly_code,kind,created_at,claimed_at,owner_id&order=created_at.desc&limit=100');
        else {delete snapshot.adminEntities;delete snapshot.adminAssignments;}
        return res.status(200).json(snapshot);
      }
      const body=input(req);
      if(body.action==='guide'&&req.method==='PATCH'){
        if(typeof body.completed!=='boolean')throw fail(400,'Preferencia inválida.');
        await db('kit_profiles?user_id=eq.'+user.id,'PATCH',{guide_completed:body.completed});
        return res.status(200).json({ok:true});
      }
      if(body.action==='remember-gateway'&&req.method==='POST'){
        if(!uuid(body.id)||(body.expected!==null&&!uuid(body.expected))||typeof body.confirm!=='boolean')throw fail(400,'Gateway inválido.');
        const stations=body.station_ids??[];
        if(!Array.isArray(stations)||stations.length>100||stations.some(id=>!uuid(id))||new Set(stations).size!==stations.length)throw fail(400,'Selección de estaciones inválida.');
        await db('rpc/kit_connect_gateway','POST',{p_gateway:body.id,p_expected:body.expected,p_confirm:body.confirm,p_stations:stations});
        return res.status(200).json({ok:true});
      }
      if(['usb-lease','gateway-prepare','gateway-finish','usb-reading'].includes(body.action)&&req.method==='POST'){
        if(!uuid(body.id))throw fail(400,'Gateway inválido.');
        // Read through user RLS, and require ownership even for administrators.
        const gateways=await db('kit_gateways?id=eq.'+body.id+'&select=id,kit_id');
        const owned=gateways?.[0]&&await db('kit_kits?id=eq.'+gateways[0].kit_id+'&owner_id=eq.'+user.id+'&select=id');
        if(!owned?.length)throw fail(403,'Selecciona un gateway de tu cuenta.');
        if(body.action==='usb-lease'){
          // Local legacy reader yields only while the signed-in UI renews its lease.
          if(process.platform==='win32'&&process.env.LOCALAPPDATA){
            const folder=join(process.env.LOCALAPPDATA,'EstacionHidrometrica','Gateway-USB');
            await mkdir(folder,{recursive:true});
            await writeFile(join(folder,'pausa-ui.txt'),body.release?'0':String(Date.now()+45000),'utf8');
          }
          return res.status(200).json({ok:true});
        }
        const stations=await db('kit_stations?gateway_id=eq.'+body.id+'&deleted_at=is.null&select=id,serial,node_label,setup_pending');
        const service=database(cfg,fetcher,null,true);
        if(body.action==='usb-reading'){
          if(!stations?.some(s=>s.serial===body.station_serial&&s.node_label===body.node&&!s.setup_pending))throw fail(403,'La estación no está vinculada a este gateway.');
          if(!sensorStates.has(body.sensor_status)||typeof body.distance_cm!=='number'||!Number.isFinite(body.distance_cm)||body.distance_cm<0||body.distance_cm>10000||!Number.isSafeInteger(body.packet)||body.packet<0||!Number.isInteger(body.rssi)||body.rssi<-200||body.rssi>0)throw fail(400,'Medición inválida.');
          const keys=await service('kit_gateway_keys?gateway_id=eq.'+body.id+'&revoked_at=is.null&select=token_hash');
          if(!keys?.[0])throw fail(409,'Este gateway necesita configurarse.');
          await service('rpc/kit_ingest','POST',{p_hash:keys[0].token_hash,p_station_serial:body.station_serial,p_distance:body.distance_cm,p_status:body.sensor_status,p_packet:body.packet,p_rssi:body.rssi});
          return res.status(201).json({received:true});
        }
        if(body.action==='gateway-finish'){
          if(!uuid(body.ticket)||!/^\w{64}$/.test(body.proof||''))throw fail(400,'Confirmación inválida.');
          // Also bind the ticket to the selected gateway, not just the account.
          const pending=await service('kit_gateway_pending?gateway_id=eq.'+body.id+'&ticket=eq.'+body.ticket+'&owner_id=eq.'+user.id+'&select=ticket');
          if(!pending?.length)throw fail(409,'Vuelve a iniciar la configuración del gateway.');
          await service('rpc/kit_finish_gateway','POST',{p_owner:user.id,p_ticket:body.ticket,p_proof:body.proof});
          return res.status(200).json({ok:true});
        }
        if(!/^ESP32-[A-F0-9]{12}$/.test(body.hardware||''))throw fail(400,'Conecta un gateway con firmware compatible.');
        if(!stations?.length||stations.length>8||stations.some(s=>s.setup_pending||!/^[-A-Za-z0-9_]{1,32}$/.test(s.node_label))||new Set(stations.map(s=>s.node_label)).size!==stations.length)throw fail(409,'Configura primero las estaciones y usa un nombre de radio distinto para cada una (máximo ocho).');
        const deviceToken='GW_'+randomBytes(32).toString('hex'),nonce=randomBytes(16).toString('hex');
        const rows=await service('kit_gateway_pending?on_conflict=gateway_id','POST',{gateway_id:body.id,owner_id:user.id,token_hash:hash(deviceToken),proof:hash(deviceToken+':'+nonce),hardware_hint:body.hardware,expires_at:new Date(Date.now()+600000).toISOString()});
        return res.status(200).json({ticket:rows[0].ticket,nonce,token:deviceToken,url:cfg.url,key:cfg.publicKey,mapping:stations.map(s=>({node:s.node_label,serial:s.serial}))});
      }
      if(body.action==='email-preference'&&req.method==='PATCH'){
        if(typeof body.enabled!=='boolean')throw fail(400,'Preferencia inválida.');
        const rows=await db('kit_profiles?user_id=eq.'+user.id,'PATCH',{email_alerts_enabled:body.enabled});
        if(!rows?.length)throw fail(404,'No se encontró tu perfil.');return res.status(200).json({ok:true});
      }
      if(body.action==='claim'&&req.method==='POST') {
        const code=String(body.code||'').trim().toUpperCase();if(!validCode(code))throw fail(400,'El código tiene el formato KIT- seguido de 32 caracteres.');
        const result=await database(cfg,fetcher,null,true)('rpc/kit_claim','POST',{p_owner:user.id,p_hash:hash(code)});
        if(result.error==='RATE_LIMIT')throw fail(429,'Demasiados intentos. Espera una hora y vuelve a intentar.');
        if(result.error)throw fail(409,'Código inválido, ya utilizado o kit no disponible.');
        return res.status(200).json(result);
      }
      if(body.action==='station'&&req.method==='PATCH') {
        if(!uuid(body.id))throw fail(400,'Estación inválida.');
        let patch;try{patch={...calibration(body),name:text(body.name),location:String(body.location||'').trim()};if(patch.location.length>180)throw Error('La ubicación es demasiado larga.');if(body.personal_entity_id!==undefined){if(body.personal_entity_id!==null&&!uuid(body.personal_entity_id))throw Error('Entidad inválida.');patch.personal_entity_id=body.personal_entity_id}}catch(error){throw fail(400,error.message);}
        if(!uuid(body.gateway_id))throw fail(400,'Selecciona el gateway que recibirá los datos de esta estación.');
        patch.gateway_id=body.gateway_id;
        const current=await db('kit_stations?id=eq.'+body.id+'&select=gateway_id');
        if(!current?.length)throw fail(404,'No tienes acceso a esa estación.');
        const previous=current[0].gateway_id;
        if(body.expected_gateway!==previous)throw fail(409,'La configuración cambió. Actualiza la estación antes de guardar.');
        if(previous&&previous!==patch.gateway_id&&body.confirm_gateway!==true)throw fail(409,'Confirma el cambio de gateway antes de guardar.');
        const rows=await db('kit_stations?id=eq.'+body.id+'&gateway_id='+(previous?'eq.'+previous:'is.null'),'PATCH',patch);
        if(!rows?.length)throw fail(404,'No tienes acceso a esa estación.');
        return res.status(200).json(rows[0]);
      }
      if(body.action==='gateway'&&req.method==='PATCH') {
        if(!uuid(body.id))throw fail(400,'Gateway inválido.');
        let name;try{name=text(body.name)}catch(error){throw fail(400,error.message)}
        const rows=await db('kit_gateways?id=eq.'+body.id,'PATCH',{name});
        if(!rows?.length)throw fail(404,'No tienes acceso a ese gateway.');return res.status(200).json(rows[0]);
      }
      if((body.action==='delete-station'&&req.method==='DELETE')||(body.action==='restore-station'&&req.method==='POST')){
        if(!uuid(body.id))throw fail(400,'Estación inválida.');
        const rows=await db('kit_stations?id=eq.'+body.id,'PATCH',{deleted_at:body.action==='delete-station'?new Date().toISOString():null});
        if(!rows?.length)throw fail(404,'No tienes acceso a esa estación.');return res.status(200).json({ok:true});
      }
      if(['entity-create','entity-rename','entity-delete'].includes(body.action)){
        if(!['personal','admin'].includes(body.scope))throw fail(400,'Tipo de entidad inválido.');
        if(body.scope==='admin'&&!(await db('kit_admins?user_id=eq.'+user.id+'&select=user_id'))?.length)throw fail(403,'La organización interna es solo para administradores.');
        const table=body.scope==='admin'?'kit_admin_entities':'kit_personal_entities';
        let rows;
        if(body.action==='entity-create'&&req.method==='POST'){
          let name;try{name=text(body.name)}catch(error){throw fail(400,error.message)}
          rows=await db(table,'POST',{name,[body.scope==='admin'?'created_by':'owner_id']:user.id});
        }else{
          if(!uuid(body.id))throw fail(400,'Entidad inválida.');
          if(body.action==='entity-rename'&&req.method==='PATCH'){
            let name;try{name=text(body.name)}catch(error){throw fail(400,error.message)}
            rows=await db(table+'?id=eq.'+body.id,'PATCH',{name});
          }else if(body.action==='entity-delete'&&req.method==='DELETE')rows=await db(table+'?id=eq.'+body.id,'DELETE');
          else throw fail(405,'Método no permitido.');
        }
        if(!rows?.length)throw fail(404,'No tienes acceso a esa entidad.');return res.status(200).json(rows[0]);
      }
      if(body.action==='admin-classify'&&req.method==='POST'){
        if(!uuid(body.station_id)||(body.entity_id!==null&&!uuid(body.entity_id)))throw fail(400,'Estación o entidad inválida.');
        await db('rpc/kit_set_admin_entity','POST',{p_station:body.station_id,p_entity:body.entity_id});return res.status(200).json({ok:true});
      }
      if(body.action==='create'&&req.method==='POST') {
        const admin=await db('kit_admins?user_id=eq.'+user.id+'&select=user_id');
        if(!admin?.length)throw fail(403,'Solo el administrador puede preparar kits.');
        if(!['complete','station','gateway'].includes(body.kind))throw fail(400,'Selecciona una presentación: estación + gateway, solo estación o solo gateway.');
        const code='KIT-'+randomBytes(16).toString('hex').toUpperCase(),deviceToken='GW_'+randomBytes(32).toString('hex');
        const kitSerial='HI-'+randomBytes(8).toString('hex').toUpperCase(),gatewaySerial='GW-'+randomBytes(8).toString('hex').toUpperCase();
        const stationSerial='EST-'+randomBytes(8).toString('hex').toUpperCase();
        const result=await database(cfg,fetcher,null,true)('rpc/kit_prepare','POST',{p_actor:user.id,p_kind:body.kind,p_kit_serial:kitSerial,p_gateway_serial:gatewaySerial,p_code_hash:hash(code),p_token_hash:hash(deviceToken),p_station_serial:stationSerial});
        return res.status(201).json({...result,activation_code:code,...(result.gateway?{gateway_serial:gatewaySerial,gateway_token:deviceToken}:{})});
      }
      throw fail(400,'Acción no disponible.');
    }catch(error){res.status(error.status||500).json({error:error.status?error.message:'No se pudo completar la operación.'});}
  };
}
