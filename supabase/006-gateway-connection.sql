-- Apply after 005. Ownership and all existing measurements remain in place.
begin;
alter table public.kit_profiles add column preferred_gateway_id uuid references public.kit_gateways(id);
alter table public.kit_profiles add column guide_completed boolean not null default false;
grant update(guide_completed) on public.kit_profiles to authenticated;
alter table public.kit_gateways add column hardware_hint text;
alter table public.kit_gateways add column internet_configured_at timestamptz;
alter table public.kit_gateways add column internet_last_seen timestamptz;

create function public.kit_remember_gateway(p_gateway uuid,p_expected uuid,p_confirm boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare previous uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.kit_gateways g join public.kit_kits k on k.id=g.kit_id where g.id=p_gateway and k.owner_id=auth.uid()) then raise exception 'GATEWAY_NOT_OWNED'; end if;
 select preferred_gateway_id into previous from public.kit_profiles where user_id=auth.uid() for update;
 if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
 if previous is distinct from p_expected then raise exception 'GATEWAY_CHANGED'; end if;
 if previous is not null and previous<>p_gateway and not p_confirm then raise exception 'GATEWAY_CONFIRM_REQUIRED'; end if;
 update public.kit_profiles set preferred_gateway_id=p_gateway where user_id=auth.uid();
end $$;
revoke all on function public.kit_remember_gateway(uuid,uuid,boolean) from public,anon;
grant execute on function public.kit_remember_gateway(uuid,uuid,boolean) to authenticated;

-- Pending credentials never appear in snapshots. An interrupted setup keeps the old key.
create table public.kit_gateway_pending (
 gateway_id uuid primary key references public.kit_gateways(id), owner_id uuid not null references auth.users(id),
 ticket uuid not null unique default gen_random_uuid(), token_hash text not null check(token_hash~'^[a-f0-9]{64}$'),
 proof text not null check(proof~'^[a-f0-9]{64}$'), hardware_hint text not null,
 expires_at timestamptz not null default now()+interval '10 minutes'
);
alter table public.kit_gateway_pending enable row level security;
revoke all on public.kit_gateway_pending from anon,authenticated;
grant all on public.kit_gateway_pending to service_role;

create function public.kit_finish_gateway(p_owner uuid,p_ticket uuid,p_proof text) returns uuid
language plpgsql security definer set search_path='' as $$
declare pending public.kit_gateway_pending;
begin
 select * into pending from public.kit_gateway_pending where ticket=p_ticket and owner_id=p_owner and proof=p_proof and expires_at>now() for update;
 if not found then raise exception 'SETUP_EXPIRED'; end if;
 if not exists(select 1 from public.kit_gateways g join public.kit_kits k on k.id=g.kit_id where g.id=pending.gateway_id and k.owner_id=p_owner) then raise exception 'GATEWAY_NOT_OWNED'; end if;
 insert into public.kit_gateway_keys(gateway_id,token_hash) values(pending.gateway_id,pending.token_hash)
 on conflict(gateway_id) do update set token_hash=excluded.token_hash,revoked_at=null;
 update public.kit_gateways set hardware_hint=pending.hardware_hint,internet_configured_at=now() where id=pending.gateway_id;
 delete from public.kit_gateway_pending where gateway_id=pending.gateway_id;
 return pending.gateway_id;
end $$;
revoke all on function public.kit_finish_gateway(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.kit_finish_gateway(uuid,uuid,text) to service_role;

-- Public HTTPS write-only entry point. A publishable key alone authorizes nothing.
-- The random per-device credential is checked before looking up any station.
create function public.kit_receive(p_token text,p_station_serial text,p_distance numeric,p_status text,p_packet bigint,p_rssi integer) returns bigint
language plpgsql security definer set search_path='' as $$
declare digest text; gid uuid; rid bigint;
begin
 if p_token is null or p_token !~ '^GW_[a-f0-9]{64}$' then raise exception 'DEVICE_NOT_ALLOWED'; end if;
 digest=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
 select gateway_id into gid from public.kit_gateway_keys where token_hash=digest and revoked_at is null for update;
 if not found then raise exception 'DEVICE_NOT_ALLOWED'; end if;
 if p_station_serial is null or p_station_serial !~ '^EST-[A-F0-9]{16}$' or p_distance is null or p_distance<0 or p_distance>10000 or p_distance::text in ('NaN','Infinity','-Infinity') or p_packet is null or p_packet<0 or p_rssi is null or p_rssi not between -200 and 0 or p_status is null or p_status not in ('OK','ERR_CABLE','ERR_CORTO','SIN_ECO','MUY_CERCA','FUERA_RANGO','ERR_DESBORDE') then raise exception 'INVALID_READING'; end if;
 if not exists(select 1 from public.kit_stations where serial=p_station_serial and gateway_id=gid and deleted_at is null and not setup_pending) then raise exception 'DEVICE_NOT_ALLOWED'; end if;
 -- Retries from a device must not create multiple samples for one recent packet.
 select r.id into rid from public.kit_readings r join public.kit_stations s on s.id=r.station_id where s.serial=p_station_serial and r.packet=p_packet and r.distance_cm=p_distance and r.sensor_status=p_status and r.received_at>now()-interval '30 seconds' order by r.id desc limit 1;
 if rid is null then rid=public.kit_ingest(digest,p_station_serial,p_distance,p_status,p_packet,p_rssi); end if;
 update public.kit_gateways set internet_last_seen=now() where id=gid;
 return rid;
end $$;
revoke all on function public.kit_receive(text,text,numeric,text,bigint,integer) from public;
grant execute on function public.kit_receive(text,text,numeric,text,bigint,integer) to anon,authenticated;
commit;
