import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
import {createHash} from 'node:crypto';import {validWebhook,webhookSecret,configureTelegram,receiveTelegram,deliverTelegram} from '../lib/telegram.js';
const env={TELEGRAM_BOT_TOKEN:'123456:'+ 'a'.repeat(35)},hash=s=>createHash('sha256').update(s).digest('hex');
test('vinculación privada de un uso, límites, pausa, cambios de nivel y lease',async()=>{
 const db=new PGlite(),a='00000000-0000-4000-8000-000000000011',b='00000000-0000-4000-8000-000000000012',nonce='a'.repeat(64);
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const f of fs.readdirSync(new URL('../supabase',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(new URL('../supabase/'+f,import.meta.url),'utf8'));
 for(const id of [a,b])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};
 await as(a);await db.query('select public.kit_telegram_begin($1)',[hash(nonce)]);
 await assert.rejects(db.query('select * from public.kit_telegram'),/permission denied/);
 await assert.rejects(db.query('select public.kit_telegram_consume($1,123)',[hash(nonce)]),/permission denied/);
 await assert.rejects(db.query('select public.kit_telegram_begin($1)',[hash('b'.repeat(64))]),/TELEGRAM_RATE_LIMIT/);
 const item=(await db.query("select public.kit_register_owned(gen_random_uuid(),'complete','Mi estación','RIO_01',null) r")).rows[0].r;
 await db.query('update public.kit_stations set bed_height=100,capacity_height=40,yellow_alert=25,red_alert=35 where id=$1',[item.station_id]);
 await db.exec('reset role');assert.equal((await db.query('select public.kit_telegram_consume($1,123) r',[hash(nonce)])).rows[0].r,true);
 assert.equal((await db.query('select public.kit_telegram_consume($1,124) r',[hash(nonce)])).rows[0].r,false);
 await as(b);assert.equal((await db.query('select public.kit_telegram_status() r')).rows[0].r.linked,false);
 await db.query('select public.kit_telegram_preference(false,true)');await db.exec('reset role');assert.equal((await db.query('select enabled from public.kit_telegram where owner_id=$1',[a])).rows[0].enabled,true);
 const insert=distance=>db.query("insert into public.kit_readings(station_id,distance_cm,sensor_status,packet,rssi) values($1,$2,'OK',1,-70)",[item.station_id,distance]);
 await insert(70);await insert(69);await insert(60);await insert(90);await insert(70);
 assert.deepEqual((await db.query("select severity from public.kit_telegram_outbox where station_id is not null order by created_at,id")).rows.map(r=>r.severity).sort(),['normal','red','yellow','yellow']);
 const event=(await db.query('select public.kit_telegram_take() r')).rows[0].r;assert(event.recipient==='123');
 assert.equal((await db.query('select public.kit_telegram_take() r')).rows[0].r,null);
 await db.query('select public.kit_telegram_finish($1,gen_random_uuid(),true)',[event.id]);assert.equal((await db.query('select sent_at from public.kit_telegram_outbox where id=$1',[event.id])).rows[0].sent_at,null);
 await db.query('select public.kit_telegram_finish($1,$2,true)',[event.id,event.lease_id]);
 await as(a);await db.query('select public.kit_telegram_test()');await assert.rejects(db.query('select public.kit_telegram_test()'),/TELEGRAM_RATE_LIMIT/);
 const before=(await db.query('select count(*)::int n from public.kit_readings')).rows[0].n;await db.exec('reset role');const beforeState=(await db.query('select * from public.kit_telegram_state order by station_id')).rows;
 for(const kind of ['test','yellow','red','error','normal']){
  await db.exec('reset role');await db.query("update public.kit_telegram set last_test_at=now()-interval '2 minutes' where owner_id=$1",[a]);await as(a);
  await db.query('select public.kit_telegram_test($1)',[kind]);
  await db.exec('reset role');const row=(await db.query('select owner_id,station_id,severity,test_kind from public.kit_telegram_outbox where test_kind=$1 order by created_at desc limit 1',[kind])).rows[0];assert.equal(row.owner_id,a);assert.equal(row.station_id,null);assert.equal(row.severity,'test');assert.equal(row.test_kind,kind);await as(a);
 }
 await assert.rejects(db.query('select public.kit_telegram_test($1)',['offline']),/INVALID_REGISTRATION/);
 assert.equal((await db.query('select count(*)::int n from public.kit_readings')).rows[0].n,before);await db.exec('reset role');assert.deepEqual((await db.query('select * from public.kit_telegram_state order by station_id')).rows,beforeState);await as(a);
 await db.query('select public.kit_telegram_preference(false,true)');const status=(await db.query('select public.kit_telegram_status() r')).rows[0].r;assert(!status.linked);assert(!status.enabled);assert(!('chat_id' in status));
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.kit_telegram_outbox where sent_at is null')).rows[0].n,0);
 }finally{await db.close()}
});
test('webhook verifica secreto y chat privado; token no se devuelve y 429 se reintenta',async()=>{
 assert(validWebhook(webhookSecret(env),env));assert(!validWebhook('é'.repeat(64),env));assert(!validWebhook('x',env));
 const result=()=>({setHeader(){},status(c){this.code=c;return this},json(d){this.data=d}});let calls=[];const service=async(route,method,body)=>{calls.push({route,body});return route.includes('consume')?false:null};
 let res=result();await receiveTelegram({method:'POST',headers:{},body:{}},res,service,{env});assert.equal(res.code,403);assert.equal(calls.length,0);
 res=result();await receiveTelegram({method:'POST',headers:{'x-telegram-bot-api-secret-token':webhookSecret(env)},body:{update_id:1,message:{chat:{type:'group',id:123},from:{id:123},text:'/start '+ 'a'.repeat(64)}}},res,service,{env});assert.equal(calls.length,0);
 res=result();await receiveTelegram({method:'POST',headers:{'x-telegram-bot-api-secret-token':webhookSecret(env)},body:{update_id:2,message:{chat:{type:'private',id:123},from:{id:123},text:'/start '+ 'a'.repeat(64)}}},res,service,{env});assert.equal(calls[0].body.p_hash,hash('a'.repeat(64)));
 let count=0;await deliverTelegram(async(route,method,body)=>{if(route.endsWith('take'))return count++?null:{id:'id',lease_id:'lease',recipient:'123',severity:'test'};assert.equal(body.p_retry,900);assert.equal(body.p_success,false)},{env,fetcher:async()=>new Response(JSON.stringify({ok:false,error_code:429,parameters:{retry_after:900}}),{status:429})});
 await assert.rejects(configureTelegram(env,async()=>new Response(JSON.stringify({ok:true,result:{username:'OtroBot'}}))),/bot esperado/);
});

