import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler,hash,publicConfig} from '../lib/server.js';
const env={SUPABASE_URL:'https://testing.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST_ONLY',SUPABASE_SECRET_KEY:'sb_secret_TEST_ONLY'};
const owner='00000000-0000-4000-8000-000000000011',station='00000000-0000-4000-8000-000000000021';
const bearer='signed_test_user_token_12345';
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(value){this.value=value;return this}}}
const req=(method,body,token=bearer)=>({method,body,headers:{authorization:'Bearer '+token,'content-type':'application/json'}});
const response=data=>new Response(JSON.stringify(data),{status:200});
test('config no expone secretos, ni acepta una clave privada como pública',async()=>{
  const result=publicConfig(env);assert.equal(result.key,env.SUPABASE_PUBLISHABLE_KEY);assert(!JSON.stringify(result).includes(env.SUPABASE_SECRET_KEY));
  assert.equal(publicConfig({...env,SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_SECRET_KEY}).configured,false);
  const r=res();await makeHandler('kits',{env:{}})(req('GET'),r);assert.equal(r.code,503);
});
test('kit pertenece al usuario verificado, ignora propietario inyectado y envía solo hash',async()=>{
  const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return response(url.endsWith('/auth/v1/user')?{id:owner,email_confirmed_at:'2026-01-01'}:{kit_id:station})};
  const code='KIT-'+ 'A'.repeat(32),r=res();await makeHandler('kits',{env,fetcher})(req('POST',{action:'claim',code,owner_id:station}),r);
  assert.equal(r.code,200);const payload=JSON.parse(calls[1].options.body);assert.equal(payload.p_owner,owner);assert.equal(payload.p_hash,hash(code));assert(!calls[1].options.body.includes(code));
});
test('no permite usuarios sin correo confirmado ni creación sin rol admin',async()=>{
  const unconfirmed=async()=>response({id:owner});const a=res();await makeHandler('kits',{env,fetcher:unconfirmed})(req('GET'),a);assert.equal(a.code,403);
  const r=res();const fetcher=async(url)=>response(url.endsWith('/auth/v1/user')?{id:owner,email_confirmed_at:'now'}:[]);
  await makeHandler('kits',{env,fetcher})(req('POST',{action:'create',station_count:1}),r);assert.equal(r.code,403);
});
test('edición utiliza JWT del comprador, RLS y lista permitida de campos',async()=>{
  const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return response(url.endsWith('/auth/v1/user')?{id:owner,email_confirmed_at:'now'}:[{id:station}])};
  const r=res();await makeHandler('kits',{env,fetcher})(req('PATCH',{action:'station',id:station,name:'Cubeta',location:'Pruebas',bed_height:65,capacity_height:16,yellow_alert:12,red_alert:15,gateway_id:owner,serial:'AJENA'}),r);
  assert.equal(r.code,200);assert.equal(calls[1].options.headers.Authorization,'Bearer '+bearer);assert.equal(calls[1].options.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
  const patch=JSON.parse(calls[1].options.body);assert.equal(patch.gateway_id,owner);assert.equal(patch.serial,undefined);
});
test('credencial de gateway no sirve como sesión y petición inválida no llega a DB',async()=>{
  let count=0;const fetcher=async()=>{count++;return new Response('{}',{status:401})};
  const a=res();await makeHandler('device',{env,fetcher})(req('POST',{station_serial:'RIO_01'},'GW_'+ 'a'.repeat(64)),a);assert.equal(a.code,400);assert.equal(count,0);
  const b=res();await makeHandler('kits',{env,fetcher})(req('GET',null,'GW_'+ 'a'.repeat(64)),b);assert.equal(b.code,401);
});
test('ingesta firma por dispositivo y limita el formato de mediciones',async()=>{
  let payload;const token='GW_'+ 'a'.repeat(64),fetcher=async(url,options)=>{assert(url.endsWith('/rpc/kit_ingest'));payload=JSON.parse(options.body);return response(17)};
  const r=res();await makeHandler('device',{env,fetcher})(req('POST',{station_serial:'EST-'+ 'A'.repeat(16),distance_cm:57,sensor_status:'OK',packet:18,rssi:-77},token),r);
  assert.equal(r.code,201);assert.equal(payload.p_hash,hash(token));assert(!JSON.stringify(payload).includes(token));
});
test('el comprador no recibe la clasificación interna ni puede elegir otro propietario para su entidad',async()=>{
 const calls=[],fetcher=async(url,options)=>{calls.push({url,options});if(url.endsWith('/auth/v1/user'))return response({id:owner,email_confirmed_at:'now'});if(url.endsWith('/rpc/kit_snapshot'))return response({admin:false,adminEntities:[{name:'Privada'}],adminAssignments:[{}],personalEntities:[]});return response([{id:station}]);};
 const r=res();await makeHandler('kits',{env,fetcher})(req('GET'),r);assert.equal(r.code,200);assert.equal(r.value.adminEntities,undefined);assert.equal(r.value.adminAssignments,undefined);
 const a=res();await makeHandler('kits',{env,fetcher})(req('POST',{action:'entity-create',scope:'personal',name:'Mi casa',owner_id:station}),a);assert.equal(a.code,200);assert.equal(JSON.parse(calls.at(-1).options.body).owner_id,owner);assert.equal(calls.at(-1).options.headers.Authorization,'Bearer '+bearer);
});
test('eliminar y restaurar una estación conserva filas y usa permisos del usuario',async()=>{
 const calls=[],fetcher=async(url,options)=>{calls.push({url,options});return response(url.endsWith('/auth/v1/user')?{id:owner,email_confirmed_at:'now'}:[{id:station}])};
 const remove=res();await makeHandler('kits',{env,fetcher})(req('DELETE',{action:'delete-station',id:station}),remove);assert.equal(remove.code,200);assert.equal(calls.at(-1).options.method,'PATCH');assert(JSON.parse(calls.at(-1).options.body).deleted_at);
 const restore=res();await makeHandler('kits',{env,fetcher})(req('POST',{action:'restore-station',id:station}),restore);assert.equal(restore.code,200);assert.equal(JSON.parse(calls.at(-1).options.body).deleted_at,null);
});
test('preparación usa tres presentaciones, no cantidad; no expone token en kit sin gateway',async()=>{
 for(const kind of ['complete','station','gateway']){
  let sent;const fetcher=async(url,options)=>{
   if(url.endsWith('/auth/v1/user'))return response({id:owner,email_confirmed_at:'now'});
   if(url.includes('kit_admins?'))return response([{user_id:owner}]);
   assert(url.endsWith('/rpc/kit_prepare'));sent=JSON.parse(options.body);
   return response({kit_id:station,friendly_code:'KIT-000001',kind,gateway:kind==='station'?null:{id:owner},stations:kind==='gateway'?[]:[{id:station}]});
  };
  const r=res();await makeHandler('kits',{env,fetcher})(req('POST',{action:'create',kind,station_count:999}),r);
  assert.equal(r.code,201);assert.equal(sent.p_kind,kind);assert.equal(sent.p_actor,owner);assert.equal(sent.p_stations,undefined);assert.match(r.value.activation_code,/^KIT-[A-F0-9]{32}$/);assert.equal(Boolean(r.value.gateway_token),kind!=='station');assert(!JSON.stringify(sent).includes(r.value.activation_code));
 }
});
test('preferencia de correo no permite cambiar al destinatario ni otro perfil',async()=>{
 let call;const fetcher=async(url,options)=>{if(url.endsWith('/auth/v1/user'))return response({id:owner,email_confirmed_at:'now'});call={url,body:JSON.parse(options.body)};return response([{user_id:owner}])};
 const r=res();await makeHandler('kits',{env,fetcher})(req('PATCH',{action:'email-preference',enabled:true,user_id:station,email:'other@example.invalid'}),r);assert.equal(r.code,200);assert(call.url.includes('user_id=eq.'+owner));assert.deepEqual(call.body,{email_alerts_enabled:true});
});
