begin;
-- The owner is assigned once by the database operator, never by a browser.
create table public.kit_owner (
 singleton boolean primary key default true check(singleton),
 user_id uuid not null unique references public.kit_admins(user_id) on delete restrict on update restrict
);
alter table public.kit_owner enable row level security;
revoke all on public.kit_owner from public,anon,authenticated;
grant select on public.kit_owner to authenticated;
create policy kit_owner_read on public.kit_owner for select to authenticated using(public.kit_is_admin());
create function public.kit_protect_owner_role() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.kit_owner where user_id=old.user_id) then
  raise exception 'OWNER_ACCOUNT_PROTECTED';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.kit_protect_owner_role() from public,anon,authenticated;
create trigger kit_owner_role_guard before delete or update on public.kit_admins for each row execute function public.kit_protect_owner_role();
create or replace function public.kit_admin_edit_user(p_user uuid,p_name text,p_admin boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(701011);
 if not public.kit_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 120 or p_admin is null then raise exception 'INVALID_REGISTRATION'; end if;
 if not p_admin and exists(select 1 from public.kit_owner where user_id=p_user) then raise exception 'OWNER_ACCOUNT_PROTECTED'; end if;
 if p_user=auth.uid() and not p_admin then raise exception 'ADMIN_SELF_CHANGE'; end if;
 update public.kit_profiles set display_name=trim(p_name) where user_id=p_user;
 if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
 if p_admin then insert into public.kit_admins(user_id) values(p_user) on conflict do nothing;
 else delete from public.kit_admins where user_id=p_user; end if;
end $$;
commit;
