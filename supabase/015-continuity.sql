begin;
create table public.kit_watch_runs(id uuid primary key default gen_random_uuid(),station_id uuid not null references public.kit_stations(id),owner_id uuid not null references auth.users(id),started_at timestamptz not null default now(),ends_at timestamptz not null,stopped_at timestamptz,last_hour timestamptz);
create unique index kit_watch_active on public.kit_watch_runs(station_id) where stopped_at is null;
create table public.kit_watch_logs(id bigint generated always as identity primary key,run_id uuid not null references public.kit_watch_runs(id),observed_at timestamptz not null default now(),kind text not null,status text not null,last_reading timestamptz,distance_cm numeric,level_cm numeric);
create index kit_watch_logs_run on public.kit_watch_logs(run_id,id);
create table public.kit_watch_state(station_id uuid primary key references public.kit_stations(id),status text not null,notified_at timestamptz);
create table public.kit_watch_config(singleton boolean primary key default true check(singleton),secret text not null check(secret ~ '^[a-f0-9]{64}$'),updated_at timestamptz not null default now());
alter table public.kit_watch_runs enable row level security;
alter table public.kit_watch_logs enable row level security;
alter table public.kit_watch_state enable row level security;
alter table public.kit_watch_config enable row level security;
revoke all on public.kit_watch_runs,public.kit_watch_logs,public.kit_watch_state,public.kit_watch_config from public,anon,authenticated;
grant all on public.kit_watch_runs,public.kit_watch_logs,public.kit_watch_state,public.kit_watch_config to service_role;
grant usage,select on sequence public.kit_watch_logs_id_seq to service_role;
grant select on public.kit_watch_runs,public.kit_watch_logs to authenticated;
create policy watch_runs_read on public.kit_watch_runs for select to authenticated using(owner_id=auth.uid());
create policy watch_logs_read on public.kit_watch_logs for select to authenticated using(exists(select 1 from public.kit_watch_runs r where r.id=run_id and r.owner_id=auth.uid()));
alter table public.kit_telegram_outbox drop constraint kit_telegram_outbox_severity_check;
alter table public.kit_telegram_outbox add constraint kit_telegram_outbox_severity_check check(severity in ('yellow','red','error','normal','linked','test','offline','radio','started'));
alter table public.kit_telegram_outbox add column context_status text;
create function public.kit_watch_sample(p_station uuid) returns void language plpgsql security definer set search_path='' as $$
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
 if ((changed and (v<>'normal' or old.status is not null)) or (v<>'normal' and old.notified_at<=now()-interval '24 hours'))
 and exists(select 1 from public.kit_telegram t join auth.users u on u.id=t.owner_id where t.owner_id=actor and t.enabled and t.chat_id is not null and u.email_confirmed_at is not null)
 and not exists(select 1 from public.kit_telegram_outbox o where o.station_id=s.id and o.severity=v and o.created_at>now()-interval '10 minutes')
 and (select count(*) from public.kit_telegram_outbox o where o.owner_id=actor and o.created_at>now()-interval '1 day')<60 then
  insert into public.kit_telegram_outbox(owner_id,station_id,severity,station_name,station_code,level_cm) values(actor,s.id,v,s.name,s.friendly_code,lvl);
  old.notified_at:=now();
 end if;
 insert into public.kit_watch_state values(s.id,v,old.notified_at) on conflict(station_id) do update set status=excluded.status,notified_at=excluded.notified_at;
 insert into public.kit_telegram_state values(s.id,v) on conflict(station_id) do update set severity=excluded.severity;
end $$;
create or replace function public.kit_queue_telegram() returns trigger language plpgsql security definer set search_path='' as $$begin perform public.kit_watch_sample(new.station_id);return new;end $$;
create function public.kit_watch_tick() returns void language plpgsql security definer set search_path='' as $$
declare s record;begin for s in select id from public.kit_stations where deleted_at is null and not setup_pending loop perform public.kit_watch_sample(s.id);end loop;end $$;
create function public.kit_watch_start(p_station uuid,p_days integer) returns uuid language plpgsql security definer set search_path='' as $$
declare run uuid; actor uuid:=auth.uid();
begin
 if p_days not between 1 and 7 or actor is null or not exists(select 1 from public.kit_stations s join public.kit_kits k on k.id=s.kit_id where s.id=p_station and k.owner_id=actor and s.deleted_at is null and not s.setup_pending) then raise exception 'DEVICE_NOT_ALLOWED';end if;
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
create function public.kit_watch_stop(p_run uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.kit_watch_runs where id=p_run and owner_id=auth.uid()) then raise exception 'DEVICE_NOT_ALLOWED';end if;
 insert into public.kit_watch_logs(run_id,kind,status) select r.id,'detenida',coalesce(s.status,'desconocido') from public.kit_watch_runs r left join public.kit_watch_state s on s.station_id=r.station_id where r.id=p_run and r.stopped_at is null;
 update public.kit_watch_runs set stopped_at=now() where id=p_run and owner_id=auth.uid() and stopped_at is null;
end $$;
create function public.kit_watch_configure(p_secret text) returns void language sql security definer set search_path='' as $$insert into public.kit_watch_config values(true,p_secret,now()) on conflict(singleton) do update set secret=excluded.secret,updated_at=now();$$;
revoke all on function public.kit_watch_sample(uuid),public.kit_watch_tick(),public.kit_watch_start(uuid,integer),public.kit_watch_stop(uuid),public.kit_watch_configure(text) from public,anon,authenticated;
grant execute on function public.kit_watch_start(uuid,integer),public.kit_watch_stop(uuid) to authenticated;
grant execute on function public.kit_watch_tick(),public.kit_watch_configure(text) to service_role;
commit;
