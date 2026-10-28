-- Owned device registration; no activation code or administrator preparation.
begin;
alter table public.kit_kits add column registration_id uuid;
create unique index kit_registration_retry on public.kit_kits(owner_id,registration_id) where registration_id is not null;
create function public.kit_register_owned(p_request uuid,p_kind text,p_name text,p_node text default 'RIO_01',p_gateway uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); k public.kit_kits; g public.kit_gateways; s public.kit_stations;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'CONFIRMED_USER_REQUIRED'; end if;
 if p_request is null or p_kind is null or p_kind not in ('complete','station','gateway') or p_name is null or length(trim(p_name)) not between 1 and 120 then raise exception 'INVALID_REGISTRATION'; end if;
 if p_kind<>'gateway' and (p_node is null or p_node!~'^[A-Za-z0-9_-]{1,32}$') then raise exception 'INVALID_NODE'; end if;
 if p_gateway is not null and p_kind<>'station' then raise exception 'INVALID_REGISTRATION'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(actor::text));
 select * into k from public.kit_kits where owner_id=actor and registration_id=p_request;
 if found then
  if k.kind<>p_kind then raise exception 'REGISTRATION_CONFLICT'; end if;
  return jsonb_build_object('kit_id',k.id,'gateway_id',coalesce((select id from public.kit_gateways where kit_id=k.id),(select gateway_id from public.kit_stations where kit_id=k.id limit 1)),'station_id',(select id from public.kit_stations where kit_id=k.id limit 1));
 end if;
 if (select count(*) from public.kit_kits where owner_id=actor and registration_id is not null and created_at>now()-interval '1 hour')>=20 then raise exception 'REGISTRATION_LIMIT'; end if;
 if p_gateway is not null then
  select g1.* into g from public.kit_gateways g1 join public.kit_kits k1 on k1.id=g1.kit_id where g1.id=p_gateway and k1.owner_id=actor for update of g1;
  if not found then raise exception 'GATEWAY_NOT_OWNED'; end if;
  if exists(select 1 from public.kit_stations where gateway_id=g.id and node_label=p_node and deleted_at is null) then raise exception 'NODE_ALREADY_REGISTERED'; end if;
 end if;
 insert into public.kit_kits(serial,kind,owner_id,claimed_at,registration_id) values('HI-'||upper(replace(gen_random_uuid()::text,'-','')),p_kind,actor,now(),p_request) returning * into k;
 if p_kind in ('complete','gateway') then
  insert into public.kit_gateways(kit_id,serial,name) values(k.id,'GW-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),case when p_kind='gateway' then trim(p_name) else 'Mi gateway' end) returning * into g;
 end if;
 if p_kind in ('complete','station') then
  insert into public.kit_stations(kit_id,gateway_id,serial,node_label,name) values(k.id,g.id,'EST-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),p_node,trim(p_name)) returning * into s;
 end if;
 return jsonb_build_object('kit_id',k.id,'gateway_id',g.id,'station_id',s.id);
end $$;
revoke all on function public.kit_register_owned(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.kit_register_owned(uuid,text,text,text,uuid) to authenticated;
commit;
