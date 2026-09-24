begin;
set local role postgres;
set local search_path = public, extensions, patopay;
select plan(4);

select has_function(
  'patopay',
  'replace_payment_policy',
  ARRAY['bigint', 'bigint', 'bigint', 'text', 'uuid[]', 'uuid[]', 'integer'],
  'policy replacement RPC exists'
);
select has_function(
  'patopay',
  'create_payment_request',
  ARRAY['uuid', 'bigint', 'uuid', 'text', 'text'],
  'payment request RPC exists'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'patopay' and p.proname = 'replace_payment_policy'
  ),
  'policy RPC is in the private schema'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'patopay' and p.proname = 'create_payment_request'
  ),
  'payment request RPC is in the private schema'
);

select * from finish();
rollback;
