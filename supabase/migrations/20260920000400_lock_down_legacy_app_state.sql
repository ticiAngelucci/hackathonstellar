-- Compatibility lock-down for the old public demo tables.
-- Tables remain during the frontend cutover; direct Data API access does not.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'events', 'wallets', 'transactions', 'service_subscriptions', 'payment_policies'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
      execute format('alter table public.%I enable row level security', table_name);
      execute format('alter table public.%I force row level security', table_name);
    end if;
  end loop;
end
$$;

drop policy if exists "events_demo_read" on public.events;
drop policy if exists "events_demo_insert" on public.events;
drop policy if exists "wallets_demo_read" on public.wallets;
drop policy if exists "transactions_demo_read" on public.transactions;
drop policy if exists "subscriptions_demo_access" on public.service_subscriptions;
drop policy if exists "payment_policies_demo_access" on public.payment_policies;

-- Do not drop the tables here. The frontend cutover and a read-back of the
-- new API precede a later destructive cleanup migration.
