-- Primera instalación. Tablas nuevas: no modifica el portal anterior.
begin;
create table public.kit_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.kit_kits (
  id uuid primary key default gen_random_uuid(), serial text not null unique,
  owner_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), claimed_at timestamptz
);
create table public.kit_gateways (
  id uuid primary key default gen_random_uuid(), kit_id uuid not null unique references public.kit_kits(id) on delete restrict,
  serial text not null unique, name text not null check(length(name) between 1 and 120),
  last_seen timestamptz, created_at timestamptz not null default now()
);
create table public.kit_stations (
  id uuid primary key default gen_random_uuid(), gateway_id uuid not null references public.kit_gateways(id) on delete restrict,
  serial text not null unique, node_label text not null, name text not null check(length(name) between 1 and 120),
  location text not null default '' check(length(location)<=180),
  bed_height numeric, capacity_height numeric, yellow_alert numeric, red_alert numeric,
  created_at timestamptz not null default now(),
  check ((bed_height is null and capacity_height is null and yellow_alert is null and red_alert is null) or
    (bed_height is not null and capacity_height is not null and yellow_alert is not null and red_alert is not null and
    bed_height > 20 and bed_height <= 600 and capacity_height > 0 and capacity_height <= bed_height and
    yellow_alert >= 0 and yellow_alert < red_alert and red_alert <= capacity_height))
);
create table public.kit_readings (
  id bigint generated always as identity primary key,
  station_id uuid not null references public.kit_stations(id) on delete restrict,
  distance_cm numeric not null check(distance_cm>=0 and distance_cm<=10000),
  sensor_status text not null check(sensor_status in ('OK','ERR_CABLE','ERR_CORTO','SIN_ECO','MUY_CERCA','FUERA_RANGO','ERR_DESBORDE')),
  packet bigint not null check(packet>=0), rssi integer not null check(rssi between -200 and 0),
  received_at timestamptz not null default now()
);
create index kit_readings_station_time on public.kit_readings(station_id,received_at desc,id desc);
create table public.kit_activation_keys (
  kit_id uuid primary key references public.kit_kits(id),
  code_hash text not null unique check(code_hash ~ '^[0-9a-f]{64}$'), consumed_at timestamptz
);
create table public.kit_gateway_keys (
  gateway_id uuid primary key references public.kit_gateways(id),
  token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'), revoked_at timestamptz
);
create table public.kit_claim_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started timestamptz not null default now(), attempts integer not null default 0
);

alter table public.kit_admins enable row level security;
alter table public.kit_kits enable row level security;
alter table public.kit_gateways enable row level security;
alter table public.kit_stations enable row level security;
alter table public.kit_readings enable row level security;
alter table public.kit_activation_keys enable row level security;
alter table public.kit_gateway_keys enable row level security;
alter table public.kit_claim_attempts enable row level security;
revoke all on public.kit_admins,public.kit_kits,public.kit_gateways,public.kit_stations,public.kit_readings,public.kit_activation_keys,public.kit_gateway_keys from anon,authenticated;
revoke all on public.kit_claim_attempts from anon,authenticated;
grant select on public.kit_admins,public.kit_kits,public.kit_gateways,public.kit_stations,public.kit_readings to authenticated;
grant update(name) on public.kit_gateways to authenticated;
grant update(name,location,bed_height,capacity_height,yellow_alert,red_alert) on public.kit_stations to authenticated;
grant all on public.kit_admins,public.kit_kits,public.kit_gateways,public.kit_stations,public.kit_readings,public.kit_activation_keys,public.kit_gateway_keys to service_role;
grant all on public.kit_claim_attempts to service_role;
grant usage,select on sequence public.kit_readings_id_seq to service_role;
create policy kit_admin_self on public.kit_admins for select to authenticated using(user_id=auth.uid());
create policy kit_owner_read on public.kit_kits for select to authenticated using(owner_id=auth.uid());
create policy kit_gateway_read on public.kit_gateways for select to authenticated using(exists(select 1 from public.kit_kits k where k.id=kit_id and k.owner_id=auth.uid()));
create policy kit_gateway_edit on public.kit_gateways for update to authenticated using(exists(select 1 from public.kit_kits k where k.id=kit_id and k.owner_id=auth.uid())) with check(exists(select 1 from public.kit_kits k where k.id=kit_id and k.owner_id=auth.uid()));
create policy kit_station_read on public.kit_stations for select to authenticated using(exists(select 1 from public.kit_gateways g where g.id=gateway_id));
create policy kit_station_edit on public.kit_stations for update to authenticated using(exists(select 1 from public.kit_gateways g where g.id=gateway_id)) with check(exists(select 1 from public.kit_gateways g where g.id=gateway_id));
create policy kit_reading_read on public.kit_readings for select to authenticated using(exists(select 1 from public.kit_stations s where s.id=station_id));

