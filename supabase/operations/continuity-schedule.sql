-- Run once on Supabase after migration 015. No browser or laptop needs to stay open.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create or replace function public.kit_watch_scheduled() returns void language plpgsql security definer set search_path='' as $$
declare credential text;
begin
 perform public.kit_watch_tick();
 select secret into credential from public.kit_watch_config where singleton;
 if credential is not null then
  perform net.http_post(url:='https://estacionhidrometrica.ideasdisruptivas.com/api/watch',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||credential),body:='{}'::jsonb,timeout_milliseconds:=15000);
 end if;
end $$;
revoke all on function public.kit_watch_scheduled() from public,anon,authenticated;
select cron.schedule('hydro-continuity-minute','* * * * *','select public.kit_watch_scheduled()');
