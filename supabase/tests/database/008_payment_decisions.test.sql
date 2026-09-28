begin;
set local role postgres;
set local search_path = public, extensions, patopay;
select plan(14);

insert into auth.users (id, aud, role, email)
values
  ('81000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'decision-requester@example.invalid'),
  ('81000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'decision-payer@example.invalid'),
  ('81000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'decision-outsider@example.invalid')
on conflict (id) do nothing;

insert into patopay.wallets (id, user_id, provider, network, contract_address, status)
values
  ('83000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', 'mock', 'mock', 'decision-source', 'active'),
  ('83000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', 'mock', 'mock', 'decision-destination', 'active');

insert into patopay.payment_requests (
  id, requester_id, payer_id, source_wallet_id, destination_wallet_id,
  asset_id, amount_minor, status, version
)
values
  (
    '84000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000002',
    '83000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000002',
    (select id from patopay.assets where network = 'testnet' and contract_address = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'),
    1000000,
    'pending_approval',
    1
  ),
  (
    '84000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000002',
    '83000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000002',
    (select id from patopay.assets where network = 'testnet' and contract_address = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'),
    2000000,
    'pending_approval',
    1
  );

insert into patopay.policy_decisions (
  id, payment_request_id, actor_id, source, action, outcome, reason_code
)
values (
  '85000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001',
  null,
  'engine',
  'block',
  'approval_required',
  'manual_approval_required'
);

select has_function(
  'patopay',
  'decide_payment_request',
  array['uuid', 'text', 'integer', 'text'],
  'payment decision RPC exists'
);
select ok(
  coalesce((
    select position('auth.uid()' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'patopay' and p.proname = 'decide_payment_request'
    limit 1
  ), false),
  'payment decision RPC derives actor from auth.uid'
);

set role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select patopay.decide_payment_request(
    '84000000-0000-4000-8000-000000000001', 'approve', 1, 'not-the-payer'
  )$$,
  '42501',
  'only the payer can decide a payment request',
  'requester cannot approve the payer decision'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select is(
  patopay.decide_payment_request(
    '84000000-0000-4000-8000-000000000001', 'approve', 1, 'approve-once'
  ),
  jsonb_build_object(
    'id', '84000000-0000-4000-8000-000000000001'::uuid,
    'status', 'approved',
    'version', 2,
    'next_action', 'prepare_sign_and_execute'
  ),
  'payer approval returns approved rather than paid'
);

set role postgres;
select is(
  (select version from patopay.payment_requests where id = '84000000-0000-4000-8000-000000000001'),
  2,
  'approval increments the optimistic version'
);
select is(
  (select count(*)::integer from patopay.policy_decisions where payment_request_id = '84000000-0000-4000-8000-000000000001'),
  2,
  'manual decision is appended to decision history'
);
select is(
  (select source || ':' || action || ':' || reason_code from patopay.policy_decisions where id = '85000000-0000-4000-8000-000000000001'),
  'engine:block:manual_approval_required',
  'existing decision history remains unchanged'
);

set role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select is(
  patopay.decide_payment_request(
    '84000000-0000-4000-8000-000000000001', 'approve', 1, 'approve-once'
  ),
  jsonb_build_object(
    'id', '84000000-0000-4000-8000-000000000001'::uuid,
    'status', 'approved',
    'version', 2,
    'next_action', 'prepare_sign_and_execute'
  ),
  'same idempotency key and payload returns the original response'
);

set role postgres;
select is(
  (select count(*)::integer from patopay.policy_decisions where payment_request_id = '84000000-0000-4000-8000-000000000001'),
  2,
  'idempotent retry does not append another decision'
);

set role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select patopay.decide_payment_request(
    '84000000-0000-4000-8000-000000000001', 'reject', 1, 'approve-once'
  )$$,
  '23505',
  'idempotency key payload conflict',
  'same idempotency key with a different payload fails'
);
select throws_ok(
  $$select patopay.decide_payment_request(
    '84000000-0000-4000-8000-000000000001', 'approve', 2, 'approve-twice'
  )$$,
  'PT409',
  'payment request is not pending approval',
  'approve is allowed only from pending approval'
);
select throws_ok(
  $$select patopay.decide_payment_request(
    '84000000-0000-4000-8000-000000000002', 'reject', 2, 'stale-reject'
  )$$,
  'PT409',
  'payment request version is stale',
  'stale expected version conflicts'
);
select is(
  patopay.decide_payment_request(
    '84000000-0000-4000-8000-000000000002', 'reject', 1, 'reject-once'
  ),
  jsonb_build_object(
    'id', '84000000-0000-4000-8000-000000000002'::uuid,
    'status', 'rejected',
    'version', 2,
    'next_action', null
  ),
  'payer rejection returns a terminal rejected decision'
);
select throws_ok(
  $$select patopay.decide_payment_request(
    '84000000-0000-4000-8000-000000000002', 'reject', 2, 'reject-twice'
  )$$,
  'PT409',
  'payment request is not pending approval',
  'reject is allowed only from pending approval'
);

select * from finish();
rollback;
