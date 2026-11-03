import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {makeHandler} from '../lib/server.js';
test('propietaria conserva administrador ante otro admin, RPC, acceso directo y eliminación en Auth',async()=>{
 const db=new PGlite(),owner='00000000-0000-4000-8000-000000000011',other='00000000-0000-4000-8000-000000000012';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const f of fs.readdirSync(new URL('../supabase',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(new URL('../supabase/'+f,import.meta.url),'utf8'));
 for(const id of [owner,other]){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);await db.query('insert into public.kit_admins values($1)',[id])}
 await db.query('insert into public.kit_owner(user_id) values($1)',[owner]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);await db.exec('set role authenticated');
 await assert.rejects(db.query('select public.kit_admin_edit_user($1,$2,false)',[owner,'No se guarda']),/OWNER_ACCOUNT_PROTECTED/);
 await db.query('select public.kit_admin_edit_user($1,$2,true)',[owner,'Dueña']);
 await assert.rejects(db.query('delete from public.kit_owner'),/permission denied/);
 await assert.rejects(db.query('update public.kit_owner set user_id=$1',[other]),/permission denied/);
 await db.exec('reset role');
 await assert.rejects(db.query('delete from public.kit_admins where user_id=$1',[owner]),/OWNER_ACCOUNT_PROTECTED/);
 await assert.rejects(db.query('update public.kit_admins set user_id=gen_random_uuid() where user_id=$1',[owner]),/OWNER_ACCOUNT_PROTECTED/);
 await assert.rejects(db.query('delete from auth.users where id=$1',[owner]),/OWNER_ACCOUNT_PROTECTED|foreign key/);
 assert.equal((await db.query('select display_name from public.kit_profiles where user_id=$1',[owner])).rows[0].display_name,'Dueña');
 }finally{await db.close()}
});
test('API responde con explicación de cuenta propietaria sin enviar cambios ni borrar Auth',async()=>{
 const owner='00000000-0000-4000-8000-000000000011',actor='00000000-0000-4000-8000-000000000012',env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
 for(const action of ['admin-user','admin-delete-user']){
 const calls=[],fetcher=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.endsWith('/auth/v1/user')?{id:actor,email_confirmed_at:'now'}:url.includes('kit_admins?')?[{user_id:actor}]:url.includes('kit_owner?')?[{user_id:owner}]:[]),{status:200})},res={setHeader(){},status(c){this.code=c;return this},json(d){this.data=d}};
 await makeHandler('kits',{env,fetcher})({method:action==='admin-user'?'PATCH':'DELETE',body:{action,id:owner,name:'Dueña',admin:false,confirm:owner},headers:{authorization:'Bearer signed_test_user_token_12345','content-type':'application/json'}},res);
 assert.equal(res.code,409);assert.match(res.data.error,/propietaria/);assert(!calls.some(c=>c.url.includes('rpc/kit_admin_edit_user')||c.url.includes('/auth/v1/admin')));
 }
});
