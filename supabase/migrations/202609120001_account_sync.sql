-- Apply to an isolated Supabase test project first. Never alters finance_vault.
begin;
create table public.finance_records_v2 (
  user_id uuid not null references auth.users(id),
  record_id text not null,
  value jsonb not null,
  primary key(user_id,record_id),
  check (value->>'id' = record_id)
);
alter table public.finance_records_v2 enable row level security;
create policy own_records on public.finance_records_v2
  for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.finance_records_v2 from anon,authenticated;
grant select on public.finance_records_v2 to authenticated;

-- One atomic request per account; compare base values instead of client clocks.
-- Repeated requests are idempotent. Conflicting versions are returned, not overwritten.
create function public.finance_sync_v2(expected_user uuid, operations jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); op jsonb; current_value jsonb; rid text;
  accepted jsonb := '[]'; conflicts jsonb := '{}'; records jsonb;
begin
  if uid is null or uid is distinct from expected_user then raise exception 'Authentication required'; end if;
  if jsonb_typeof(operations) <> 'array' or jsonb_array_length(operations)>1000
    then raise exception 'Invalid operations'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  for op in select * from jsonb_array_elements(operations) loop
    rid := op->'value'->>'id';
    if rid is null or rid !~ '^[A-Za-z0-9_-]{1,100}$' or rid in ('__proto__','constructor','prototype')
      or jsonb_typeof(op->'value') <> 'object' or op->>'opId' is null
      then raise exception 'Invalid record'; end if;
    select value into current_value from public.finance_records_v2
      where user_id=uid and record_id=rid;
    if current_value is not distinct from op->'value' then
      accepted := accepted || jsonb_build_array(op->>'opId');
    elsif coalesce(current_value,'null'::jsonb) = coalesce(op->'base','null'::jsonb) then
      insert into public.finance_records_v2 values(uid,rid,op->'value')
        on conflict(user_id,record_id) do update set value=excluded.value;
      accepted := accepted || jsonb_build_array(op->>'opId');
    else
      conflicts := conflicts || jsonb_build_object(rid,jsonb_build_object('remote',current_value));
    end if;
  end loop;
  select coalesce(jsonb_agg(value order by record_id),'[]') into records
    from public.finance_records_v2 where user_id=uid;
  return jsonb_build_object('accepted',accepted,'conflicts',conflicts,'records',records);
end $$;
revoke all on function public.finance_sync_v2(uuid,jsonb) from public,anon;
grant execute on function public.finance_sync_v2(uuid,jsonb) to authenticated;
commit;
