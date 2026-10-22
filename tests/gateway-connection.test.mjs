import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {parseGatewayLine,gatewayChange,GatewaySerial,internetConfirmed} from '../src/gateway.js';
test('USB acepta tramas acotadas; diferencia firmware compatible de lecturas heredadas',()=>{
 assert.equal(parseGatewayLine('RX: RIO_02,68.5,OK,3406 | RSSI: -63 dBm').distance_cm,68.5);
 for(const value of ['RX: AJENA,Infinity,OK,1 | RSSI: -50 dBm','RX: RIO_02,68,OK,9007199254740993 | RSSI: -63 dBm','HI:{"type":"hello","protocol":1,"hardware":"invalido"}','x'.repeat(9000)])assert.equal(parseGatewayLine(value),null);
 assert.equal(parseGatewayLine('HI:{"type":"hello","protocol":1,"hardware":"ESP32-AABBCCDDEEFF"}').type,'hello');
 assert.equal(gatewayChange(null,'new'),false);assert.equal(gatewayChange('old','old'),false);assert.equal(gatewayChange('old','new'),true);
 const now=Date.now();assert(internetConfirmed({internet_configured_at:new Date(now-3000),internet_last_seen:new Date(now-1000)},now));
 assert(!internetConfirmed({internet_configured_at:new Date(now),internet_last_seen:new Date(now-1000)},now));
 assert(!internetConfirmed({internet_last_seen:new Date(now-100000)},now));
});
test('cierre USB cancela la lectura y libera el puerto aun sin tramas',async()=>{
 let cancel,closed=false,released=false;
 const pending=new Promise(resolve=>{cancel=()=>resolve({done:true})});
 const reader={read:()=>pending,cancel:async()=>cancel(),releaseLock:()=>{released=true}};
 const port={open:async()=>{},setSignals:async()=>{},readable:{getReader:()=>reader},writable:{getWriter:()=>({write:async()=>{},releaseLock(){}})},close:async()=>{closed=true}};
 const serial=new GatewaySerial({serial:{requestPort:async()=>port}});await serial.connect();await serial.close();assert(closed&&released);
});
test('vinculación durable, confirmación, aislamiento y entrada de Internet con credencial limitada',async()=>{
 const db=new PGlite();const a='00000000-0000-4000-8000-000000000011',b='00000000-0000-4000-8000-000000000012';
 const hash=t=>createHash('sha256').update(t).digest('hex');
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for(const file of ['001-kits.sql','002-entities-and-admin.sql','003-flexible-kits.sql','004-email-alerts.sql','005-serialize-ingestion.sql','006-gateway-connection.sql','007-gateway-switch.sql'])await db.exec(fs.readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'));
  for(const id of [a,b])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
  await db.query('insert into public.kit_admins values($1)',[a]);let seq=0;
  async function kit(owner){seq++;const token='GW_'+String(seq).repeat(64),code=String(seq+4).repeat(64);const k=(await db.query('select public.kit_prepare($1,\'complete\',$2,$3,$4,$5,$6) as k',[a,'KIT-'+seq,'GW-'+seq,code,hash(token),'EST-'+String(seq).repeat(16)])).rows[0].k;await db.query('select public.kit_claim($1,$2)',[owner,code]);await db.query('update public.kit_stations set bed_height=100,capacity_height=40,yellow_alert=30,red_alert=38 where id=$1',[k.stations[0].id]);return {...k,token}}
  const first=await kit(a),second=await kit(a),foreign=await kit(b);
  const as=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role)};
  await as(a);await db.query('select public.kit_remember_gateway($1,null,false)',[first.gateway.id]);
  await assert.rejects(db.query('select public.kit_remember_gateway($1,$2,false)',[second.gateway.id,first.gateway.id]),/GATEWAY_CONFIRM_REQUIRED/);
  await db.query('select public.kit_remember_gateway($1,$2,true)',[second.gateway.id,first.gateway.id]);
  await assert.rejects(db.query('select public.kit_remember_gateway($1,$2,true)',[first.gateway.id,first.gateway.id]),/GATEWAY_CHANGED/);
  await assert.rejects(db.query('select public.kit_remember_gateway($1,$2,true)',[foreign.gateway.id,second.gateway.id]),/GATEWAY_NOT_OWNED/);
  await assert.rejects(db.query('select public.kit_connect_gateway($1,$2,true,$3::uuid[])',[first.gateway.id,second.gateway.id,[foreign.stations[0].id]]),/GATEWAY_NOT_OWNED/);
  await db.query('select public.kit_connect_gateway($1,$2,true,$3::uuid[])',[first.gateway.id,second.gateway.id,[second.stations[0].id]]);
  assert.equal((await db.query('select gateway_id from public.kit_stations where id=$1',[second.stations[0].id])).rows[0].gateway_id,first.gateway.id);
  await db.query('select public.kit_remember_gateway($1,$2,true)',[second.gateway.id,first.gateway.id]);
  const snapshot=(await db.query('select public.kit_snapshot() as data')).rows[0].data;assert.equal(snapshot.profiles.find(p=>p.user_id===a).preferred_gateway_id,second.gateway.id);
  await assert.rejects(db.query('select * from public.kit_gateway_pending'),/permission denied/);
  await as('','anon');
  const receive=(token=first.token,serial=first.stations[0].serial)=>db.query("select public.kit_receive($1,$2,68.5,'OK',17,-63) as id",[token,serial]);
  const id=(await receive()).rows[0].id;assert.equal((await receive()).rows[0].id,id);
  await assert.rejects(receive('GW_'+'a'.repeat(64)),/DEVICE_NOT_ALLOWED/);await assert.rejects(receive(first.token,foreign.stations[0].serial),/DEVICE_NOT_ALLOWED/);
  await assert.rejects(db.query('select * from public.kit_readings'),/permission denied/);
  await assert.rejects(db.query("select public.kit_ingest($1,$2,68,'OK',17,-63)",[hash(first.token),first.stations[0].serial]),/permission denied/);
  await db.exec('reset role');
  assert((await db.query('select internet_last_seen from public.kit_gateways where id=$1',[first.gateway.id])).rows[0].internet_last_seen);
  // A failed provisioning attempt must leave the original credential usable.
  const newToken='GW_'+'f'.repeat(64),proof=hash('confirmation');
  const pending=(await db.query('insert into public.kit_gateway_pending(gateway_id,owner_id,token_hash,proof,hardware_hint) values($1,$2,$3,$4,\'ESP32-AABBCCDDEEFF\') returning ticket',[first.gateway.id,a,hash(newToken),proof])).rows[0];
  await assert.rejects(db.query('select public.kit_finish_gateway($1,$2,$3)',[b,pending.ticket,proof]),/SETUP_EXPIRED/);
  await assert.rejects(db.query('select public.kit_finish_gateway($1,$2,$3)',[a,pending.ticket,'0'.repeat(64)]),/SETUP_EXPIRED/);
  await receive();await db.query('select public.kit_finish_gateway($1,$2,$3)',[a,pending.ticket,proof]);
  await assert.rejects(receive(),/DEVICE_NOT_ALLOWED/);await receive(newToken);
  await assert.rejects(db.query('select public.kit_finish_gateway($1,$2,$3)',[a,pending.ticket,proof]),/SETUP_EXPIRED/);
 }finally{await db.close()}
});
