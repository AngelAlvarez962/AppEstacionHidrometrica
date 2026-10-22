begin;
-- Remember a receiver and move only explicitly selected stations, as one transaction.
create function public.kit_connect_gateway(p_gateway uuid,p_expected uuid,p_confirm boolean,p_stations uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare previous uuid; item public.kit_stations; moved integer=0;
begin
 if auth.uid() is null or not exists(select 1 from public.kit_gateways g join public.kit_kits k on k.id=g.kit_id where g.id=p_gateway and k.owner_id=auth.uid()) then raise exception 'GATEWAY_NOT_OWNED'; end if;
 select preferred_gateway_id into previous from public.kit_profiles where user_id=auth.uid() for update;
 if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
 if previous is distinct from p_expected then raise exception 'GATEWAY_CHANGED'; end if;
 if previous is not null and previous<>p_gateway and not p_confirm then raise exception 'GATEWAY_CONFIRM_REQUIRED'; end if;
 if p_stations is null or cardinality(p_stations)>100 then raise exception 'GATEWAY_CHANGED'; end if;
 if cardinality(p_stations)>0 and (previous is null or previous=p_gateway or not p_confirm) then raise exception 'GATEWAY_CONFIRM_REQUIRED'; end if;
 for item in select * from public.kit_stations where id=any(p_stations) order by id for update loop
  if item.gateway_id is distinct from previous or item.deleted_at is not null or not exists(select 1 from public.kit_kits k where k.id=item.kit_id and k.owner_id=auth.uid()) then raise exception 'GATEWAY_NOT_OWNED'; end if;
  update public.kit_stations set gateway_id=p_gateway where id=item.id; moved=moved+1;
 end loop;
 if moved<>cardinality(p_stations) then raise exception 'GATEWAY_CHANGED'; end if;
 update public.kit_profiles set preferred_gateway_id=p_gateway where user_id=auth.uid();
end $$;
revoke all on function public.kit_connect_gateway(uuid,uuid,boolean,uuid[]) from public,anon;
grant execute on function public.kit_connect_gateway(uuid,uuid,boolean,uuid[]) to authenticated;

-- A sample forwarded by USB and Wi-Fi at the same time counts only once.
create or replace function public.kit_ingest(p_hash text,p_station_serial text,p_distance numeric,p_status text,p_packet bigint,p_rssi integer) returns bigint language plpgsql security definer set search_path='' as $$
declare gid uuid;sid uuid;rid bigint;
begin
 select gateway_id into gid from public.kit_gateway_keys where token_hash=p_hash and revoked_at is null for share;
 if not found then raise exception 'DEVICE_NOT_ALLOWED'; end if;
 select id into sid from public.kit_stations where serial=p_station_serial and gateway_id=gid and deleted_at is null and not setup_pending for update;
 if not found then raise exception 'DEVICE_NOT_ALLOWED'; end if;
 select id into rid from public.kit_readings where station_id=sid and packet=p_packet and distance_cm=p_distance and sensor_status=p_status and received_at>now()-interval '30 seconds' order by id desc limit 1;
 if rid is null then insert into public.kit_readings(station_id,distance_cm,sensor_status,packet,rssi) values(sid,p_distance,p_status,p_packet,p_rssi) returning id into rid;end if;
 update public.kit_gateways set last_seen=now() where id=gid;
 return rid;
end $$;
commit;
