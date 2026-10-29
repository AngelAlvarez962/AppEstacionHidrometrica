begin;
-- Remove unused receivers only; preserve all stations and historical readings.
create function public.kit_delete_gateway(p_gateway uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'GATEWAY_NOT_OWNED'; end if;
 perform 1 from public.kit_gateways g join public.kit_kits k on k.id=g.kit_id
 where g.id=p_gateway and (k.owner_id=auth.uid() or public.kit_is_admin()) for update of g;
 if not found then raise exception 'GATEWAY_NOT_OWNED'; end if;
 if exists(select 1 from public.kit_stations where gateway_id=p_gateway) then raise exception 'GATEWAY_HAS_STATIONS'; end if;
 update public.kit_profiles set preferred_gateway_id=null where preferred_gateway_id=p_gateway;
 delete from public.kit_gateway_pending where gateway_id=p_gateway;
 delete from public.kit_gateway_keys where gateway_id=p_gateway;
 delete from public.kit_gateways where id=p_gateway;
end $$;
revoke all on function public.kit_delete_gateway(uuid) from public,anon;
grant execute on function public.kit_delete_gateway(uuid) to authenticated;
commit;
