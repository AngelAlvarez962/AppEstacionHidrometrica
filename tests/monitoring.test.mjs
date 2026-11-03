import {makeHandler} from '../lib/server.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';import {connectionStatus,gapBetween} from '../src/monitoring.js';
test('estados diferencian sensor, radio y receptor sin presentar lecturas antiguas como actuales',()=>{const now=Date.now(),s={gateway_id:'g',bed_height:60},r={received_at:new Date(now).toISOString(),sensor_status:'SIN_ECO',distance_cm:40};assert.equal(connectionStatus(s,r,{},now).kind,'sensor');r.sensor_status='OK';assert.equal(connectionStatus(s,r,{},now).kind,'ok');r.received_at=new Date(now-200000).toISOString();assert.equal(connectionStatus(s,r,{last_seen:new Date(now).toISOString()},now).kind,'radio');assert.equal(connectionStatus(s,r,{},now).kind,'gateway');assert(gapBetween(new Date(now).toISOString(),new Date(now+200000).toISOString()))});
test('tickets privados, respuesta sólo admin y auditoría inalterable sin cuerpos sensibles',async()=>{
 const db=new PGlite(),a='00000000-0000-4000-8000-000000000011',b='00000000-0000-4000-8000-000000000012';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const file of fs.readdirSync(new URL('../supabase',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'));
 for(const id of [a,b])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};
 await as(a);const register=async(kind='complete',node='RIO_01',gateway=null)=>(await db.query('select public.kit_register_owned(gen_random_uuid(),$1,$2,$3,$4) as r',[kind,'Equipo',node,gateway])).rows[0].r;

 const equipment=await register();const ticket=(await db.query('select public.kit_open_ticket($1,$2,$3) as id',[equipment.station_id,'Sensor sin señal','Descripción de prueba'])).rows[0].id;
 assert.equal((await db.query('select count(*)::int as n from public.kit_tickets')).rows[0].n,1);
 await assert.rejects(db.query("update public.kit_tickets set status='resolved' where id=$1 returning id",[ticket]).then(r=>{if(!r.rows.length)throw Error('DENIED')}),/DENIED|permission/);
 assert.equal((await db.query('select count(*)::int as n from public.kit_audit')).rows[0].n,0);
 await as(b);assert.equal((await db.query('select count(*)::int as n from public.kit_tickets')).rows[0].n,0);
 await assert.rejects(db.query('select public.kit_open_ticket($1,$2,$3)',[equipment.station_id,'Ajeno','No permitido']),/TICKET_NOT_ALLOWED/);
 await db.exec('reset role');await db.query('insert into public.kit_admins(user_id) values($1)',[b]);await as(b);
 await db.query("update public.kit_tickets set status='reviewing',reply='Revisa la conexión' where id=$1",[ticket]);
 const logs=(await db.query('select * from public.kit_audit')).rows;assert(logs.length>0);assert(!JSON.stringify(logs).includes('Descripción de prueba'));assert(!JSON.stringify(logs).includes('Revisa la conexión'));
 await assert.rejects(db.exec('delete from public.kit_audit'),/permission denied/);
 await as(a);assert.equal((await db.query('select reply from public.kit_tickets where id=$1',[ticket])).rows[0].reply,'Revisa la conexión');
 }finally{await db.close()}});

test('historial pagina con JWT y marca truncamiento sin exponer otras estaciones',async()=>{const id='00000000-0000-4000-8000-000000000011',calls=[],env={SUPABASE_URL:'https://testing.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST_ONLY',SUPABASE_SECRET_KEY:'sb_secret_TEST_ONLY'},token='signed_test_user_token_12345';const fetcher=async(url,o)=>{calls.push({url,o});let data;if(url.endsWith('/auth/v1/user'))data={id,email_confirmed_at:'now'};else if(url.includes('kit_stations?'))data=[{id}];else{const query=new URL(url).searchParams,limit=Number(query.get('limit'));data=Array.from({length:limit},(_,i)=>({id:i,station_id:id}));}return new Response(JSON.stringify(data))};const res={setHeader(){},status(n){this.code=n;return this},json(v){this.value=v;return this}};await makeHandler('kits',{env,fetcher})({method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:{action:'history',id,hours:24}},res);assert.equal(res.code,200);assert.equal(res.value.rows.length,2000);assert.equal(res.value.limited,true);assert.equal(calls.filter(c=>c.url.includes('kit_readings?')).length,5);for(const c of calls.filter(c=>c.url.includes('kit_readings?'))){assert.equal(c.o.headers.Authorization,'Bearer '+token);assert(c.url.includes('station_id=eq.'+id));assert(c.url.includes('received_at=lte.'))}});
