begin;
-- Admin rights come only from kit_admins; signup metadata never grants roles.
create function public.kit_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.kit_admins where user_id=auth.uid());
$$;
revoke all on function public.kit_is_admin() from public,anon;
grant execute on function public.kit_is_admin() to authenticated,service_role;
create policy kit_admin_read_all on public.kit_kits for select to authenticated using(public.kit_is_admin());
create policy kit_admin_gateway_read on public.kit_gateways for select to authenticated using(public.kit_is_admin());
create policy kit_admin_gateway_edit on public.kit_gateways for update to authenticated using(public.kit_is_admin()) with check(public.kit_is_admin());
-- Station policies check visible gateways. Admins now see/edit all stations;
-- buyers still only see parents they own.

create table public.kit_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 1 and 120)
);
alter table public.kit_profiles enable row level security;
revoke all on public.kit_profiles from anon,authenticated;
grant select on public.kit_profiles to authenticated;
grant update(display_name) on public.kit_profiles to authenticated;
grant all on public.kit_profiles to service_role;
create policy kit_profile_read on public.kit_profiles for select to authenticated using(user_id=auth.uid() or public.kit_is_admin());
create policy kit_profile_edit on public.kit_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create function public.kit_new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.kit_profiles(user_id,display_name) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),nullif(split_part(new.email,'@',1),''),'Comprador'),120)) on conflict(user_id) do nothing;
 return new;
end $$;
revoke all on function public.kit_new_profile() from public,anon,authenticated;
create trigger kit_profile_signup after insert on auth.users for each row execute function public.kit_new_profile();
insert into public.kit_profiles(user_id,display_name)
select id,left(coalesce(nullif(trim(raw_user_meta_data->>'display_name'),''),nullif(split_part(email,'@',1),''),'Comprador'),120) from auth.users on conflict(user_id) do nothing;

create table public.kit_personal_entities (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 120),created_at timestamptz not null default now()
);
create unique index kit_personal_entity_name on public.kit_personal_entities(owner_id,lower(trim(name)));
alter table public.kit_personal_entities enable row level security;
revoke all on public.kit_personal_entities from anon,authenticated;
grant select,insert,delete on public.kit_personal_entities to authenticated;
grant update(name) on public.kit_personal_entities to authenticated;
grant all on public.kit_personal_entities to service_role;
create policy kit_personal_entity_read on public.kit_personal_entities for select to authenticated using(owner_id=auth.uid() or public.kit_is_admin());
create policy kit_personal_entity_add on public.kit_personal_entities for insert to authenticated with check(owner_id=auth.uid());
create policy kit_personal_entity_edit on public.kit_personal_entities for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy kit_personal_entity_delete on public.kit_personal_entities for delete to authenticated using(owner_id=auth.uid());
alter table public.kit_stations add column personal_entity_id uuid references public.kit_personal_entities(id) on delete set null;
alter table public.kit_stations add column deleted_at timestamptz;
grant update(personal_entity_id,deleted_at) on public.kit_stations to authenticated;
create function public.kit_check_personal_entity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.personal_entity_id is not null and not exists(
   select 1 from public.kit_personal_entities e join public.kit_gateways g on g.id=new.gateway_id
   join public.kit_kits k on k.id=g.kit_id where e.id=new.personal_entity_id and e.owner_id=k.owner_id
 ) then raise exception 'ENTITY_NOT_OWNED'; end if;
 return new;
end $$;
revoke all on function public.kit_check_personal_entity() from public,anon,authenticated;
create trigger kit_station_entity_check before insert or update of personal_entity_id,gateway_id on public.kit_stations for each row execute function public.kit_check_personal_entity();

