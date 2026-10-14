-- Apply once, after 001 and 002. Preserves existing devices and readings.
begin;
create sequence public.kit_display_seq;
create sequence public.kit_gateway_display_seq;
create sequence public.kit_station_display_seq;
alter table public.kit_kits add column kind text not null default 'complete' check(kind in ('complete','station','gateway'));
alter table public.kit_kits add column friendly_code text not null unique default ('KIT-'||lpad(nextval('public.kit_display_seq')::text,6,'0'));
alter table public.kit_gateways add column friendly_code text not null unique default ('GW-'||lpad(nextval('public.kit_gateway_display_seq')::text,6,'0'));
alter table public.kit_stations add column friendly_code text not null unique default ('EST-'||lpad(nextval('public.kit_station_display_seq')::text,6,'0'));
alter table public.kit_stations add column kit_id uuid references public.kit_kits(id) on delete restrict;
update public.kit_stations s set kit_id=g.kit_id from public.kit_gateways g where s.gateway_id=g.id;
alter table public.kit_stations alter column kit_id set not null;
alter table public.kit_stations alter column gateway_id drop not null;
alter table public.kit_stations add column setup_pending boolean generated always as (gateway_id is null or bed_height is null) stored;
create index kit_station_kit on public.kit_stations(kit_id);
grant usage,select on sequence public.kit_display_seq,public.kit_gateway_display_seq,public.kit_station_display_seq to service_role;
grant update(gateway_id) on public.kit_stations to authenticated;
drop policy kit_station_read on public.kit_stations;
drop policy kit_station_edit on public.kit_stations;
create policy kit_station_read on public.kit_stations for select to authenticated using(
 public.kit_is_admin() or exists(select 1 from public.kit_kits k where k.id=kit_id and k.owner_id=auth.uid()));
create policy kit_station_edit on public.kit_stations for update to authenticated using(
 public.kit_is_admin() or exists(select 1 from public.kit_kits k where k.id=kit_id and k.owner_id=auth.uid())) with check(
 public.kit_is_admin() or exists(select 1 from public.kit_kits k where k.id=kit_id and k.owner_id=auth.uid()));

-- Lock both kit rows in a consistent order; never allow a foreign buyer's gateway.
create function public.kit_check_station_links() returns trigger language plpgsql security definer set search_path='' as $$
declare gkit uuid; station_owner uuid; gateway_owner uuid;
begin
 if new.gateway_id is not null then
  select kit_id into gkit from public.kit_gateways where id=new.gateway_id;
  perform id from public.kit_kits where id in (new.kit_id,gkit) order by id for share;
  select owner_id into station_owner from public.kit_kits where id=new.kit_id;
  select owner_id into gateway_owner from public.kit_kits where id=gkit;
  if gkit is null or (gkit<>new.kit_id and (station_owner is null or station_owner is distinct from gateway_owner)) then raise exception 'GATEWAY_NOT_OWNED'; end if;
 end if;
 return new;
end $$;
revoke all on function public.kit_check_station_links() from public,anon,authenticated;
create trigger kit_station_links before insert or update of gateway_id,kit_id on public.kit_stations for each row execute function public.kit_check_station_links();
create or replace function public.kit_check_personal_entity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.personal_entity_id is not null and not exists(select 1 from public.kit_personal_entities e join public.kit_kits k on k.id=new.kit_id where e.id=new.personal_entity_id and e.owner_id=k.owner_id) then raise exception 'ENTITY_NOT_OWNED'; end if;
 return new;
end $$;

-- Each new presentation is a physical unit. A buyer can activate additional kits later.
create function public.kit_prepare(p_actor uuid,p_kind text,p_kit_serial text,p_gateway_serial text,p_code_hash text,p_token_hash text,p_station_serial text) returns jsonb language plpgsql security definer set search_path='' as $$
declare k public.kit_kits; g public.kit_gateways; s public.kit_stations;
begin
 if not exists(select 1 from public.kit_admins where user_id=p_actor) then raise exception 'ADMIN_REQUIRED'; end if;
 if p_kind not in ('complete','station','gateway') or p_kind is null then raise exception 'INVALID_PRESENTATION'; end if;
 insert into public.kit_kits(serial,kind) values(p_kit_serial,p_kind) returning * into k;
 insert into public.kit_activation_keys(kit_id,code_hash) values(k.id,p_code_hash);
 if p_kind in ('complete','gateway') then
  insert into public.kit_gateways(kit_id,serial,name) values(k.id,p_gateway_serial,'Mi gateway') returning * into g;
  insert into public.kit_gateway_keys(gateway_id,token_hash) values(g.id,p_token_hash);
 end if;
 if p_kind in ('complete','station') then
  insert into public.kit_stations(kit_id,gateway_id,serial,node_label,name) values(k.id,g.id,p_station_serial,'RIO_01','Mi estación') returning * into s;
 end if;
 return jsonb_build_object('kit_id',k.id,'serial',k.serial,'kind',k.kind,'friendly_code',k.friendly_code,
  'gateway',case when g.id is null then null else to_jsonb(g) end,
  'stations',case when s.id is null then '[]'::jsonb else jsonb_build_array(to_jsonb(s)) end);
end $$;
revoke all on function public.kit_prepare(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.kit_prepare(uuid,text,text,text,text,text,text) to service_role;
-- Old count-based preparation is retired; old inventory is retained.
revoke execute on function public.kit_create(uuid,text,text,text,text,jsonb) from service_role;
create or replace function public.kit_ingest(p_hash text,p_station_serial text,p_distance numeric,p_status text,p_packet bigint,p_rssi integer) returns bigint language plpgsql security definer set search_path='' as $$
declare gid uuid; sid uuid; rid bigint;
begin
 select gateway_id into gid from public.kit_gateway_keys where token_hash=p_hash and revoked_at is null for share;
 if not found then raise exception 'DEVICE_NOT_ALLOWED'; end if;
 select id into sid from public.kit_stations where serial=p_station_serial and gateway_id=gid and deleted_at is null and not setup_pending for share;
 if not found then raise exception 'DEVICE_NOT_ALLOWED'; end if;
 insert into public.kit_readings(station_id,distance_cm,sensor_status,packet,rssi) values(sid,p_distance,p_status,p_packet,p_rssi) returning id into rid;
 update public.kit_gateways set last_seen=now() where id=gid;
 return rid;
end $$;
commit;
