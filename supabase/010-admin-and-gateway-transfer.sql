begin;
create policy kit_admin_roles_read on public.kit_admins for select to authenticated using(public.kit_is_admin());
-- One transaction for receiver replacement, including archived stations.
create function public.kit_replace_gateway(p_source uuid,p_target uuid default null,p_name text default null,p_expected uuid[] default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare owner uuid; target_owner uuid; target uuid:=p_target; kid uuid; actual uuid[];
begin
 if auth.uid() is null then raise exception 'GATEWAY_NOT_OWNED'; end if;
 -- Serialize replacements and lock receivers in a consistent order.
 perform pg_catalog.pg_advisory_xact_lock(701010);
 perform 1 from public.kit_gateways where id in (p_source,p_target) order by id for update;
 select k.owner_id into owner from public.kit_gateways g join public.kit_kits k on k.id=g.kit_id where g.id=p_source;
 if not found or owner is null or (owner<>auth.uid() and not public.kit_is_admin()) then raise exception 'GATEWAY_NOT_OWNED'; end if;
 perform 1 from public.kit_stations where gateway_id=p_source order by id for update;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into actual from public.kit_stations where gateway_id=p_source;
 if actual is distinct from (select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(p_expected) x) then raise exception 'GATEWAY_CHANGED'; end if;
 if p_name is not null then
  if target is not null or length(trim(p_name)) not between 1 and 120 then raise exception 'INVALID_REGISTRATION'; end if;
  insert into public.kit_kits(serial,kind,owner_id,claimed_at) values('HI-'||upper(replace(gen_random_uuid()::text,'-','')),'gateway',owner,now()) returning id into kid;
  insert into public.kit_gateways(kit_id,serial,name) values(kid,'GW-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),trim(p_name)) returning id into target;
 end if;
 if cardinality(actual)>0 or target is not null then
  select k.owner_id into target_owner from public.kit_gateways g join public.kit_kits k on k.id=g.kit_id where g.id=target;
  if not found or target=p_source or target_owner is distinct from owner then raise exception 'GATEWAY_NOT_OWNED'; end if;
  if (select count(*) from public.kit_stations where (gateway_id=target or gateway_id=p_source) and deleted_at is null)>8 then raise exception 'GATEWAY_CAPACITY'; end if;
  if exists(select 1 from public.kit_stations where (gateway_id=target or gateway_id=p_source) and deleted_at is null group by node_label having count(*)>1) then raise exception 'NODE_ALREADY_REGISTERED'; end if;
  update public.kit_stations set gateway_id=target where gateway_id=p_source;
 end if;
 update public.kit_profiles set preferred_gateway_id=target where preferred_gateway_id=p_source;
 perform public.kit_delete_gateway(p_source);
 return target;
end $$;
revoke all on function public.kit_replace_gateway(uuid,uuid,text,uuid[]) from public,anon;
grant execute on function public.kit_replace_gateway(uuid,uuid,text,uuid[]) to authenticated;

create function public.kit_admin_edit_user(p_user uuid,p_name text,p_admin boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(701011);
 if not public.kit_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 120 or p_admin is null then raise exception 'INVALID_REGISTRATION'; end if;
 if p_user=auth.uid() and not p_admin then raise exception 'ADMIN_SELF_CHANGE'; end if;
 update public.kit_profiles set display_name=trim(p_name) where user_id=p_user;
 if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
 if p_admin then insert into public.kit_admins(user_id) values(p_user) on conflict do nothing;
 else delete from public.kit_admins where user_id=p_user; end if;
end $$;
revoke all on function public.kit_admin_edit_user(uuid,text,boolean) from public,anon;
grant execute on function public.kit_admin_edit_user(uuid,text,boolean) to authenticated;
-- Explicit ownership transfer before account deletion; no measurements are removed.
create function public.kit_admin_transfer_account(p_source uuid,p_target uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(701011);
 if not public.kit_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 if p_source=auth.uid() or p_source=p_target or p_source is null or p_target is null then raise exception 'ADMIN_SELF_CHANGE'; end if;
 perform 1 from auth.users where id in (p_source,p_target) order by id for update;
 if not exists(select 1 from auth.users where id=p_source) or not exists(select 1 from auth.users where id=p_target and email_confirmed_at is not null) then raise exception 'PROFILE_NOT_FOUND'; end if;
 update public.kit_profiles set preferred_gateway_id=null where user_id=p_source;
 delete from public.kit_gateway_pending where owner_id=p_source;
 -- Give transferred locations unique names to avoid collisions at the destination.
 update public.kit_personal_entities set name=left(name,70)||' · '||id::text,owner_id=p_target where owner_id=p_source;
 update public.kit_kits set owner_id=p_target where owner_id=p_source;
 update public.kit_admin_entities set created_by=auth.uid() where created_by=p_source;
end $$;
revoke all on function public.kit_admin_transfer_account(uuid,uuid) from public,anon;
grant execute on function public.kit_admin_transfer_account(uuid,uuid) to authenticated;
commit;
