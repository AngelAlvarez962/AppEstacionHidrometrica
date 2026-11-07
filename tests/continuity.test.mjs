import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
test('continuidad: registro horario, cambios, desconexión, recordatorio 24 h, recuperación y privacidad',async()=>{
 const db=new PGlite(),a='00000000-0000-4000-8000-000000000011',b='00000000-0000-4000-8000-000000000012';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const f of fs.readdirSync(new URL('../supabase',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(new URL('../supabase/'+f,import.meta.url),'utf8'));
 for(const id of [a,b])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};
 await as(a);const item=(await db.query("select public.kit_register_owned(gen_random_uuid(),'complete','Prueba','RIO_01',null) r")).rows[0].r;
 await db.query('update public.kit_stations set bed_height=100,capacity_height=40,yellow_alert=25,red_alert=35 where id=$1',[item.station_id]);await db.exec('reset role');
 await db.query('insert into public.kit_telegram(owner_id,chat_id,enabled) values($1,123,true)',[a]);
 const reading=async distance=>db.query("insert into public.kit_readings(station_id,distance_cm,sensor_status,packet,rssi) values($1,$2,'OK',1,-40)",[item.station_id,distance]);
 await reading(90);
 assert.equal((await db.query("select count(*)::int n from public.kit_telegram_outbox where severity='normal' and context_status='initial'")).rows[0].n,1);
 await reading(89);
 assert.equal((await db.query("select count(*)::int n from public.kit_telegram_outbox where severity='normal'")).rows[0].n,1);
 await as(a);const run=(await db.query('select public.kit_watch_start($1,1) r',[item.station_id])).rows[0].r;
 assert.equal((await db.query('select kind from public.kit_watch_logs')).rows[0].kind,'inicio');
 await assert.rejects(db.query('select public.kit_watch_start($1,7)',[item.station_id]),/WATCH_ALREADY_ACTIVE/);
 await as(b);assert.equal((await db.query('select * from public.kit_watch_logs')).rows.length,0);await assert.rejects(db.query('select public.kit_watch_stop($1)',[run]),/DEVICE_NOT_ALLOWED/);
 await assert.rejects(db.query('select public.kit_watch_tick()'),/permission denied/);
 await db.exec('reset role');await db.exec("update public.kit_watch_runs set last_hour=now()-interval '61 minutes'");await db.query('select public.kit_watch_tick()');assert.equal((await db.query("select count(*)::int n from public.kit_watch_logs where kind='hora'")).rows[0].n,1);
 await db.exec("update public.kit_readings set received_at=now()-interval '3 minutes'");await db.query('select public.kit_watch_tick()');assert.equal((await db.query('select status from public.kit_watch_state')).rows[0].status,'offline');
 const count=async()=>(await db.query("select count(*)::int n from public.kit_telegram_outbox where severity='offline'")).rows[0].n;
 assert.equal(await count(),1);await db.query('select public.kit_watch_tick()');assert.equal(await count(),1);
 await db.exec("update public.kit_watch_state set notified_at=now()-interval '25 hours';update public.kit_telegram_outbox set created_at=now()-interval '25 hours'");await db.query('select public.kit_watch_tick()');assert.equal(await count(),2);
 await reading(90);assert.equal((await db.query("select count(*)::int n from public.kit_telegram_outbox where severity='normal'")).rows[0].n,2);
 await db.exec("update public.kit_watch_state set notified_at=now()-interval '25 hours'");await db.query('select public.kit_watch_tick()');assert.equal((await db.query("select count(*)::int n from public.kit_telegram_outbox where severity='normal'")).rows[0].n,2);
 await as(a);await db.query('select public.kit_watch_stop($1)',[run]);const logs=(await db.query('select * from public.kit_watch_logs')).rows.length;await db.exec('reset role');await db.query('select public.kit_watch_tick()');assert.equal((await db.query('select count(*)::int n from public.kit_watch_logs')).rows[0].n,logs);
 }finally{await db.close()}
});
import {makeHandler} from '../lib/server.js';
test('API de continuidad exige sesión y el programador exige secreto privado',async()=>{
 const env={SUPABASE_URL:'https://testing.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST_ONLY',SUPABASE_SECRET_KEY:'sb_secret_TEST_ONLY'};
 const response=()=>({setHeader(){},status(n){this.code=n;return this},json(v){this.value=v;return this}});
 let r=response();await makeHandler('kits',{env,fetcher:async()=>{throw Error('not expected')}})({method:'POST',headers:{'content-type':'application/json'},body:{action:'watch-list'}},r);assert.equal(r.code,401);
 let calls=0;r=response();await makeHandler('watch',{env,fetcher:async()=>{calls++;return new Response(JSON.stringify([{secret:'a'.repeat(64)}]))}})({method:'POST',headers:{authorization:'Bearer '+'b'.repeat(64)}},r);assert.equal(r.code,403);assert.equal(calls,1);
});
