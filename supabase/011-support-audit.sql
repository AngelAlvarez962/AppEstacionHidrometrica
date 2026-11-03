begin;
create table public.kit_tickets(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),station_id uuid references public.kit_stations(id) on delete set null,subject text not null check(length(subject) between 1 and 120),description text not null check(length(description) between 1 and 3000),status text not null default 'open' check(status in ('open','reviewing','resolved')),reply text not null default '' check(length(reply)<=3000),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.kit_tickets enable row level security;
revoke all on public.kit_tickets from anon,authenticated;
grant select on public.kit_tickets to authenticated;
grant update(status,reply) on public.kit_tickets to authenticated;
create policy ticket_read on public.kit_tickets for select to authenticated using(owner_id=auth.uid() or public.kit_is_admin());
create policy ticket_reply on public.kit_tickets for update to authenticated using(public.kit_is_admin()) with check(public.kit_is_admin());
create function public.kit_open_ticket(p_station uuid,p_subject text,p_description text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'CONFIRMED_USER_REQUIRED';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(auth.uid()::text));
 if p_station is not null and not exists(select 1 from public.kit_stations s join public.kit_kits k on k.id=s.kit_id where s.id=p_station and k.owner_id=auth.uid()) then raise exception 'TICKET_NOT_ALLOWED';end if;
 if (select count(*) from public.kit_tickets where owner_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'TICKET_LIMIT';end if;
 insert into public.kit_tickets(owner_id,station_id,subject,description) values(auth.uid(),p_station,trim(p_subject),trim(p_description)) returning id into result;
 return result;
end $$;
revoke all on function public.kit_open_ticket(uuid,text,text) from public,anon;
grant execute on function public.kit_open_ticket(uuid,text,text) to authenticated;
create table public.kit_audit(id bigint generated always as identity primary key,actor uuid,action text not null,entity text not null,record_id text,changes jsonb not null default '{}',created_at timestamptz not null default now());
alter table public.kit_audit enable row level security;
revoke all on public.kit_audit from anon,authenticated;
grant select on public.kit_audit to authenticated;
create policy audit_admin on public.kit_audit for select to authenticated using(public.kit_is_admin());
create function public.kit_audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare before_row jsonb;after_row jsonb;delta jsonb:='{}';field text;
begin
 if tg_table_name='kit_tickets' and tg_op='UPDATE' then new.updated_at=now();end if;
 if auth.uid() is not null then
 before_row=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;after_row=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 foreach field in array array['name','display_name','bed_height','capacity_height','yellow_alert','red_alert','gateway_id','owner_id','deleted_at','status'] loop
 if before_row->field is distinct from after_row->field then delta=delta||jsonb_build_object(field,jsonb_build_object('before',before_row->field,'after',after_row->field));end if;end loop;
 insert into public.kit_audit(actor,action,entity,record_id,changes) values(auth.uid(),tg_op,tg_table_name,coalesce(after_row->>'id',before_row->>'id',after_row->>'user_id',before_row->>'user_id'),delta);
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.kit_audit_change() from public,anon,authenticated;
create trigger audit_station after insert or update or delete on public.kit_stations for each row execute function public.kit_audit_change();
create trigger audit_gateway after insert or update or delete on public.kit_gateways for each row execute function public.kit_audit_change();
create trigger audit_profile after update or delete on public.kit_profiles for each row execute function public.kit_audit_change();
create trigger audit_role after insert or delete on public.kit_admins for each row execute function public.kit_audit_change();
create trigger audit_ticket before insert or update on public.kit_tickets for each row execute function public.kit_audit_change();
commit;