-- Server-only functions: public clients cannot execute them or read activation/device hashes.
create function public.kit_claim(p_owner uuid,p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare keyrow public.kit_activation_keys; kitrow public.kit_kits; attemptrow public.kit_claim_attempts;
begin
  if not exists(select 1 from auth.users where id=p_owner and email_confirmed_at is not null) then return jsonb_build_object('error','EMAIL_NOT_CONFIRMED'); end if;
  insert into public.kit_claim_attempts(user_id) values(p_owner) on conflict do nothing;
  select * into attemptrow from public.kit_claim_attempts where user_id=p_owner for update;
  if attemptrow.window_started < now()-interval '1 hour' then
    update public.kit_claim_attempts set window_started=now(),attempts=1 where user_id=p_owner;
  elsif attemptrow.attempts>=10 then return jsonb_build_object('error','RATE_LIMIT');
  else update public.kit_claim_attempts set attempts=attempts+1 where user_id=p_owner;
  end if;
  select * into keyrow from public.kit_activation_keys where code_hash=p_hash for update;
  if not found or keyrow.consumed_at is not null then return jsonb_build_object('error','KIT_NOT_AVAILABLE'); end if;
  select * into kitrow from public.kit_kits where id=keyrow.kit_id for update;
  if kitrow.owner_id is not null then return jsonb_build_object('error','KIT_NOT_AVAILABLE'); end if;
  update public.kit_kits set owner_id=p_owner,claimed_at=now() where id=kitrow.id;
  update public.kit_activation_keys set consumed_at=now() where kit_id=kitrow.id;
  return jsonb_build_object('kit_id',kitrow.id);
end $$;
create function public.kit_create(p_actor uuid,p_kit_serial text,p_gateway_serial text,p_code_hash text,p_token_hash text,p_stations jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare kid uuid; gid uuid; item jsonb;
begin
  if not exists(select 1 from public.kit_admins where user_id=p_actor) then raise exception 'ADMIN_REQUIRED'; end if;
  if jsonb_typeof(p_stations)<>'array' or jsonb_array_length(p_stations) not between 1 and 8 then raise exception 'INVALID_STATIONS'; end if;
  insert into public.kit_kits(serial) values(p_kit_serial) returning id into kid;
  insert into public.kit_gateways(kit_id,serial,name) values(kid,p_gateway_serial,'Mi gateway') returning id into gid;
  insert into public.kit_activation_keys(kit_id,code_hash) values(kid,p_code_hash);
  insert into public.kit_gateway_keys(gateway_id,token_hash) values(gid,p_token_hash);
  for item in select value from jsonb_array_elements(p_stations) loop
    insert into public.kit_stations(gateway_id,serial,node_label,name) values(gid,item->>'serial',item->>'node_label',item->>'name');
  end loop;
  return kid;
end $$;
create function public.kit_ingest(p_hash text,p_station_serial text,p_distance numeric,p_status text,p_packet bigint,p_rssi integer) returns bigint language plpgsql security definer set search_path='' as $$
declare gid uuid; sid uuid; rid bigint;
begin
  -- Serialize against credential revocation; only accept stations bound to this gateway.
  select gateway_id into gid from public.kit_gateway_keys where token_hash=p_hash and revoked_at is null for share;
  if not found then raise exception 'DEVICE_NOT_ALLOWED'; end if;
  select id into sid from public.kit_stations where serial=p_station_serial and gateway_id=gid;
  if not found then raise exception 'DEVICE_NOT_ALLOWED'; end if;
  insert into public.kit_readings(station_id,distance_cm,sensor_status,packet,rssi) values(sid,p_distance,p_status,p_packet,p_rssi) returning id into rid;
  update public.kit_gateways set last_seen=now() where id=gid;
  return rid;
end $$;
revoke all on function public.kit_claim(uuid,text),public.kit_create(uuid,text,text,text,text,jsonb),public.kit_ingest(text,text,numeric,text,bigint,integer) from public,anon,authenticated;
grant execute on function public.kit_claim(uuid,text),public.kit_create(uuid,text,text,text,text,jsonb),public.kit_ingest(text,text,numeric,text,bigint,integer) to service_role;
create function public.kit_snapshot() returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object(
    'admin',exists(select 1 from public.kit_admins where user_id=auth.uid()),
    'kits',coalesce((select jsonb_agg(k) from public.kit_kits k),'[]'::jsonb),
    'gateways',coalesce((select jsonb_agg(g order by g.created_at) from public.kit_gateways g),'[]'::jsonb),
    'stations',coalesce((select jsonb_agg(s order by s.created_at) from public.kit_stations s),'[]'::jsonb),
    'readings',coalesce((select jsonb_agg(r order by r.received_at,r.id) from public.kit_stations s cross join lateral
      (select * from public.kit_readings where station_id=s.id order by received_at desc,id desc limit 120) r),'[]'::jsonb)
  )
$$;
revoke all on function public.kit_snapshot() from public,anon;
grant execute on function public.kit_snapshot() to authenticated;
commit;
