begin;
-- Simulated alerts stay in the test queue; no reading or real alert state is changed.
alter table public.kit_telegram_outbox add column test_kind text
 check(test_kind is null or (test_kind in ('test','yellow','red','error','normal') and severity='test'));
create function public.kit_telegram_test(p_kind text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_kind is null or p_kind not in ('test','yellow','red','error','normal') then raise exception 'INVALID_REGISTRATION';end if;
 perform 1 from public.kit_telegram where owner_id=auth.uid() for update;
 if not exists(select 1 from public.kit_telegram where owner_id=auth.uid() and chat_id is not null and enabled) then raise exception 'TELEGRAM_NOT_LINKED';end if;
 if exists(select 1 from public.kit_telegram where owner_id=auth.uid() and last_test_at>now()-interval '1 minute') then raise exception 'TELEGRAM_RATE_LIMIT';end if;
 update public.kit_telegram set last_test_at=now() where owner_id=auth.uid();
 insert into public.kit_telegram_outbox(owner_id,severity,test_kind) values(auth.uid(),'test',p_kind);
end $$;
revoke all on function public.kit_telegram_test(text) from public,anon,authenticated;
grant execute on function public.kit_telegram_test(text) to authenticated;
-- Keep older app versions working with the original connection-test button.
create or replace function public.kit_telegram_test() returns void language plpgsql security definer set search_path='' as $$
begin perform public.kit_telegram_test('test');end $$;
commit;
