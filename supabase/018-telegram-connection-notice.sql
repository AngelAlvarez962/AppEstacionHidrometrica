begin;
create or replace function public.kit_watch_sample(p_station uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.kit_stations; r public.kit_readings; old public.kit_watch_state; run public.kit_watch_runs; actor uuid; v text; lvl numeric; fresh boolean; changed boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(hashtext(p_station::text));
 select * into s from public.kit_stations where id=p_station;
 if s.id is null or s.deleted_at is not null or s.setup_pending then return;end if;
 select owner_id into actor from public.kit_kits where id=s.kit_id;
 select * into r from public.kit_readings where station_id=s.id order by received_at desc limit 1;
 fresh:=r.received_at>now()-interval '90 seconds';
 lvl:=case when fresh and r.sensor_status='OK' and r.distance_cm>20 and r.distance_cm<=600 then greatest(0,s.bed_height-r.distance_cm) end;
 v:=case when not coalesce(fresh,false) then case when exists(select 1 from public.kit_gateways g where g.id=s.gateway_id and g.last_seen>now()-interval '90 seconds') then 'radio' else 'offline' end when lvl is null then 'error' when lvl>=s.red_alert then 'red' when lvl>=s.yellow_alert then 'yellow' else 'normal' end;
 select * into old from public.kit_watch_state where station_id=s.id;
 changed:=old.status is distinct from v;
 select * into run from public.kit_watch_runs where station_id=s.id and stopped_at is null for update;
 if run.id is not null then
  if changed or run.last_hour is null or run.last_hour<=now()-interval '1 hour' then
   insert into public.kit_watch_logs(run_id,kind,status,last_reading,distance_cm,level_cm) values(run.id,case when changed then 'cambio' else 'hora' end,v,r.received_at,r.distance_cm,lvl);
   if run.last_hour is null or run.last_hour<=now()-interval '1 hour' then update public.kit_watch_runs set last_hour=now() where id=run.id;end if;
  end if;
 end if;
 if (changed or old.notified_at is null or (v<>'normal' and old.notified_at<=now()-interval '24 hours'))
 and exists(select 1 from public.kit_telegram t join auth.users u on u.id=t.owner_id where t.owner_id=actor and t.enabled and t.chat_id is not null and u.email_confirmed_at is not null)
 and (select count(*) from public.kit_telegram_outbox o where o.owner_id=actor and o.created_at>now()-interval '1 day')<60 then
  insert into public.kit_telegram_outbox(owner_id,station_id,severity,station_name,station_code,level_cm,context_status) values(actor,s.id,v,s.name,s.friendly_code,lvl,case when v='normal' and old.notified_at is null then 'initial' end);
  old.notified_at:=now();
 end if;
 insert into public.kit_watch_state values(s.id,v,old.notified_at) on conflict(station_id) do update set status=excluded.status,notified_at=excluded.notified_at;
 insert into public.kit_telegram_state values(s.id,v) on conflict(station_id) do update set severity=excluded.severity;
end $$;
commit;
