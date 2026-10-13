import {createHash,randomBytes} from 'node:crypto';
import {calibration,text,uuid,validCode,sensorStates} from '../src/core.js';
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
export function publicConfig(env=process.env) { const cfg=environment(env); return {app:'estacion-hidrometrica-kits',project_ref:cfg.url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/)?.[1]||null,configured:cfg.configured,url:cfg.configured?cfg.url:null,key:cfg.configured?cfg.publicKey:null}; }
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
    const headers={apikey:key,'Content-Type':'application/json',Prefer:'return=representation'};
    if(!privileged)headers.Authorization='Bearer '+token;
    else if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
    let response;
    try {response=await fetcher(cfg.url+'/rest/v1/'+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});} catch(_){throw fail(503,'No se pudo contactar con la base de datos.');}
    if(!response.ok){
      const problem=await response.json().catch(()=>({}));
      if(problem.message?.includes('DEVICE_NOT_ALLOWED'))throw fail(403,'Gateway o estación no autorizados.');
      if(problem.message?.includes('ADMIN_REQUIRED'))throw fail(403,'Se requiere administración.');
      if(problem.message?.includes('ENTITY_NOT_OWNED'))throw fail(403,'La entidad debe pertenecer al propietario de la estación.');
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
        return res.status(201).json({received:true,id});
      }
      if(!['GET','POST','PATCH','DELETE'].includes(req.method))throw fail(405,'Método no permitido.');
      const token=tokenFrom(req),user=await verifiedUser(cfg,fetcher,token);
      const db=database(cfg,fetcher,token);
      if(req.method==='GET'){
        const snapshot=await db('rpc/kit_snapshot','POST',{});
        if(snapshot.admin)snapshot.inventory=await database(cfg,fetcher,null,true)('kit_kits?select=id,serial,created_at,claimed_at,owner_id&order=created_at.desc&limit=100');
        else {delete snapshot.adminEntities;delete snapshot.adminAssignments;}
        return res.status(200).json(snapshot);
      }
      const body=input(req);
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
        const rows=await db('kit_stations?id=eq.'+body.id,'PATCH',patch);
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
        const count=body.station_count;if(!Number.isInteger(count)||count<1||count>8)throw fail(400,'El kit debe tener de 1 a 8 estaciones.');
        const code='KIT-'+randomBytes(16).toString('hex').toUpperCase(),deviceToken='GW_'+randomBytes(32).toString('hex');
        const kitSerial='HI-'+randomBytes(8).toString('hex').toUpperCase(),gatewaySerial='GW-'+randomBytes(8).toString('hex').toUpperCase();
        const stations=Array.from({length:count},(_,i)=>({serial:'EST-'+randomBytes(8).toString('hex').toUpperCase(),node_label:'RIO_'+String(i+1).padStart(2,'0'),name:'Estación '+(i+1)}));
        const id=await database(cfg,fetcher,null,true)('rpc/kit_create','POST',{p_actor:user.id,p_kit_serial:kitSerial,p_gateway_serial:gatewaySerial,p_code_hash:hash(code),p_token_hash:hash(deviceToken),p_stations:stations});
        return res.status(201).json({kit_id:id,serial:kitSerial,activation_code:code,gateway_serial:gatewaySerial,gateway_token:deviceToken,stations});
      }
      throw fail(400,'Acción no disponible.');
    }catch(error){res.status(error.status||500).json({error:error.status?error.message:'No se pudo completar la operación.'});}
  };
}
