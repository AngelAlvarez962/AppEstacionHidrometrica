-- Serialize simultaneous readings for a station before its alert-state transition.
begin;
create or replace function public.kit_ingest(p_hash text,p_station_serial text,p_distance numeric,p_status text,p_packet bigint,p_rssi integer) returns bigint language plpgsql security definer set search_path='' as $$
declare gid uuid; sid uuid; rid bigint;
begin
 select gateway_id into gid from public.kit_gateway_keys where token_hash=p_hash and revoked_at is null for share;
 if not found then raise exception 'DEVICE_NOT_ALLOWED'; end if;
 select id into sid from public.kit_stations where serial=p_station_serial and gateway_id=gid and deleted_at is null and not setup_pending for update;
 if not found then raise exception 'DEVICE_NOT_ALLOWED'; end if;
 insert into public.kit_readings(station_id,distance_cm,sensor_status,packet,rssi) values(sid,p_distance,p_status,p_packet,p_rssi) returning id into rid;
 update public.kit_gateways set last_seen=now() where id=gid;
 return rid;
end $$;
commit;
