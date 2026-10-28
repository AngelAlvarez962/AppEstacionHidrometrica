import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
test('registro propio atómico: sin admin, aislamiento, reintento y sin claves expuestas',async()=>{
 const db=new PGlite(),a='00000000-0000-4000-8000-000000000011',b='00000000-0000-4000-8000-000000000012';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const file of ['001-kits.sql','002-entities-and-admin.sql','003-flexible-kits.sql','004-email-alerts.sql','005-serialize-ingestion.sql','006-gateway-connection.sql','007-gateway-switch.sql','008-self-service.sql'])await db.exec(fs.readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'));
 for(const id of [a,b])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
 const as=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role)};
 const request='00000000-0000-4000-8000-000000000020';await as(a);
 const register=async(req,kind='complete',gateway=null,node='RIO_01')=>(await db.query('select public.kit_register_owned($1,$2,$3,$4,$5) as result',[req,kind,'Mi equipo',node,gateway])).rows[0].result;
 const first=await register(request);assert(first.gateway_id&&first.station_id);assert.deepEqual(await register(request),first);assert.equal((await db.query('select count(*)::int as n from public.kit_kits')).rows[0].n,1);
 await assert.rejects(register('00000000-0000-4000-8000-000000000021','station',first.gateway_id),/NODE_ALREADY_REGISTERED/);
 const second=await register('00000000-0000-4000-8000-000000000022','station',first.gateway_id,'RIO_02');assert(second.station_id);assert.equal((await db.query('select count(*)::int as n from public.kit_stations')).rows[0].n,2);
 assert.deepEqual(await register('00000000-0000-4000-8000-000000000022','station',first.gateway_id,'RIO_02'),second);
 const gateway=await register('00000000-0000-4000-8000-000000000026','gateway');assert(gateway.gateway_id);assert.equal(gateway.station_id,null);
 const pending=await register('00000000-0000-4000-8000-000000000027','station');assert(pending.station_id);assert.equal(pending.gateway_id,null);
 await assert.rejects(db.query('select * from public.kit_gateway_keys'),/permission denied/);
 await as(b);assert.equal((await db.query('select count(*)::int as n from public.kit_stations')).rows[0].n,0);
 await assert.rejects(register('00000000-0000-4000-8000-000000000023','station',first.gateway_id),/GATEWAY_NOT_OWNED/);
 await as('', 'anon');await assert.rejects(register('00000000-0000-4000-8000-000000000024'),/permission denied/);
 await as(b);await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=null where id=$1',[b]);await as(b);await assert.rejects(register('00000000-0000-4000-8000-000000000025'),/CONFIRMED_USER_REQUIRED/);
 await as(a);for(let i=0;i<16;i++)await register('00000000-0000-4000-8000-'+String(100+i).padStart(12,'0'),'gateway');
 await assert.rejects(register('00000000-0000-4000-8000-000000000200','gateway'),/REGISTRATION_LIMIT/);
 assert.deepEqual(await register(request),first);
 }finally{await db.close()}
});
