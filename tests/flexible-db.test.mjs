import fs from 'node:fs';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const file of ['001-kits.sql','002-entities-and-admin.sql'])await db.exec(fs.readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'));
 const a='00000000-0000-4000-8000-000000000011',b='00000000-0000-4000-8000-000000000012',admin='00000000-0000-4000-8000-000000000013';
 for(const id of [a,b,admin])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
 await db.query('insert into public.kit_admins values($1)',[admin]);
 const legacy=(await db.query(`select public.kit_create($1,'OLD-KIT','OLD-GW',$2,$3,$4::jsonb) as id`,[admin,'a'.repeat(64),'1'.repeat(64),JSON.stringify([{serial:'OLD-ST',node_label:'RIO_01',name:'Existente'}])])).rows[0].id;
 await db.query('select public.kit_claim($1,$2)',[a,'a'.repeat(64)]);
 await db.query("select public.kit_ingest($1,'OLD-ST',57,'OK',1,-70)",['1'.repeat(64)]);
 for(const file of ['003-flexible-kits.sql','004-email-alerts.sql','005-serialize-ingestion.sql'])await db.exec(fs.readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'));
 const old=(await db.query("select * from public.kit_stations where serial='OLD-ST'")).rows[0];assert.equal(old.kit_id,legacy);assert(old.setup_pending);assert.equal((await db.query('select count(*)::int as n from public.kit_readings')).rows[0].n,1);
 let n=0;
 async function prepare(kind,owner){n++;const code=n.toString(16).padStart(64,'0'),token=(n+100).toString(16).padStart(64,'0');const result=(await db.query('select public.kit_prepare($1,$2,$3,$4,$5,$6,$7) as kit',[admin,kind,'HI-'+n,'GW-'+n,code,token,'EST-'+n])).rows[0].kit;await db.query('select public.kit_claim($1,$2)',[owner,code]);return {...result,token};}
 const complete=await prepare('complete',a),expansion=await prepare('station',a),gateway=await prepare('gateway',a),foreign=await prepare('complete',b);
 assert.equal(expansion.gateway,null);assert.equal(gateway.stations.length,0);assert.equal(complete.stations.length,1);assert.match(expansion.friendly_code,/^KIT-\d{6}$/);
 async function as(user){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated')}
 const sid=expansion.stations[0].id;
 await as(a);const own=(await db.query('select public.kit_snapshot() as data')).rows[0].data;assert.equal(own.stations.length,3);assert(own.stations.some(s=>s.id===sid&&s.gateway_id===null));
 await assert.rejects(db.query('update public.kit_stations set gateway_id=$1 where id=$2',[foreign.gateway.id,sid]),/GATEWAY_NOT_OWNED/);
 await db.query('update public.kit_stations set gateway_id=$1,bed_height=65,capacity_height=16,yellow_alert=12,red_alert=15 where id=$2',[complete.gateway.id,sid]);
 assert.equal((await db.query('select setup_pending from public.kit_stations where id=$1',[sid])).rows[0].setup_pending,false);
 await assert.rejects(db.query('update public.kit_stations set kit_id=$1 where id=$2',[foreign.kit_id,sid]),/permission denied/);
 await as(b);assert.equal((await db.query('select * from public.kit_stations where id=$1',[sid])).rows.length,0);
 await assert.rejects(db.query('select public.kit_email_take()'),/permission denied/);await assert.rejects(db.query('select * from public.kit_email_outbox'),/permission denied/);
 await as(a);await db.query('update public.kit_profiles set email_alerts_enabled=true where user_id=$1',[a]);
 await db.exec('reset role');
 await assert.rejects(db.query("select public.kit_ingest($1,$2,57,'OK',1,-70)",[complete.token,complete.stations[0].serial]),/DEVICE_NOT_ALLOWED/);
 const ingest=async(distance,status='OK')=>db.query('select public.kit_ingest($1,$2,$3,$4,1,-70)',[complete.token,expansion.stations[0].serial,distance,status]);
 await ingest(53);await ingest(53);await ingest(50);await ingest(49);await ingest(0,'SIN_ECO');
 const events=(await db.query('select * from public.kit_email_outbox order by created_at')).rows;assert.equal(events.length,3);assert.deepEqual(events.map(e=>e.severity),['yellow','red','error']);assert.equal(events[2].level_cm,null);
 const first=(await db.query('select public.kit_email_take() as event')).rows[0].event,second=(await db.query('select public.kit_email_take() as event')).rows[0].event;assert.notEqual(first.id,second.id);assert.equal(first.recipient,a+'@example.invalid');
 await db.query('select public.kit_email_finish($1,$2,true)',[first.id,crypto.randomUUID()]);assert.equal((await db.query('select sent_at from public.kit_email_outbox where id=$1',[first.id])).rows[0].sent_at,null);
 await db.query('select public.kit_email_finish($1,$2,true)',[first.id,first.lease_id]);assert((await db.query('select sent_at from public.kit_email_outbox where id=$1',[first.id])).rows[0].sent_at);
 await db.query('update public.kit_profiles set email_alerts_enabled=false where user_id=$1',[a]);assert.equal((await db.query('select public.kit_email_take() as event')).rows[0].event,null);
 console.log('OK: migración preserva historial; tres presentaciones; expansión comparte gateway propio; RLS rechaza cuentas ajenas; configuración obligatoria; cola privada, avisos sin duplicados y exclusión de envíos concurrentes.');
}finally{await db.close()}
