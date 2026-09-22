begin;
select plan(12);

select ok(
  (select t.typname = 'int8'
   from pg_attribute a
   join pg_class c on c.oid = a.attrelid
   join pg_namespace n on n.oid = c.relnamespace
   join pg_type t on t.oid = a.atttypid
   where n.nspname = 'patopay' and c.relname = 'payment_requests' and a.attname = 'amount_minor'),
  'payment request amount uses bigint base units'
);
select ok(
  (select t.typname = 'int8'
   from pg_attribute a
   join pg_class c on c.oid = a.attrelid
   join pg_namespace n on n.oid = c.relnamespace
   join pg_type t on t.oid = a.atttypid
   where n.nspname = 'patopay' and c.relname = 'mock_wallet_balances' and a.attname = 'balance_minor'),
  'mock balance uses bigint base units'
);
select ok(
  exists (select 1 from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace
          where n.nspname = 'patopay' and r.relname = 'payment_requests' and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%amount_minor%'),
  'payment request amount has a bounded check'
);
select ok(
  exists (select 1 from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace
          where n.nspname = 'patopay' and r.relname = 'payment_requests' and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%requester_id <> payer_id%'),
  'requester and payer must differ'
);
select ok(
  exists (select 1 from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace
          where n.nspname = 'patopay' and r.relname = 'payment_requests' and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%source_wallet_id <> destination_wallet_id%'),
  'source and destination wallets must differ'
);
select ok(
  exists (select 1 from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace
          where n.nspname = 'patopay' and r.relname = 'payment_policy_versions' and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%auto_pay_limit_minor <= approval_limit_minor%'),
  'policy thresholds are ordered'
);
select ok(
  exists (select 1 from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace
          where n.nspname = 'patopay' and r.relname = 'assets' and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%contract_address%'),
  'asset contract address is constrained'
);
select has_index('patopay', 'payment_attempts_one_active', 'only one active attempt is allowed');
select has_index('patopay', 'wallets_one_default_per_user_network', 'only one default wallet exists per network');
select ok(
  (select count(*) = 0 from pg_policies where schemaname = 'patopay' and tablename = 'policy_decisions' and cmd in ('UPDATE', 'DELETE')),
  'policy decisions have no update or delete policy'
);
select ok(
  (select count(*) = 0 from information_schema.role_table_grants
   where table_schema = 'patopay' and grantee = 'anon'),
  'anonymous role has no direct table grants'
);
select ok(
  (select not has_schema_privilege('authenticated', 'patopay', 'CREATE')),
  'authenticated role cannot create schema objects'
);

select * from finish();
rollback;
