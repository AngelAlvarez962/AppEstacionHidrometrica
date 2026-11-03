begin;
create table public.kit_telegram (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 chat_id bigint unique, enabled boolean not null default false,
 pending_hash text unique, expires_at timestamptz, issued_at timestamptz,
 linked_at timestamptz, last_test_at timestamptz, last_attempt timestamptz
);
create table public.kit_telegram_state(station_id uuid primary key references public.kit_stations(id),severity text not null);
create table public.kit_telegram_outbox (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 station_id uuid references public.kit_stations(id), severity text not null check(severity in ('yellow','red','error','normal','linked','test')),
 station_name text, station_code text, level_cm numeric,
 created_at timestamptz not null default now(), sent_at timestamptz,
 attempts integer not null default 0, next_attempt timestamptz not null default now(), lease_id uuid
);
alter table public.kit_telegram enable row level security;
alter table public.kit_telegram_state enable row level security;
alter table public.kit_telegram_outbox enable row level security;
revoke all on public.kit_telegram,public.kit_telegram_state,public.kit_telegram_outbox from public,anon,authenticated;
grant all on public.kit_telegram,public.kit_telegram_state,public.kit_telegram_outbox to service_role;
create index kit_telegram_pending on public.kit_telegram_outbox(next_attempt) where sent_at is null;
create function public.kit_telegram_status() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('linked',t.chat_id is not null,'enabled',coalesce(t.enabled,false),'linked_at',t.linked_at,
 'last_sent_at',(select max(o.sent_at) from public.kit_telegram_outbox o where o.owner_id=auth.uid()),
 'pending',(select count(*) from public.kit_telegram_outbox o where o.owner_id=auth.uid() and o.sent_at is null and o.attempts<5 and o.created_at>now()-interval '1 hour'))
 from (select 1) seed left join public.kit_telegram t on t.owner_id=auth.uid();
