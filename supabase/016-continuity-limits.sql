begin;
create or replace function public.kit_watch_start(p_station uuid,p_days integer) returns uuid language plpgsql security definer set search_path='' as $$
declare run uuid; actor uuid:=auth.uid();
begin
 if p_days not between 1 and 7 or actor is null or not exists(select 1 from public.kit_stations s join public.kit_kits k on k.id=s.kit_id where s.id=p_station and k.owner_id=actor and s.deleted_at is null and not s.setup_pending) then raise exception 'DEVICE_NOT_ALLOWED';end if;
 perform pg_catalog.pg_advisory_xact_lock(hashtext(actor::text));
 if (select count(*) from public.kit_watch_runs where owner_id=actor and started_at>now()-interval '1 day')>=10 then raise exception 'WATCH_RATE_LIMIT';end if;
 perform pg_catalog.pg_advisory_xact_lock(hashtext(p_station::text));
 if exists(select 1 from public.kit_watch_runs where station_id=p_station and stopped_at is null) then raise exception 'WATCH_ALREADY_ACTIVE';end if;
 insert into public.kit_watch_runs(station_id,owner_id,ends_at) values(p_station,actor,now()+make_interval(days=>p_days)) returning id into run;
 perform public.kit_watch_sample(p_station);
 update public.kit_watch_logs set kind='inicio' where run_id=run;
 if exists(select 1 from public.kit_telegram where owner_id=actor and enabled and chat_id is not null) then
 insert into public.kit_telegram_outbox(owner_id,station_id,severity,station_name,station_code,context_status)
 select actor,s.id,'started',s.name,s.friendly_code,w.status from public.kit_stations s join public.kit_watch_state w on w.station_id=s.id where s.id=p_station;
 end if;
 return run;
end $$;

commit;
