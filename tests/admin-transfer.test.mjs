import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';import {makeHandler} from '../lib/server.js';
test('traslado transaccional conserva archivadas e historial y rechaza ajenos, colisiones y vista antigua; roles sólo por admin',async()=>{
 const db=new PGlite(),a='00000000-0000-4000-8000-000000000011',b='00000000-0000-4000-8000-000000000012';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const file of fs.readdirSync(new URL('../supabase',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'));
 for(const id of [a,b])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};
 await as(a);const register=async(kind='complete',node='RIO_01',gateway=null)=>(await db.query('select public.kit_register_owned(gen_random_uuid(),$1,$2,$3,$4) as r',[kind,'Equipo',node,gateway])).rows[0].r;
 const source=await register(),target=await register('gateway'),archived=await register('station','RIO_02',source.gateway_id);
 await db.query('update public.kit_stations set deleted_at=now() where id=$1',[archived.station_id]);
 await db.exec('reset role');await db.query("insert into public.kit_readings(station_id,distance_cm,sensor_status,packet,rssi) values($1,40,'OK',1,-70)",[archived.station_id]);await as(a);
 const expected=[source.station_id,archived.station_id],move=(dest=target.gateway_id,name=null,ids=expected)=>db.query('select public.kit_replace_gateway($1,$2,$3,$4)',[source.gateway_id,dest,name,ids]);
 await assert.rejects(move(target.gateway_id,null,[]),/GATEWAY_CHANGED/);
 await as(b);await assert.rejects(move(),/GATEWAY_NOT_OWNED/);
 await assert.rejects(db.query('select public.kit_admin_edit_user($1,$2,true)',[b,'Intruso']),/ADMIN_REQUIRED/);
 const foreign=await register('gateway');await as(a);await assert.rejects(move(foreign.gateway_id),/GATEWAY_NOT_OWNED/);
 const collision=await register('station','RIO_01',target.gateway_id);await assert.rejects(move(),/NODE_ALREADY_REGISTERED/);
 assert.equal((await db.query('select gateway_id from public.kit_stations where id=$1',[source.station_id])).rows[0].gateway_id,source.gateway_id);
 await db.query('update public.kit_stations set deleted_at=now() where id=$1',[collision.station_id]);
 await move(null,'Reemplazo');assert.equal((await db.query('select id from public.kit_gateways where id=$1',[source.gateway_id])).rows.length,0);
 const rows=(await db.query('select id,gateway_id,deleted_at from public.kit_stations where id=any($1)',[expected])).rows;assert.equal(rows.length,2);assert.equal(rows[0].gateway_id,rows[1].gateway_id);assert(rows.find(s=>s.id===archived.station_id).deleted_at);
 await db.exec('reset role');await db.query('insert into public.kit_admins values($1)',[a]);await as(a);
 await db.query('select public.kit_admin_edit_user($1,$2,true)',[b,'Nuevo administrador']);assert.equal((await db.query('select * from public.kit_admins')).rows.length,2);
 await assert.rejects(db.query('select public.kit_admin_edit_user($1,$2,false)',[a,'Yo']),/ADMIN_SELF_CHANGE/);
 await db.query('select public.kit_admin_edit_user($1,$2,false)',[b,'Usuario']);await as(b);await assert.rejects(db.query('select public.kit_admin_edit_user($1,$2,true)',[b,'Intento']),/ADMIN_REQUIRED/);
 await assert.rejects(db.query('select public.kit_admin_transfer_account($1,$2)',[a,b]),/ADMIN_REQUIRED/);
 await as(a);await assert.rejects(db.query('select public.kit_admin_transfer_account($1,$2)',[a,b]),/ADMIN_SELF_CHANGE/);
 await db.query('select public.kit_admin_transfer_account($1,$2)',[b,a]);
 assert.equal((await db.query('select count(*)::int n from public.kit_kits where owner_id=$1',[b])).rows[0].n,0);
 assert.equal((await db.query('select owner_id from public.kit_kits where id=$1',[foreign.kit_id])).rows[0].owner_id,a);
 await db.exec('reset role');await db.query('delete from auth.users where id=$1',[b]);assert.equal((await db.query('select count(*)::int n from public.kit_stations where id=any($1)',[expected])).rows[0].n,2);assert.equal((await db.query('select count(*)::int n from public.kit_readings where station_id=$1',[archived.station_id])).rows[0].n,1);
 }finally{await db.close()}
});
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'},id='00000000-0000-4000-8000-000000000011',other='00000000-0000-4000-8000-000000000012';
async function call(body,method,admin=true,owned=[]){const calls=[],fetcher=async(url,options)=>{calls.push({url,options});let result=url.endsWith('/auth/v1/user')?{id,email_confirmed_at:'now'}:url.includes('kit_admins?')?(admin?[{user_id:id}]:[]):url.includes('kit_kits?')?owned:[];return new Response(JSON.stringify(result),{status:200})};const res={setHeader(){},status(c){this.code=c;return this},json(data){this.data=data}};await makeHandler('kits',{env,fetcher})({method,body,headers:{authorization:'Bearer signed_test_user_token_12345','content-type':'application/json'}},res);return {res,calls}}
test('API bloquea usuario común, autoborrado y cuentas con datos sin llamar Auth Admin',async()=>{
 assert.equal((await call({action:'admin-user',id:other,name:'Otro',admin:true},'PATCH',false)).res.code,403);
 assert.equal((await call({action:'admin-delete-user',id,confirm:id},'DELETE')).res.code,409);
 const blocked=await call({action:'admin-delete-user',id:other,confirm:other},'DELETE',true,[{id}]);assert.equal(blocked.res.code,409);assert(!blocked.calls.some(c=>c.url.includes('/auth/v1/admin')));
 const edit=await call({action:'admin-user',id:other,name:'Otro',admin:true},'PATCH');assert.equal(edit.res.code,200);assert(edit.calls.at(-1).url.endsWith('rpc/kit_admin_edit_user'));assert.equal(edit.calls.at(-1).options.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
});
