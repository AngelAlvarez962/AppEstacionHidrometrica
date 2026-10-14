-- Optional email delivery infrastructure. No email is sent by applying this migration.
begin;
alter table public.kit_profiles add column email_alerts_enabled boolean not null default false;
grant update(email_alerts_enabled) on public.kit_profiles to authenticated;
create table public.kit_alert_state (
 station_id uuid primary key references public.kit_stations(id), severity text not null
);
create table public.kit_email_outbox (
 id uuid primary key default gen_random_uuid(), station_id uuid not null references public.kit_stations(id),
 owner_id uuid not null references auth.users(id), station_name text not null, station_code text not null,
 severity text not null check(severity in ('yellow','red','error')), level_cm numeric,
 created_at timestamptz not null default now(), sent_at timestamptz,
 attempts integer not null default 0, next_attempt timestamptz not null default now(), lease_id uuid
);
alter table public.kit_alert_state enable row level security;
alter table public.kit_email_outbox enable row level security;
revoke all on public.kit_alert_state,public.kit_email_outbox from public,anon,authenticated;
grant all on public.kit_alert_state,public.kit_email_outbox to service_role;
create index kit_email_pending on public.kit_email_outbox(next_attempt) where sent_at is null;
create function public.kit_queue_alert() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.kit_stations; owner uuid; previous text; v_severity text; level numeric;
begin
 select * into s from public.kit_stations where id=new.station_id;
 if s.deleted_at is not null or s.setup_pending then return new; end if;
 level:=greatest(0,s.bed_height-new.distance_cm);
 v_severity:=case when new.sensor_status<>'OK' or new.distance_cm<=20 or new.distance_cm>600 then 'error'
  when level>=s.red_alert then 'red' when level>=s.yellow_alert then 'yellow' else 'normal' end;
 select a.severity into previous from public.kit_alert_state a where a.station_id=s.id for update;
 insert into public.kit_alert_state(station_id,severity) values(s.id,v_severity) on conflict(station_id) do update set severity=excluded.severity;
 select owner_id into owner from public.kit_kits where id=s.kit_id;
 if v_severity<>'normal' and previous is distinct from v_severity and exists(
  select 1 from public.kit_profiles p join auth.users u on u.id=p.user_id where p.user_id=owner and p.email_alerts_enabled and u.email_confirmed_at is not null
 ) and not exists(select 1 from public.kit_email_outbox o where o.station_id=s.id and o.severity=v_severity and o.created_at>now()-interval '10 minutes') then
  insert into public.kit_email_outbox(station_id,owner_id,station_name,station_code,severity,level_cm)
  values(s.id,owner,s.name,s.friendly_code,v_severity,case when v_severity='error' then null else level end);
 end if;
 return new;
end $$;
revoke all on function public.kit_queue_alert() from public,anon,authenticated;
create trigger kit_alert_reading after insert on public.kit_readings for each row execute function public.kit_queue_alert();

-- A lease prevents two local servers from sending the same message concurrently.
create function public.kit_email_take() returns jsonb language plpgsql security definer set search_path='' as $$
declare event public.kit_email_outbox; recipient text; lease uuid:=gen_random_uuid();
begin
 select o.* into event from public.kit_email_outbox o join public.kit_profiles p on p.user_id=o.owner_id
 join auth.users u on u.id=o.owner_id join public.kit_stations s on s.id=o.station_id
 where o.sent_at is null and o.attempts<5 and o.next_attempt<=now() and o.created_at>now()-interval '24 hours'
 and p.email_alerts_enabled and u.email_confirmed_at is not null and s.deleted_at is null
 order by o.created_at for update of o skip locked limit 1;
 if not found then return null; end if;
 update public.kit_email_outbox set attempts=attempts+1,next_attempt=now()+interval '5 minutes',lease_id=lease where id=event.id;
 select email into recipient from auth.users where id=event.owner_id;
 return to_jsonb(event)||jsonb_build_object('recipient',recipient,'lease_id',lease);
end $$;
create function public.kit_email_finish(p_id uuid,p_lease uuid,p_success boolean) returns void language sql security definer set search_path='' as $$
 update public.kit_email_outbox set sent_at=case when p_success then now() else sent_at end,lease_id=null
 where id=p_id and lease_id=p_lease;
$$;
revoke all on function public.kit_email_take(),public.kit_email_finish(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.kit_email_take(),public.kit_email_finish(uuid,uuid,boolean) to service_role;
commit;
