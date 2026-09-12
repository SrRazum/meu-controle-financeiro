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
  uid uuid := auth.uid(); op jsonb; current_value jsonb; rid text; proposed jsonb;
  accepted jsonb := '[]'; conflicts jsonb := '{}'; records jsonb;
begin
  if uid is null or uid is distinct from expected_user then raise exception 'Authentication required'; end if;
  if jsonb_typeof(operations) is distinct from 'array' then raise exception 'Invalid operations'; end if;
  if jsonb_array_length(operations)>1000
    then raise exception 'Invalid operations'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  for op in select * from jsonb_array_elements(operations) loop
    proposed := op->'value';
    rid := op->'value'->>'id';
    if rid is null or rid !~ '^[A-Za-z0-9_-]{1,100}$' or rid in ('__proto__','constructor','prototype')
      or jsonb_typeof(op->'value') <> 'object' or op->>'opId' is null
      then raise exception 'Invalid record'; end if;
    if jsonb_typeof(proposed->'id') is distinct from 'string'
      or jsonb_typeof(op->'opId') is distinct from 'string' or length(op->>'opId') not between 1 and 100
      or not (op ? 'base') then raise exception 'Invalid record'; end if;
    if proposed ? 'deleted' and jsonb_typeof(proposed->'deleted') is distinct from 'boolean'
      then raise exception 'Invalid record'; end if;
    if proposed->'deleted' is distinct from 'true'::jsonb then
      if jsonb_typeof(proposed->'descricao') is distinct from 'string'
        or jsonb_typeof(proposed->'categoria') is distinct from 'string'
        or jsonb_typeof(proposed->'valor') is distinct from 'number'
        or jsonb_typeof(proposed->'data') is distinct from 'string'
        or (proposed->>'data') !~ '^\d{4}-\d{2}-\d{2}$'
        or coalesce(proposed->>'tipo','') not in ('entrada','saida')
        or coalesce(proposed->>'controle','') not in ('pessoal','restaurante')
        or coalesce(proposed->>'status','') not in ('pago','pendente')
        or (proposed ? 'vencimento' and jsonb_typeof(proposed->'vencimento') is distinct from 'string')
        then raise exception 'Invalid record'; end if;
      -- Avoid values that overflow JavaScript or invalid calendar dates.
      if abs((proposed->>'valor')::numeric) > 9007199254740991 then raise exception 'Invalid amount'; end if;
      perform (proposed->>'data')::date;
      if coalesce(proposed->>'vencimento','') <> '' then
        if (proposed->>'vencimento') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date'; end if;
        perform (proposed->>'vencimento')::date;
      end if;
    end if;
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