$$;
create function public.kit_telegram_begin(p_hash text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'CONFIRMED_USER_REQUIRED';end if;
 if p_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_REGISTRATION';end if;
 perform pg_catalog.pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if exists(select 1 from public.kit_telegram where owner_id=auth.uid() and issued_at>now()-interval '30 seconds') then raise exception 'TELEGRAM_RATE_LIMIT';end if;
 insert into public.kit_telegram(owner_id,pending_hash,expires_at,issued_at) values(auth.uid(),p_hash,now()+interval '10 minutes',now())
 on conflict(owner_id) do update set pending_hash=excluded.pending_hash,expires_at=excluded.expires_at,issued_at=excluded.issued_at;
end $$;
create function public.kit_telegram_consume(p_hash text,p_chat bigint) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if p_chat<=0 then return false;end if;
 perform pg_catalog.pg_advisory_xact_lock(701013);
 select owner_id into actor from public.kit_telegram where pending_hash=p_hash and expires_at>now() for update;
 if actor is null or exists(select 1 from public.kit_telegram where chat_id=p_chat and owner_id<>actor) then return false;end if;
 -- Re-linking never sends old queued measurements to a different recipient.
 delete from public.kit_telegram_outbox where owner_id=actor and sent_at is null;
 update public.kit_telegram set chat_id=p_chat,enabled=true,pending_hash=null,expires_at=null,linked_at=now() where owner_id=actor;
 insert into public.kit_telegram_outbox(owner_id,severity) values(actor,'linked');
 return true;
end $$;
create function public.kit_telegram_preference(p_enabled boolean,p_unlink boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.kit_telegram where owner_id=auth.uid() for update;
 if p_enabled and not exists(select 1 from public.kit_telegram where owner_id=auth.uid() and chat_id is not null) then raise exception 'TELEGRAM_NOT_LINKED';end if;
 update public.kit_telegram set enabled=p_enabled and not p_unlink,chat_id=case when p_unlink then null else chat_id end,
 pending_hash=null,expires_at=null where owner_id=auth.uid();
 delete from public.kit_telegram_outbox where owner_id=auth.uid() and sent_at is null;
end $$;
create function public.kit_telegram_test() returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.kit_telegram where owner_id=auth.uid() for update;
 if not exists(select 1 from public.kit_telegram where owner_id=auth.uid() and chat_id is not null and enabled) then raise exception 'TELEGRAM_NOT_LINKED';end if;
 if exists(select 1 from public.kit_telegram where owner_id=auth.uid() and last_test_at>now()-interval '1 minute') then raise exception 'TELEGRAM_RATE_LIMIT';end if;
 update public.kit_telegram set last_test_at=now() where owner_id=auth.uid();
 insert into public.kit_telegram_outbox(owner_id,severity) values(auth.uid(),'test');
end $$;
create function public.kit_queue_telegram() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.kit_stations; actor uuid; previous text; v_severity text; level numeric;
begin
 select * into s from public.kit_stations where id=new.station_id for update;
 if s.deleted_at is not null or s.setup_pending then return new;end if;
 level:=greatest(0,s.bed_height-new.distance_cm);
 v_severity:=case when new.sensor_status<>'OK' or new.distance_cm<=20 or new.distance_cm>600 then 'error' when level>=s.red_alert then 'red' when level>=s.yellow_alert then 'yellow' else 'normal' end;
 select a.severity into previous from public.kit_telegram_state a where a.station_id=s.id;
 insert into public.kit_telegram_state values(s.id,v_severity) on conflict(station_id) do update set severity=excluded.severity;
 select owner_id into actor from public.kit_kits where id=s.kit_id;
 if previous is distinct from v_severity and (v_severity<>'normal' or previous in ('yellow','red','error'))
 and exists(select 1 from public.kit_telegram t join auth.users u on u.id=t.owner_id where t.owner_id=actor and t.enabled and t.chat_id is not null and u.email_confirmed_at is not null)
 and not exists(select 1 from public.kit_telegram_outbox o where o.station_id=s.id and o.severity=v_severity and o.created_at>now()-interval '10 minutes')
 and (select count(*) from public.kit_telegram_outbox o where o.owner_id=actor and o.created_at>now()-interval '1 day')<60 then
 insert into public.kit_telegram_outbox(owner_id,station_id,severity,station_name,station_code,level_cm) values(actor,s.id,v_severity,s.name,s.friendly_code,case when v_severity='error' then null else level end);
 end if;
 return new;
end $$;
create trigger kit_telegram_reading after insert on public.kit_readings for each row execute function public.kit_queue_telegram();
create function public.kit_telegram_take() returns jsonb language plpgsql security definer set search_path='' as $$
declare event public.kit_telegram_outbox; recipient bigint; lease uuid:=gen_random_uuid();
begin
 select o.* into event from public.kit_telegram_outbox o join public.kit_telegram t on t.owner_id=o.owner_id join auth.users u on u.id=o.owner_id
 where o.sent_at is null and o.attempts<5 and o.next_attempt<=now() and o.created_at>now()-interval '1 hour' and t.enabled and t.chat_id is not null
 and u.email_confirmed_at is not null and (t.last_attempt is null or t.last_attempt<now()-interval '30 seconds')
 and (o.station_id is null or exists(select 1 from public.kit_stations s join public.kit_kits k on k.id=s.kit_id where s.id=o.station_id and s.deleted_at is null and not s.setup_pending and k.owner_id=o.owner_id))
 order by o.created_at for update of o,t skip locked limit 1;
 if not found then return null;end if;
 update public.kit_telegram_outbox set attempts=attempts+1,next_attempt=now()+interval '5 minutes',lease_id=lease where id=event.id;
 update public.kit_telegram set last_attempt=now() where owner_id=event.owner_id returning chat_id into recipient;
 return to_jsonb(event)||jsonb_build_object('recipient',recipient::text,'lease_id',lease);
end $$;
create function public.kit_telegram_finish(p_id uuid,p_lease uuid,p_success boolean,p_retry integer default 300,p_blocked boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 update public.kit_telegram_outbox set sent_at=case when p_success then now() else sent_at end,lease_id=null,
 next_attempt=now()+make_interval(secs=>greatest(30,least(86400,p_retry))) where id=p_id and lease_id=p_lease returning owner_id into actor;
 if p_blocked and actor is not null then update public.kit_telegram set enabled=false where owner_id=actor;end if;
end $$;
create function public.kit_telegram_stop(p_chat bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.kit_telegram set enabled=false,pending_hash=null,expires_at=null where chat_id=p_chat;
 delete from public.kit_telegram_outbox where owner_id in(select owner_id from public.kit_telegram where chat_id=p_chat) and sent_at is null;
end $$;
revoke all on function public.kit_telegram_status(),public.kit_telegram_begin(text),public.kit_telegram_preference(boolean,boolean),public.kit_telegram_test(),public.kit_telegram_consume(text,bigint),public.kit_queue_telegram(),public.kit_telegram_take(),public.kit_telegram_finish(uuid,uuid,boolean,integer,boolean),public.kit_telegram_stop(bigint) from public,anon,authenticated;
grant execute on function public.kit_telegram_status(),public.kit_telegram_begin(text),public.kit_telegram_preference(boolean,boolean),public.kit_telegram_test() to authenticated;
grant execute on function public.kit_telegram_consume(text,bigint),public.kit_telegram_take(),public.kit_telegram_finish(uuid,uuid,boolean,integer,boolean),public.kit_telegram_stop(bigint) to service_role;
commit;