-- Independent admin folders. Buyers cannot read their names or membership.
create table public.kit_admin_entities (
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 120),
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create unique index kit_admin_entity_name on public.kit_admin_entities(lower(trim(name)));
create table public.kit_admin_entity_stations (
 entity_id uuid not null references public.kit_admin_entities(id) on delete cascade,
 station_id uuid not null unique references public.kit_stations(id) on delete cascade,
 primary key(entity_id,station_id)
);
alter table public.kit_admin_entities enable row level security;
alter table public.kit_admin_entity_stations enable row level security;
revoke all on public.kit_admin_entities,public.kit_admin_entity_stations from anon,authenticated;
grant select,insert,delete on public.kit_admin_entities to authenticated;
grant update(name) on public.kit_admin_entities to authenticated;
grant select,insert,delete on public.kit_admin_entity_stations to authenticated;
grant all on public.kit_admin_entities,public.kit_admin_entity_stations to service_role;
-- UPDATE(name) cannot change creator; existing entities may be renamed by any admin.
create policy kit_admin_entity_read on public.kit_admin_entities for select to authenticated using(public.kit_is_admin());
create policy kit_admin_entity_insert on public.kit_admin_entities for insert to authenticated with check(public.kit_is_admin() and created_by=auth.uid());
create policy kit_admin_entity_update on public.kit_admin_entities for update to authenticated using(public.kit_is_admin()) with check(public.kit_is_admin());
create policy kit_admin_entity_delete on public.kit_admin_entities for delete to authenticated using(public.kit_is_admin());
create policy kit_admin_entity_station_access on public.kit_admin_entity_stations for all to authenticated using(public.kit_is_admin()) with check(public.kit_is_admin());
create function public.kit_set_admin_entity(p_station uuid,p_entity uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.kit_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 if not exists(select 1 from public.kit_stations where id=p_station) then raise exception 'STATION_NOT_FOUND'; end if;
 delete from public.kit_admin_entity_stations where station_id=p_station;
 if p_entity is not null then insert into public.kit_admin_entity_stations(entity_id,station_id) values(p_entity,p_station); end if;
end $$;
revoke all on function public.kit_set_admin_entity(uuid,uuid) from public,anon;
grant execute on function public.kit_set_admin_entity(uuid,uuid) to authenticated;

create or replace function public.kit_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object(
   'admin',public.kit_is_admin(),
   'kits',coalesce((select jsonb_agg(k) from public.kit_kits k),'[]'::jsonb),
   'profiles',coalesce((select jsonb_agg(p) from public.kit_profiles p),'[]'::jsonb),
   'gateways',coalesce((select jsonb_agg(g order by g.created_at) from public.kit_gateways g),'[]'::jsonb),
   'stations',coalesce((select jsonb_agg(s order by s.created_at) from public.kit_stations s where deleted_at is null),'[]'::jsonb),
   'archivedStations',coalesce((select jsonb_agg(s order by s.deleted_at desc) from public.kit_stations s where deleted_at is not null),'[]'::jsonb),
   'personalEntities',coalesce((select jsonb_agg(e order by e.name) from public.kit_personal_entities e),'[]'::jsonb),
   'adminEntities',coalesce((select jsonb_agg(e order by e.name) from public.kit_admin_entities e),'[]'::jsonb),
   'adminAssignments',coalesce((select jsonb_agg(a) from public.kit_admin_entity_stations a),'[]'::jsonb),
   'readings',coalesce((select jsonb_agg(r order by r.received_at,r.id) from public.kit_stations s cross join lateral
    (select * from public.kit_readings where station_id=s.id order by received_at desc,id desc limit 120) r where s.deleted_at is null),'[]'::jsonb)
 );
$$;
create or replace function public.kit_ingest(p_hash text,p_station_serial text,p_distance numeric,p_status text,p_packet bigint,p_rssi integer) returns bigint language plpgsql security definer set search_path='' as $$
declare gid uuid; sid uuid; rid bigint;
begin
 select gateway_id into gid from public.kit_gateway_keys where token_hash=p_hash and revoked_at is null for share;
 if not found then raise exception 'DEVICE_NOT_ALLOWED'; end if;
 -- Lock station while checking status; a removal cannot race past this check.
 select id into sid from public.kit_stations where serial=p_station_serial and gateway_id=gid and deleted_at is null for share;
 if not found then raise exception 'DEVICE_NOT_ALLOWED'; end if;
 insert into public.kit_readings(station_id,distance_cm,sensor_status,packet,rssi) values(sid,p_distance,p_status,p_packet,p_rssi) returning id into rid;
 update public.kit_gateways set last_seen=now() where id=gid;
 return rid;
end $$;
commit;