test('rutas API de Telegram están conectadas, exigen sesión y restringen activación a propietaria',async()=>{
 const {makeHandler}=await import('../lib/server.js');const actor='00000000-0000-4000-8000-000000000011',other='00000000-0000-4000-8000-000000000012',config={...env,SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
 async function call(action,owner=actor,kind){const calls=[],fetcher=async(url,o)=>{calls.push({url,o});let r=url.endsWith('/auth/v1/user')?{id:actor,email_confirmed_at:'now'}:url.includes('kit_owner?')?[{user_id:owner}]:url.endsWith('getMe')?{ok:true,result:{username:'HackeandoInundacionesAvisosBot'}}:url.endsWith('setWebhook')?{ok:true}:url.includes('kit_telegram_status')?{linked:false,enabled:false}:null;return new Response(JSON.stringify(r))};const res={setHeader(){},status(c){this.code=c;return this},json(d){this.data=d}};await makeHandler('kits',{env:config,fetcher})({method:action==='telegram-preference'?'PATCH':'POST',headers:{authorization:'Bearer signed_test_user_token_12345','content-type':'application/json'},body:{action,enabled:false,unlink:true,...(kind===undefined?{}:{kind})}},res);return {res,calls}}
 for(const action of ['telegram-status','telegram-setup','telegram-link','telegram-preference','telegram-test']){const {res,calls}=await call(action);assert.equal(res.code,200,action+JSON.stringify(res.data));assert(!JSON.stringify(res.data).includes(env.TELEGRAM_BOT_TOKEN));if(action==='telegram-link'){const nonce=new URL(res.data.url).searchParams.get('start');assert.equal(nonce.length,64);const c=calls.find(c=>c.url.endsWith('rpc/kit_telegram_begin'));assert.equal(JSON.parse(c.o.body).p_hash,hash(nonce));assert.equal(c.o.headers.apikey,config.SUPABASE_PUBLISHABLE_KEY)}}
 for(const kind of ['offline','__proto__',{}]){const bad=await call('telegram-test',actor,kind);assert.equal(bad.res.code,400);assert(!bad.calls.some(c=>c.url.endsWith('rpc/kit_telegram_test')))}
 const typed=await call('telegram-test',actor,'red');assert.equal(JSON.parse(typed.calls.find(c=>c.url.endsWith('rpc/kit_telegram_test')).o.body).p_kind,'red');
 const denied=await call('telegram-setup',other);assert.equal(denied.res.code,403);assert(!denied.calls.some(c=>c.url.startsWith('https://api.telegram.org/')));
});
