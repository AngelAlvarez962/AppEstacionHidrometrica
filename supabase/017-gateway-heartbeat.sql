begin;

-- A valid gateway can confirm its own connectivity without creating a sample.
create function public.kit_gateway_ping(p_token text) returns void
language plpgsql security definer set search_path='' as $$
declare
 gateway uuid;
begin
 if p_token is null or p_token !~ '^GW_[a-f0-9]{64}$' then
  raise exception 'DEVICE_NOT_ALLOWED';
 end if;

 select gateway_id into gateway
 from public.kit_gateway_keys
 where token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex')
   and revoked_at is null
 for update;

 if not found then
  raise exception 'DEVICE_NOT_ALLOWED';
 end if;

 update public.kit_gateways
 set last_seen=now(), internet_last_seen=now()
 where id=gateway and (internet_last_seen is null or internet_last_seen<now()-interval '10 seconds');
end $$;

revoke all on function public.kit_gateway_ping(text) from public;
grant execute on function public.kit_gateway_ping(text) to anon,authenticated;

commit;
