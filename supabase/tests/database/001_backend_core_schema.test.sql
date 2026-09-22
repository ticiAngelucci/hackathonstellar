begin;
select plan(18);

select has_schema('patopay', 'private PatoPay schema exists');
select has_table('patopay', 'profiles', 'profiles table exists');
select has_table('patopay', 'wallets', 'wallets table exists');
select has_table('patopay', 'assets', 'assets table exists');
select has_table('patopay', 'payment_requests', 'payment_requests table exists');
select has_table('patopay', 'policy_decisions', 'policy_decisions table exists');
select has_table('patopay', 'payment_attempts', 'payment_attempts table exists');
select has_view('patopay', 'profile_directory', 'public profile directory exists');
select has_index('patopay', 'wallets_one_default_per_user_network', 'wallet default uniqueness exists');
select has_index('patopay', 'payment_attempts_one_active', 'active attempt uniqueness exists');
select has_column('patopay', 'payment_requests', 'amount_minor', 'money is stored as amount_minor');
select has_column('patopay', 'assets', 'contract_address', 'asset identity stores contract address');
select has_trigger('auth', 'users', 'on_auth_user_created_patopay', 'auth trigger exists');

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'patopay' and c.relname = 'profiles'),
  'profiles has enabled and forced RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'patopay' and c.relname = 'payment_requests'),
  'payment requests has enabled and forced RLS'
);
select ok(
  (select count(*) = 0 from information_schema.role_table_grants
   where table_schema = 'patopay' and grantee in ('anon', 'authenticated')),
  'Data API roles have no direct grants on private schema'
);
select ok(
  (select count(*) = 0 from pg_roles where rolname = 'patopay_runtime' and (rolsuper or rolbypassrls)),
  'runtime role is not superuser or BYPASSRLS'
);
select ok(
  (select not has_schema_privilege('patopay_runtime', 'patopay', 'CREATE')),
  'runtime role cannot create objects'
);

select * from finish();
rollback;
