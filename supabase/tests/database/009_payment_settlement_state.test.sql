begin;
set local role postgres;
set local search_path = public, extensions, patopay;
select plan(19);

select ok((select exists (
  select 1 from information_schema.columns
  where table_schema = 'patopay' and table_name = 'payment_attempts' and column_name = 'payment_requirements'
)), 'payment requirements are persisted');
select ok((select exists (
  select 1 from information_schema.columns
  where table_schema = 'patopay' and table_name = 'payment_attempts' and column_name = 'payment_payload_hash'
)), 'only payment payload hash is persisted');
select ok((select exists (
  select 1 from information_schema.columns
  where table_schema = 'patopay' and table_name = 'payment_attempts' and column_name = 'last_checked_at'
)), 'reconciliation timestamp is persisted');
select ok((select exists (
  select 1 from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'patopay' and t.relname = 'payment_requests'
    and pg_get_constraintdef(c.oid) like '%processing%paid%failed%'
)), 'request has settlement states');
select has_function('patopay', 'prepare_payment_attempt', array['uuid','integer','uuid','jsonb','timestamp with time zone','text'], 'prepare RPC exists');
select has_function('patopay', 'consume_payment_attempt', array['uuid','text'], 'consume RPC exists');
select has_function('patopay', 'record_payment_submission', array['uuid','text','text'], 'submission RPC exists');
select has_function('patopay', 'record_payment_confirmation', array['uuid','text','bigint','jsonb'], 'confirmation RPC exists');
select has_function('patopay', 'record_payment_failure', array['uuid','text'], 'failure RPC exists');
select has_function('patopay', 'record_payment_unknown', array['uuid','text'], 'unknown RPC exists');

insert into auth.users (id, aud, role, email)
values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'settlement-requester@example.invalid'),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'settlement-payer@example.invalid')
on conflict (id) do nothing;
insert into patopay.wallets (id, user_id, provider, network, contract_address, status)
values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'stellar', 'testnet', 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'active'),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 'stellar', 'testnet', 'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 'active')
on conflict (id) do nothing;
insert into patopay.payment_requests (
  id, requester_id, payer_id, source_wallet_id, destination_wallet_id, asset_id, amount_minor,
  status, version
)
select
  '93000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '92000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000002',
  id,
  1000000,
  'approved',
  2
from patopay.assets
where network = 'testnet' and code = 'USDC'
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
select ok((patopay.prepare_payment_attempt(
  '93000000-0000-4000-8000-000000000001', 2, '94000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'x402Version', 2,
    'accepts', jsonb_build_array(jsonb_build_object(
      'scheme', 'exact', 'network', 'stellar:testnet', 'amount', '1000000',
      'asset', 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
      'payTo', 'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      'maxTimeoutSeconds', 60, 'extra', jsonb_build_object()
    ))
  ),
  now() + interval '60 seconds', 'settlement-prepare-1'
)->>'status' = 'prepared'), 'prepare returns prepared attempt');
select is((select status from patopay.payment_requests where id = '93000000-0000-4000-8000-000000000001'), 'processing', 'prepare moves request to processing');
select is((select attempt_number from patopay.payment_attempts where id = '94000000-0000-4000-8000-000000000001'), 1, 'first attempt is numbered one');
select is((patopay.consume_payment_attempt('94000000-0000-4000-8000-000000000001', repeat('a', 64))->>'status'), 'submitting', 'consume moves attempt to submitting');
select is((select payment_payload_hash from patopay.payment_attempts where id = '94000000-0000-4000-8000-000000000001'), repeat('a', 64), 'consume stores only payload hash');
select is((patopay.record_payment_submission('94000000-0000-4000-8000-000000000001', repeat('b', 64), 'facilitator-1')->>'status'), 'submitted', 'submission is recorded');
select is((patopay.record_payment_confirmation('94000000-0000-4000-8000-000000000001', repeat('b', 64), 12345, jsonb_build_object('ok', true))->>'status'), 'confirmed', 'confirmation is recorded');
select is((select status from patopay.payment_requests where id = '93000000-0000-4000-8000-000000000001'), 'paid', 'confirmed attempt marks request paid');
select is((patopay.record_payment_confirmation('94000000-0000-4000-8000-000000000001', repeat('b', 64), 12345, jsonb_build_object('ok', true))->>'status'), 'confirmed', 'confirmation retry is idempotent');

select * from finish();
rollback;
